import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import type { Context } from 'hono';
import { getDb } from '../db/client.js';
import { comentarios, comentarios_likes, reacciones, testimonios } from '../db/schema.js';
import { E } from '../lib/errors.js';
import { codificarCursor, decodificarCursor } from '../lib/paginacion.js';
import { colDe, tsPreciso } from '../db/geo.js';
import type { AppEnv } from '../types.js';
import { registrarBitacora } from './bitacora.js';
import { obtenerConfiguracion } from './configuracion.js';

type Ctx = Context<AppEnv>;
type TipoReaccion = (typeof reacciones.$inferInsert)['tipo'];

async function exigirTestimonioPublico(id: string) {
  const [t] = await getDb().select({ id: testimonios.id }).from(testimonios).where(and(eq(testimonios.id, id), eq(testimonios.es_publico, true))).limit(1);
  if (!t) throw E.noEncontrado('Testimonio');
}

/* ───────────────────────────────────────── Reacciones ───────────────────────────────────────── */

async function conteoReacciones(testimonioId: string) {
  const [t] = await getDb().select({ reacciones_conteo: testimonios.reacciones_conteo, reacciones_total: testimonios.reacciones_total }).from(testimonios).where(eq(testimonios.id, testimonioId));
  return t ?? { reacciones_conteo: {}, reacciones_total: 0 };
}

/** Una reacción de cada tipo por dispositivo (clave primaria compuesta). Los contadores los mantiene un trigger. */
export async function reaccionar(testimonioId: string, tipo: TipoReaccion, huella: string) {
  if (!(await obtenerConfiguracion()).reacciones_habilitadas) throw E.prohibido('Las reacciones están deshabilitadas');
  await exigirTestimonioPublico(testimonioId);
  const nuevas = await getDb().insert(reacciones).values({ testimonio_id: testimonioId, huella_hash: huella, tipo }).onConflictDoNothing().returning({ tipo: reacciones.tipo });
  return { agregada: nuevas.length > 0, ...(await conteoReacciones(testimonioId)) };
}

export async function quitarReaccion(testimonioId: string, tipo: TipoReaccion, huella: string) {
  const borradas = await getDb()
    .delete(reacciones)
    .where(and(eq(reacciones.testimonio_id, testimonioId), eq(reacciones.huella_hash, huella), eq(reacciones.tipo, tipo)))
    .returning({ tipo: reacciones.tipo });
  return { quitada: borradas.length > 0, ...(await conteoReacciones(testimonioId)) };
}

export async function misReacciones(testimonioId: string, huella: string) {
  const filas = await getDb().select({ tipo: reacciones.tipo }).from(reacciones).where(and(eq(reacciones.testimonio_id, testimonioId), eq(reacciones.huella_hash, huella)));
  return filas.map((f) => f.tipo);
}

/* ───────────────────────────────────────── Comentarios ───────────────────────────────────────── */

export async function comentar(c: Ctx, testimonioId: string, datos: { contenido: string; autor_nombre?: string }, huella: string) {
  const cfg = await obtenerConfiguracion();
  if (!cfg.comentarios_habilitados) throw E.prohibido('Los comentarios están deshabilitados');
  await exigirTestimonioPublico(testimonioId);
  const [fila] = await getDb()
    .insert(comentarios)
    .values({
      testimonio_id: testimonioId,
      participante_id: c.get('participante')?.id ?? null,
      autor_nombre: datos.autor_nombre?.trim() || null,
      contenido: datos.contenido.trim(),
      estado: cfg.comentarios_requieren_moderacion ? 'pendiente' : 'aprobado',
      huella_hash: huella,
    })
    .returning({ id: comentarios.id, testimonio_id: comentarios.testimonio_id, autor_nombre: comentarios.autor_nombre, contenido: comentarios.contenido, estado: comentarios.estado, likes_conteo: comentarios.likes_conteo, created_at: comentarios.created_at });
  return { ...fila!, visible: fila!.estado === 'aprobado' };
}

export async function listarComentariosPublicos(testimonioId: string, limite: number, cursorRaw: string | undefined, huella?: string) {
  await exigirTestimonioPublico(testimonioId);
  const cursor = decodificarCursor(cursorRaw);
  const cond: (SQL | undefined)[] = [eq(comentarios.testimonio_id, testimonioId), eq(comentarios.activo, true), eq(comentarios.estado, 'aprobado')];
  if (cursor) cond.push(sql`(${comentarios.created_at}, ${comentarios.id}) > (${cursor.t}::timestamptz, ${cursor.id}::uuid)`);

  const filas = await getDb()
    .select({
      id: comentarios.id, autor_nombre: comentarios.autor_nombre, contenido: comentarios.contenido, likes_conteo: comentarios.likes_conteo, created_at: comentarios.created_at,
      cursor_t: tsPreciso(comentarios.created_at),
      le_di_like: huella
        ? sql<boolean>`exists (select 1 from ${comentarios_likes} l where l.comentario_id = ${colDe('comentarios', 'id')} and l.huella_hash = ${huella})`
        : sql<boolean>`false`,
    })
    .from(comentarios)
    .where(and(...cond))
    .orderBy(asc(comentarios.created_at), asc(comentarios.id))
    .limit(limite + 1);

  const hayMas = filas.length > limite;
  const pagina = filas.slice(0, limite);
  const ultimo = pagina[pagina.length - 1];
  return {
    items: pagina.map(({ cursor_t: _t, ...r }) => r),
    siguiente_cursor: hayMas && ultimo ? codificarCursor({ t: ultimo.cursor_t, id: ultimo.id }) : null,
  };
}

async function exigirComentarioVisible(comentarioId: string) {
  const [r] = await getDb()
    .select({ id: comentarios.id })
    .from(comentarios)
    .innerJoin(testimonios, eq(testimonios.id, comentarios.testimonio_id))
    .where(and(eq(comentarios.id, comentarioId), eq(comentarios.activo, true), eq(comentarios.estado, 'aprobado'), eq(testimonios.es_publico, true)))
    .limit(1);
  if (!r) throw E.noEncontrado('Comentario');
}

async function likesDe(comentarioId: string) {
  const [r] = await getDb().select({ likes_conteo: comentarios.likes_conteo }).from(comentarios).where(eq(comentarios.id, comentarioId));
  return r?.likes_conteo ?? 0;
}

/** Like a un comentario: uno por dispositivo (clave primaria compuesta). El contador lo mantiene un trigger. */
export async function likeComentario(comentarioId: string, huella: string) {
  if (!(await obtenerConfiguracion()).reacciones_habilitadas) throw E.prohibido('Las reacciones están deshabilitadas');
  await exigirComentarioVisible(comentarioId);
  const nuevos = await getDb().insert(comentarios_likes).values({ comentario_id: comentarioId, huella_hash: huella }).onConflictDoNothing().returning({ id: comentarios_likes.comentario_id });
  return { agregado: nuevos.length > 0, likes_conteo: await likesDe(comentarioId) };
}

export async function quitarLikeComentario(comentarioId: string, huella: string) {
  const borrados = await getDb().delete(comentarios_likes).where(and(eq(comentarios_likes.comentario_id, comentarioId), eq(comentarios_likes.huella_hash, huella))).returning({ id: comentarios_likes.comentario_id });
  return { quitado: borrados.length > 0, likes_conteo: await likesDe(comentarioId) };
}

/* ───────────────────────────────────── Moderación de comentarios (dashboard) ───────────────────────────────────── */

/** Comentarios de testimonios con información sensible o de menores: solo los ve administración. */
const deTestimonioNoSensible = sql`${comentarios.testimonio_id} in (select id from testimonios where not (info_sensible or info_menores))`;

export async function listarComentariosStaff(
  f: { estado?: 'pendiente' | 'aprobado' | 'rechazado'; activo?: boolean; testimonio_id?: string; pagina: number; por_pagina: number },
  sinSensibles = false,
) {
  const db = getDb();
  const cond = and(
    sinSensibles ? deTestimonioNoSensible : undefined,
    f.estado ? eq(comentarios.estado, f.estado) : undefined,
    f.activo !== undefined ? eq(comentarios.activo, f.activo) : undefined,
    f.testimonio_id ? eq(comentarios.testimonio_id, f.testimonio_id) : undefined,
  );
  const filas = await db
    .select({
      id: comentarios.id, testimonio_id: comentarios.testimonio_id, testimonio_folio: sql<string>`(select folio from testimonios t where t.id = ${colDe('comentarios', 'testimonio_id')})`,
      autor_nombre: comentarios.autor_nombre, contenido: comentarios.contenido, estado: comentarios.estado, activo: comentarios.activo,
      likes_conteo: comentarios.likes_conteo, created_at: comentarios.created_at, updated_at: comentarios.updated_at,
    })
    .from(comentarios)
    .where(cond)
    .orderBy(desc(comentarios.created_at), desc(comentarios.id))
    .limit(f.por_pagina)
    .offset((f.pagina - 1) * f.por_pagina);
  const [{ total } = { total: 0 }] = await db.select({ total: sql<number>`count(*)::int` }).from(comentarios).where(cond);
  return { filas, total };
}

export async function editarComentarioStaff(
  c: Ctx,
  id: string,
  cambios: { estado?: 'pendiente' | 'aprobado' | 'rechazado'; activo?: boolean; contenido?: string },
  sinSensibles = false,
) {
  if (Object.keys(cambios).length === 0) throw E.invalido('No hay cambios que aplicar');
  const db = getDb();
  const [actual] = await db
    .select({ estado: comentarios.estado, activo: comentarios.activo })
    .from(comentarios)
    .where(and(eq(comentarios.id, id), sinSensibles ? deTestimonioNoSensible : undefined))
    .limit(1);
  if (!actual) throw E.noEncontrado('Comentario');
  await db.update(comentarios).set(cambios).where(eq(comentarios.id, id));
  const { contenido, ...resto } = cambios;
  const antes = Object.fromEntries(Object.keys(resto).map((k) => [k, actual[k as keyof typeof actual]]));
  await registrarBitacora(c, { accion: 'comentario.editar', entidad: 'comentario', entidadId: id, antes, despues: { ...resto, contenido: contenido ? '[texto modificado]' : undefined } });
}

export async function eliminarComentarioStaff(c: Ctx, id: string) {
  const db = getDb();
  const [actual] = await db
    .select({ testimonio_folio: sql<string>`(select folio from testimonios t where t.id = ${colDe('comentarios', 'testimonio_id')})` })
    .from(comentarios)
    .where(eq(comentarios.id, id))
    .limit(1);
  if (!actual) throw E.noEncontrado('Comentario');
  await db.delete(comentarios).where(eq(comentarios.id, id));
  await registrarBitacora(c, { accion: 'comentario.eliminar_permanente', entidad: 'comentario', entidadId: id, folio: actual.testimonio_folio });
}
