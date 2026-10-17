import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { getDb } from '../db/client.js';
import { evidencias, expedientes, testimonios } from '../db/schema.js';
import { E } from '../lib/errors.js';
import { folioEvidencia } from '../lib/ids.js';
import { borrarObjeto, firmarLectura, firmarSubida, inspeccionarObjeto } from '../lib/r2.js';
import type { PresignEvidenciasInput } from '../schemas/evidencias.js';
import type { AppEnv } from '../types.js';
import { registrarBitacora } from './bitacora.js';
import { obtenerConfiguracion } from './configuracion.js';
import { evidenciaPublicaPorDefecto } from './reglas.js';

type Ctx = Context<AppEnv>;

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf',
  'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/webm': '.weba',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
};

/** foto → image/*, video → video/*, audio → audio/*; los demás tipos aceptan cualquier MIME permitido. */
function tipoCoincideConMime(tipo: string, mime: string) {
  if (tipo === 'foto') return mime.startsWith('image/');
  if (tipo === 'video') return mime.startsWith('video/');
  if (tipo === 'audio') return mime.startsWith('audio/');
  return true;
}

// Las reservas pendientes (aún sin confirmar) cuentan contra el límite solo durante 30 minutos.
const VIGENTES = sql`(${evidencias.estado_subida} = 'subida' OR ${evidencias.created_at} > now() - interval '30 minutes')`;

async function cargarTestimonio(testimonioId: string) {
  const [t] = await getDb()
    .select({ id: testimonios.id, estado: testimonios.estado, autoriza_multimedia: testimonios.autoriza_multimedia, expediente: expedientes.codigo })
    .from(testimonios)
    .innerJoin(expedientes, eq(expedientes.id, testimonios.expediente_id))
    .where(eq(testimonios.id, testimonioId))
    .limit(1);
  if (!t) throw E.noEncontrado('Testimonio');
  return t;
}

/**
 * Paso 1 de la subida: valida límites (máx. de archivos y suma de tamaños, editables en configuración),
 * reserva las evidencias y devuelve URLs firmadas de R2 para subir directo desde el navegador.
 */
export async function presignarEvidencias(c: Ctx, testimonioId: string, input: PresignEvidenciasInput, usuarioId?: string) {
  const cfg = await obtenerConfiguracion();
  const t = await cargarTestimonio(testimonioId);

  for (const a of input.archivos) {
    if (!cfg.tipos_mime_permitidos.includes(a.mime)) throw E.invalido(`Tipo de archivo no permitido: ${a.mime}`, { permitidos: cfg.tipos_mime_permitidos });
    if (!tipoCoincideConMime(a.tipo, a.mime)) throw E.invalido(`El archivo "${a.nombre}" (${a.mime}) no corresponde al tipo "${a.tipo}"`);
  }
  const bytesNuevos = input.archivos.reduce((s, a) => s + a.bytes, 0);

  const reservas = await getDb().transaction(async (tx) => {
    // Serializa las reservas del mismo testimonio para que dos peticiones simultáneas no rebasen el límite
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${testimonioId}))`);
    const [uso] = await tx
      .select({ n: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(coalesce(${evidencias.bytes}, ${evidencias.bytes_declarados})), 0)::bigint` })
      .from(evidencias)
      .where(and(eq(evidencias.testimonio_id, testimonioId), eq(evidencias.activo, true), VIGENTES));
    const n = Number(uso?.n ?? 0);
    const bytes = Number(uso?.bytes ?? 0);
    if (n + input.archivos.length > cfg.max_archivos_por_testimonio) {
      throw E.invalido(`Máximo ${cfg.max_archivos_por_testimonio} archivos por testimonio (ya tiene ${n})`, { max_archivos: cfg.max_archivos_por_testimonio, actuales: n });
    }
    if (bytes + bytesNuevos > cfg.max_bytes_totales_por_testimonio) {
      throw E.invalido(`Los archivos no pueden sumar más de ${(cfg.max_bytes_totales_por_testimonio / 1048576).toFixed(0)} MB por testimonio`, {
        max_bytes: cfg.max_bytes_totales_por_testimonio, usados: bytes, solicitados: bytesNuevos,
      });
    }
    const filas = input.archivos.map((a) => ({
      folio: folioEvidencia(t.expediente),
      testimonio_id: testimonioId,
      tipo: a.tipo,
      storage_key: `evidencias/${testimonioId}/${randomUUID()}${EXTENSIONES[a.mime] ?? ''}`,
      nombre_original: a.nombre,
      mime: a.mime,
      bytes_declarados: a.bytes,
      descripcion: a.descripcion ?? null,
      subida_por_usuario_id: usuarioId ?? null,
    }));
    return tx.insert(evidencias).values(filas).returning({ id: evidencias.id, folio: evidencias.folio, storage_key: evidencias.storage_key, mime: evidencias.mime, bytes: evidencias.bytes_declarados });
  });

  // sin-bd: Promise.all solo firma URLs de R2 (no toca la base)
  const archivos = await Promise.all(
    reservas.map(async (r) => ({
      evidencia_id: r.id,
      folio: r.folio,
      subir: {
        metodo: 'PUT' as const,
        url: await firmarSubida(r.storage_key, r.mime, r.bytes, 600),
        cabeceras: { 'Content-Type': r.mime, 'Content-Length': String(r.bytes) },
        expira_en_segundos: 600,
      },
    })),
  );
  await registrarBitacora(c, { accion: 'evidencia.reservar', entidad: 'testimonio', entidadId: testimonioId, detalle: { archivos: archivos.length, bytes: bytesNuevos } });
  return { archivos, limites: { max_archivos: cfg.max_archivos_por_testimonio, max_bytes_totales: cfg.max_bytes_totales_por_testimonio } };
}

/** Paso 2: tras subir a R2, el cliente confirma. El servidor verifica en R2 el tamaño y tipo REALES (no confía en lo declarado). */
export async function confirmarEvidencia(c: Ctx, testimonioId: string, evidenciaId: string) {
  const db = getDb();
  const [ev] = await db.select().from(evidencias).where(and(eq(evidencias.id, evidenciaId), eq(evidencias.testimonio_id, testimonioId))).limit(1);
  if (!ev) throw E.noEncontrado('Evidencia');
  if (ev.estado_subida === 'subida') return ev;

  const cfg = await obtenerConfiguracion();
  const real = await inspeccionarObjeto(ev.storage_key);
  if (!real) throw E.conflicto('El archivo todavía no aparece en el almacenamiento: sube el archivo con la URL firmada y vuelve a confirmar', 'ARCHIVO_NO_SUBIDO');

  const [otros] = await db
    .select({ bytes: sql<number>`coalesce(sum(coalesce(${evidencias.bytes}, ${evidencias.bytes_declarados})), 0)::bigint` })
    .from(evidencias)
    .where(and(eq(evidencias.testimonio_id, testimonioId), eq(evidencias.activo, true), sql`${evidencias.id} <> ${evidenciaId}`, VIGENTES));
  const excede = real.bytes !== ev.bytes_declarados || (real.mime && real.mime !== ev.mime) || Number(otros?.bytes ?? 0) + real.bytes > cfg.max_bytes_totales_por_testimonio;
  if (excede) {
    await borrarObjeto(ev.storage_key).catch(() => {});
    await db.delete(evidencias).where(eq(evidencias.id, evidenciaId));
    throw E.invalido('El archivo subido no coincide con lo declarado (tamaño o tipo) o excede el límite; fue descartado');
  }

  const t = await cargarTestimonio(testimonioId);
  const [fila] = await db
    .update(evidencias)
    .set({
      estado_subida: 'subida',
      bytes: real.bytes,
      confirmada_at: new Date(),
      publica: evidenciaPublicaPorDefecto(cfg.modo_publicacion, t.estado, t.autoriza_multimedia, ev.tipo),
    })
    .where(eq(evidencias.id, evidenciaId))
    .returning();
  await registrarBitacora(c, { accion: 'evidencia.confirmar', entidad: 'evidencia', entidadId: evidenciaId, detalle: { testimonio_id: testimonioId, bytes: real.bytes } });
  return fila!;
}

export async function listarEvidencias(testimonioId: string) {
  return getDb()
    .select({
      id: evidencias.id, folio: evidencias.folio, tipo: evidencias.tipo, estado_subida: evidencias.estado_subida, nombre_original: evidencias.nombre_original,
      mime: evidencias.mime, bytes: sql<number>`coalesce(${evidencias.bytes}, ${evidencias.bytes_declarados})`, descripcion: evidencias.descripcion,
      publica: evidencias.publica, activo: evidencias.activo, created_at: evidencias.created_at,
    })
    .from(evidencias)
    .where(eq(evidencias.testimonio_id, testimonioId))
    .orderBy(asc(evidencias.created_at));
}

export async function actualizarEvidencia(c: Ctx, testimonioId: string, evidenciaId: string, cambios: { publica?: boolean; activo?: boolean; descripcion?: string | null; tipo?: (typeof evidencias.$inferInsert)['tipo'] }) {
  if (Object.keys(cambios).length === 0) throw E.invalido('No hay cambios que aplicar');
  const [fila] = await getDb().update(evidencias).set(cambios).where(and(eq(evidencias.id, evidenciaId), eq(evidencias.testimonio_id, testimonioId))).returning({ id: evidencias.id });
  if (!fila) throw E.noEncontrado('Evidencia');
  await registrarBitacora(c, { accion: 'evidencia.editar', entidad: 'evidencia', entidadId: evidenciaId, despues: cambios, detalle: { testimonio_id: testimonioId } });
}

/** Elimina la evidencia: el objeto de R2 y la fila. (Para solo ocultarla, usar actualizarEvidencia({ activo: false }).) */
export async function eliminarEvidencia(c: Ctx, testimonioId: string, evidenciaId: string) {
  const db = getDb();
  const [ev] = await db
    .select({ key: evidencias.storage_key, folio: evidencias.folio, nombre: evidencias.nombre_original, testimonio_folio: sql<string>`(select folio from testimonios where id = ${testimonioId})` })
    .from(evidencias)
    .where(and(eq(evidencias.id, evidenciaId), eq(evidencias.testimonio_id, testimonioId)))
    .limit(1);
  if (!ev) throw E.noEncontrado('Evidencia');
  await borrarObjeto(ev.key).catch((err) => console.error('R2: no se pudo borrar', ev.key, (err as Error).message));
  await db.delete(evidencias).where(eq(evidencias.id, evidenciaId));
  await registrarBitacora(c, { accion: 'evidencia.eliminar', entidad: 'evidencia', entidadId: evidenciaId, folio: ev.testimonio_folio, antes: { folio: ev.folio, archivo: ev.nombre }, detalle: { testimonio_id: testimonioId } });
}

/** URL temporal (5 min) para que el personal vea/descargue una evidencia. */
export async function urlEvidenciaStaff(c: Ctx, evidenciaId: string) {
  const [ev] = await getDb().select().from(evidencias).where(eq(evidencias.id, evidenciaId)).limit(1);
  if (!ev || ev.estado_subida !== 'subida') throw E.noEncontrado('Evidencia');
  await registrarBitacora(c, { accion: 'evidencia.ver', entidad: 'evidencia', entidadId: evidenciaId, detalle: { testimonio_id: ev.testimonio_id } });
  return { url: await firmarLectura(ev.storage_key, ev.nombre_original, 300), expira_en_segundos: 300, mime: ev.mime, nombre: ev.nombre_original };
}

/** Evidencias visibles al público de un testimonio ya público, con URLs firmadas temporales (1 h). */
export async function evidenciasPublicas(testimonioId: string) {
  const filas = await getDb()
    .select({ id: evidencias.id, folio: evidencias.folio, tipo: evidencias.tipo, mime: evidencias.mime, nombre: evidencias.nombre_original, bytes: evidencias.bytes, descripcion: evidencias.descripcion, key: evidencias.storage_key })
    .from(evidencias)
    .where(and(eq(evidencias.testimonio_id, testimonioId), eq(evidencias.publica, true), eq(evidencias.activo, true), eq(evidencias.estado_subida, 'subida')))
    .orderBy(asc(evidencias.created_at));
  try {
    // sin-bd: Promise.all solo firma URLs de R2 (no toca la base)
    return await Promise.all(filas.map(async ({ key, ...f }) => ({ ...f, url: await firmarLectura(key, f.nombre, 3600) })));
  } catch (err) {
    console.error('No se pudieron firmar las evidencias públicas', (err as Error).message);
    return [];
  }
}
