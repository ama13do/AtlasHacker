import { and, asc, desc, eq, getTableColumns, sql, type SQL } from 'drizzle-orm';
import type { Context } from 'hono';
import { enSerie, getDb, type Ejecutor } from '../db/client.js';
import { colDe, geoJson } from '../db/geo.js';
import { categorias, evidencias, expedientes, testimonios, testimonios_auditoria, usuarios, v_testimonios_publicos, type EnlaceEvidencia } from '../db/schema.js';
import { cifrar, hmac } from '../lib/crypto.js';
import { E, esViolacionUnica } from '../lib/errors.js';
import { folioTestimonio } from '../lib/ids.js';
import { emitirEventoMapa } from '../lib/realtime.js';
import { borrarObjeto } from '../lib/r2.js';
import type { CrearTestimonioInput, CrearTestimonioStaffInput, EditarMiTestimonioSchema, EditarTestimonioStaffInput, FiltrosStaff } from '../schemas/testimonios.js';
import type { z } from '@hono/zod-openapi';
import type { AppEnv, UsuarioAuth } from '../types.js';
import { diferencias, registrarBitacora } from './bitacora.js';
import { obtenerConfiguracion } from './configuracion.js';
import { crearParticipante } from './participantes.js';
import { decidirPublicacion, evidenciaPublicaPorDefecto } from './reglas.js';

type Ctx = Context<AppEnv>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ───────────────────────────────────── Selecciones reutilizables ───────────────────────────────────── */

const { busqueda: _b, centroide: _c, ubicacion: _u, ubicacion_publica: _up, centroide_publico: _cp, ...columnasPlanas } = getTableColumns(testimonios);

/** Todas las columnas con las geometrías convertidas a GeoJSON (sin la columna tsvector). */
export const selDetalle = {
  ...columnasPlanas,
  ubicacion: geoJson(testimonios.ubicacion),
  centroide: geoJson(testimonios.centroide),
  ubicacion_publica: geoJson(testimonios.ubicacion_publica),
};

/** Lo que la persona dueña puede ver de su propio testimonio (sin notas internas ni quién moderó). */
const { notas_internas: _n, moderado_por: _m, ...selPropioBase } = selDetalle;
export const selPropio = selPropioBase;

/* ───────────────────────────────────────── Catálogos ───────────────────────────────────────── */

export async function resolverExpediente(ref?: string) {
  const db = getDb();
  const condicion = !ref
    ? eq(expedientes.activo, true)
    : UUID.test(ref)
      ? eq(expedientes.id, ref)
      : eq(expedientes.codigo, ref.toUpperCase());
  const [e] = await db.select().from(expedientes).where(condicion).orderBy(asc(expedientes.created_at)).limit(1);
  if (!e) throw E.invalido(ref ? `Expediente "${ref}" no existe` : 'No hay un expediente activo');
  if (!e.activo && !ref) throw E.invalido('No hay un expediente activo');
  return e;
}

export async function resolverCategoria(ref: string, soloActivas = true) {
  const [c] = await getDb()
    .select()
    .from(categorias)
    .where(UUID.test(ref) ? eq(categorias.id, ref) : eq(categorias.slug, ref.toLowerCase()))
    .limit(1);
  if (!c || (soloActivas && !c.activo)) throw E.invalido(`Categoría "${ref}" no existe o está desactivada`);
  return c;
}

/* ─────────────────────────────────────────── Crear ─────────────────────────────────────────── */

type OpcionesCrear = {
  origen: 'web' | 'facilitador';
  participanteId?: string; // la persona ya identificada (por su folio, o elegida por el facilitador)
  usuario?: UsuarioAuth; // quien captura desde el dashboard
};

export async function crearTestimonio(c: Ctx, input: CrearTestimonioInput | CrearTestimonioStaffInput, op: OpcionesCrear) {
  const cfg = await obtenerConfiguracion();
  const expediente = await resolverExpediente(input.expediente);
  const categoria = await resolverCategoria(input.categoria);

  const aparecerComo = input.aparecer_como ?? 'anonimo';
  const infoSensible = input.info_sensible ?? false;
  const decision = decidirPublicacion(cfg.modo_publicacion, {
    autorizacion: input.autorizacion,
    info_sensible: infoSensible,
    sensible_accion: input.sensible_accion,
    info_menores: input.info_menores ?? false,
  });
  const nombrePublico = aparecerComo === 'nombre' ? (input.nombre_publico ?? input.nombre ?? null) : null;

  const participanteIdDado = op.participanteId ?? ('participante_id' in input ? input.participante_id : undefined);
  const db = getDb();

  for (let intento = 0; ; intento++) {
    try {
      return await db.transaction(async (tx) => {
        let participanteId = participanteIdDado;
        let folioParticipante: string | undefined;
        if (participanteId) {
          const [p] = await tx.execute<{ id: string }>(sql`select id from participantes where id = ${participanteId} and activo`);
          if (!p) throw E.invalido('El participante indicado no existe o está inactivo');
        } else {
          const nuevo = await crearParticipante(
            tx,
            { nombre: input.nombre, correo: input.contacto?.correo, telefono: input.contacto?.telefono },
            { creadoPorUsuarioId: op.usuario?.id, avisoVersion: cfg.consentimiento_version_actual },
          );
          participanteId = nuevo.id;
          folioParticipante = nuevo.folio;
        }

        const [t] = await tx
          .insert(testimonios)
          .values({
            folio: folioTestimonio(expediente.codigo),
            expediente_id: expediente.id,
            categoria_id: categoria.id,
            participante_id: participanteId!,
            origen: op.origen,
            fecha: input.fecha,
            titulo: input.titulo,
            lugar_territorio: input.lugar_territorio,
            entidad: input.entidad,
            municipio: input.municipio,
            facilitador_id: op.usuario?.id ?? null,
            facilitador_nombre: input.facilitador_nombre ?? op.usuario?.nombre ?? null,
            aparecer_como: aparecerComo,
            nombre_publico: nombrePublico,
            ubicacion: input.ubicacion,
            ubicacion_aproximada: decision.ubicacion_aproximada,
            origen_ubicacion: input.origen_ubicacion ?? 'mapa',
            relato: input.relato,
            territorio_dice: input.territorio_dice,
            comunidad_dice: input.comunidad_dice,
            tiene_evidencia: input.tiene_evidencia ?? 'no',
            evidencia_descripcion: input.evidencia_descripcion,
            evidencia_tipos: input.evidencia_tipos ?? [],
            evidencia_otro: input.evidencia_otro,
            enlaces_evidencia: aEnlaces(input.enlaces_evidencia ?? [], [], evidenciaPublicaPorDefecto(cfg.modo_publicacion, decision.estado, input.autoriza_multimedia ?? 'na', 'link')),
            dato_fuente_anio: input.dato_fuente_anio,
            fuentes: input.fuentes ?? [],
            fuente_pendiente_verificacion: input.fuente_pendiente_verificacion ?? false,
            pregunta_tribunal: input.pregunta_tribunal,
            algo_mas: input.algo_mas,
            registro_voz: input.registro_voz,
            consentimiento_aceptado: true,
            autorizacion: input.autorizacion,
            autoriza_multimedia: input.autoriza_multimedia ?? 'na',
            autoriza_voz_imagen: input.autoriza_voz_imagen ?? null,
            info_menores: input.info_menores ?? false,
            consentimiento_version: cfg.consentimiento_version_actual,
            info_sensible: infoSensible,
            sensible_accion: infoSensible ? (input.sensible_accion ?? null) : null,
            estado: decision.estado,
            moderado_at: decision.estado === 'aprobado' ? new Date() : null,
          })
          .returning({ id: testimonios.id, folio: testimonios.folio, estado: testimonios.estado, es_publico: testimonios.es_publico });
        const creado = t!;

        if (cfg.auditoria_envio_activa) await guardarAuditoria(tx, c, creado.id, input, cfg.auditoria_retencion_dias, cfg.consentimiento_version_actual);

        await registrarBitacora(
          c,
          {
            accion: 'testimonio.crear',
            entidad: 'testimonio',
            entidadId: creado.id,
            folio: creado.folio,
            despues: { folio: creado.folio, estado: creado.estado, categoria: categoria.slug, origen: op.origen },
            detalle: { decision: decision.razon, participante_nuevo: Boolean(folioParticipante) },
          },
          tx,
        );

        return { ...creado, participante_id: participanteId!, folio_participante: folioParticipante, razon: decision.razon };
      });
    } catch (err) {
      if (intento < 3 && esViolacionUnica(err, 'testimonios_folio_unique')) continue; // colisión de folio aleatorio: reintentar
      throw err;
    }
  }
}

async function guardarAuditoria(tx: Ejecutor, c: Ctx, testimonioId: string, input: CrearTestimonioInput | CrearTestimonioStaffInput, dias: number, version: string) {
  const ip = c.get('ip');
  const a = input.auditoria;
  await tx.insert(testimonios_auditoria).values({
    testimonio_id: testimonioId,
    ip_enc: ip && ip !== 'desconocida' ? cifrar(ip, 'auditoria.ip') : null,
    ip_hash: ip && ip !== 'desconocida' ? hmac(ip, 'ip') : null,
    user_agent: c.req.header('user-agent')?.slice(0, 300) ?? null,
    huella_dispositivo_hash: a?.huella_dispositivo ? hmac(a.huella_dispositivo, 'huella') : null,
    captcha_ok: c.get('captchaOk') ?? null,
    origen_ubicacion: input.origen_ubicacion ?? 'mapa',
    precision_gps_m: a?.precision_gps_m ?? null,
    zona_horaria: a?.zona_horaria ?? null,
    idioma: a?.idioma ?? c.req.header('accept-language')?.slice(0, 20) ?? null,
    pantalla: a?.pantalla ?? null,
    referer: c.req.header('referer')?.slice(0, 300) ?? null,
    consentimiento_version: version,
    extra: a?.extra ?? null,
    retener_hasta: new Date(Date.now() + dias * 86400_000),
  });
}

/* ──────────────────────────────────────── Leer ──────────────────────────────────────── */

async function categoriaYExpediente(t: { categoria_id: string; expediente_id: string }) {
  const db = getDb();
  const [[cat], [exp]] = await enSerie(
    () => db.select({ id: categorias.id, slug: categorias.slug, nombre: categorias.nombre, color: categorias.color }).from(categorias).where(eq(categorias.id, t.categoria_id)),
    () => db.select({ id: expedientes.id, codigo: expedientes.codigo, titulo: expedientes.titulo, materia: expedientes.materia }).from(expedientes).where(eq(expedientes.id, t.expediente_id)),
  );
  return { categoria: cat ?? null, expediente: exp ?? null };
}

export async function obtenerPropio(participanteId: string, id: string) {
  const [t] = await getDb().select(selPropio).from(testimonios).where(and(eq(testimonios.id, id), eq(testimonios.participante_id, participanteId))).limit(1);
  if (!t) throw E.noEncontrado('Testimonio');
  return { ...t, ...(await categoriaYExpediente(t)) };
}

export async function listarPropios(participanteId: string) {
  return getDb()
    .select({
      id: testimonios.id,
      folio: testimonios.folio,
      titulo: testimonios.titulo,
      estado: testimonios.estado,
      activo: testimonios.activo,
      es_publico: testimonios.es_publico,
      motivo_rechazo: testimonios.motivo_rechazo,
      lugar_territorio: testimonios.lugar_territorio,
      fecha: testimonios.fecha,
      categoria_slug: sql<string>`(select slug from categorias c where c.id = ${colDe('testimonios', 'categoria_id')})`,
      reacciones_total: testimonios.reacciones_total,
      comentarios_conteo: testimonios.comentarios_conteo,
      created_at: testimonios.created_at,
      updated_at: testimonios.updated_at,
    })
    .from(testimonios)
    .where(eq(testimonios.participante_id, participanteId))
    .orderBy(desc(testimonios.created_at), desc(testimonios.id));
}

export async function obtenerStaff(id: string) {
  const db = getDb();
  const [t] = await db.select(selDetalle).from(testimonios).where(eq(testimonios.id, id)).limit(1);
  if (!t) throw E.noEncontrado('Testimonio');
  const [ctx, evs, [aud], [mod]] = await enSerie(
    () => categoriaYExpediente(t),
    () => db
      .select({
        id: evidencias.id, folio: evidencias.folio, tipo: evidencias.tipo, estado_subida: evidencias.estado_subida, nombre_original: evidencias.nombre_original,
        mime: evidencias.mime, bytes: sql<number>`coalesce(${evidencias.bytes}, ${evidencias.bytes_declarados})`, descripcion: evidencias.descripcion,
        publica: evidencias.publica, activo: evidencias.activo, created_at: evidencias.created_at,
      })
      .from(evidencias)
      .where(eq(evidencias.testimonio_id, id))
      .orderBy(asc(evidencias.created_at)),
    () => db.select({ n: sql<number>`count(*)::int` }).from(testimonios_auditoria).where(eq(testimonios_auditoria.testimonio_id, id)),
    () => (t.moderado_por ? db.select({ nombre: usuarios.nombre }).from(usuarios).where(eq(usuarios.id, t.moderado_por)) : Promise.resolve([])),
  );
  return { ...t, ...ctx, evidencias: evs, tiene_auditoria: (aud?.n ?? 0) > 0, moderado_por_nombre: mod?.nombre ?? null };
}

/** Qué parte de los testimonios ve quien consulta: el facilitador solo lo suyo; moderación y lectura, sin sensibles. */
export type AlcanceStaff = { facilitadorId?: string; sinSensibles?: boolean };

export async function listarStaff(f: FiltrosStaff, pagina: number, porPagina: number, alcance: AlcanceStaff = {}) {
  const db = getDb();
  const cond: (SQL | undefined)[] = [];
  if (f.estado) cond.push(eq(testimonios.estado, f.estado));
  if (f.activo !== undefined) cond.push(eq(testimonios.activo, f.activo));
  if (f.es_publico !== undefined) cond.push(eq(testimonios.es_publico, f.es_publico));
  if (f.info_sensible !== undefined) cond.push(eq(testimonios.info_sensible, f.info_sensible));
  if (f.autorizacion) cond.push(eq(testimonios.autorizacion, f.autorizacion));
  if (f.origen) cond.push(eq(testimonios.origen, f.origen));
  if (f.participante_id) cond.push(eq(testimonios.participante_id, f.participante_id));
  if (f.facilitador_id) cond.push(eq(testimonios.facilitador_id, f.facilitador_id));
  if (alcance.facilitadorId) cond.push(eq(testimonios.facilitador_id, alcance.facilitadorId));
  if (alcance.sinSensibles) cond.push(sql`not (${testimonios.info_sensible} or ${testimonios.info_menores})`);
  if (f.entidad) cond.push(eq(testimonios.entidad, f.entidad));
  if (f.folio) cond.push(sql`upper(${testimonios.folio}) = ${f.folio.toUpperCase()}`);
  if (f.categoria) cond.push(UUID.test(f.categoria) ? eq(testimonios.categoria_id, f.categoria) : sql`${testimonios.categoria_id} = (select id from categorias where slug = ${f.categoria})`);
  if (f.expediente) cond.push(UUID.test(f.expediente) ? eq(testimonios.expediente_id, f.expediente) : sql`${testimonios.expediente_id} = (select id from expedientes where codigo = ${f.expediente.toUpperCase()})`);
  if (f.q) cond.push(sql`${testimonios.busqueda} @@ websearch_to_tsquery('spanish', ${f.q})`);
  if (f.desde) cond.push(sql`${testimonios.created_at} >= ${f.desde}::date`);
  if (f.hasta) cond.push(sql`${testimonios.created_at} < (${f.hasta}::date + 1)`);
  const donde = and(...cond);

  const filas = await db
    .select({
      id: testimonios.id,
      folio: testimonios.folio,
      titulo: testimonios.titulo,
      estado: testimonios.estado,
      activo: testimonios.activo,
      es_publico: testimonios.es_publico,
      origen: testimonios.origen,
      fecha: testimonios.fecha,
      lugar_territorio: testimonios.lugar_territorio,
      entidad: testimonios.entidad,
      municipio: testimonios.municipio,
      autorizacion: testimonios.autorizacion,
      info_sensible: testimonios.info_sensible,
      sensible_accion: testimonios.sensible_accion,
      aparecer_como: testimonios.aparecer_como,
      tipo_geometria: testimonios.tipo_geometria,
      ubicacion_aproximada: testimonios.ubicacion_aproximada,
      centroide: geoJson(testimonios.centroide),
      participante_id: testimonios.participante_id,
      facilitador_nombre: testimonios.facilitador_nombre,
      categoria_id: testimonios.categoria_id,
      categoria_slug: sql<string>`(select slug from categorias c where c.id = ${colDe('testimonios', 'categoria_id')})`,
      expediente_codigo: sql<string>`(select codigo from expedientes e where e.id = ${colDe('testimonios', 'expediente_id')})`,
      relato_resumen: sql<string>`left(${testimonios.relato}, 280)`,
      evidencias_conteo: sql<number>`(select count(*)::int from evidencias ev where ev.testimonio_id = ${colDe('testimonios', 'id')} and ev.activo and ev.estado_subida = 'subida')`,
      reacciones_total: testimonios.reacciones_total,
      comentarios_conteo: testimonios.comentarios_conteo,
      created_at: testimonios.created_at,
      updated_at: testimonios.updated_at,
    })
    .from(testimonios)
    .where(donde)
    .orderBy(f.orden === 'antiguos' ? asc(testimonios.created_at) : desc(testimonios.created_at), desc(testimonios.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  const [conteo] = await db.select({ total: sql<number>`count(*)::int` }).from(testimonios).where(donde);
  return { filas, total: conteo?.total ?? 0 };
}

/* ────────────────────────────────────────── Actualizar ────────────────────────────────────────── */

const MAX_TEXTO_BITACORA = 160;
/** Para la bitácora: los textos largos (relatos) no se copian, solo se indica que cambiaron. */
function resumirParaBitacora(o: Record<string, unknown>) {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === 'ubicacion') r[k] = '[geometría modificada]';
    else if (typeof v === 'string' && v.length > MAX_TEXTO_BITACORA) r[k] = '[texto modificado]';
    else r[k] = v;
  }
  return r;
}

type CambiosInternos = Partial<typeof testimonios.$inferInsert>;

/** Actualiza, registra en la bitácora y emite el evento de mapa si cambió la visibilidad pública. */
async function persistirCambios(c: Ctx, id: string, antes: { es_publico: boolean; folio: string } & Record<string, unknown>, set: CambiosInternos, accion: string, detalle?: unknown) {
  const db = getDb();
  const d = diferencias(antes, set as Record<string, unknown>);
  const [despues] = await db.update(testimonios).set(set).where(eq(testimonios.id, id)).returning({ es_publico: testimonios.es_publico });
  if (!despues) throw E.noEncontrado('Testimonio');
  await registrarBitacora(c, { accion, entidad: 'testimonio', entidadId: id, folio: antes.folio, antes: resumirParaBitacora(d.antes), despues: resumirParaBitacora(d.despues), detalle });
  await emitirCambioDeVisibilidad(id, antes.es_publico, despues.es_publico);
  return despues;
}

export async function emitirCambioDeVisibilidad(id: string, antes: boolean, despues: boolean) {
  if (!antes && !despues) return;
  if (antes && !despues) return emitirEventoMapa('testimonio.retirado', { id });
  const [f] = await getDb()
    .select({
      id: v_testimonios_publicos.id,
      folio: v_testimonios_publicos.folio,
      titulo: v_testimonios_publicos.titulo,
      categoria_slug: v_testimonios_publicos.categoria_slug,
      categoria_color: v_testimonios_publicos.categoria_color,
      tipo_geometria: v_testimonios_publicos.tipo_geometria,
      centroide: geoJson(v_testimonios_publicos.centroide_publico),
    })
    .from(v_testimonios_publicos)
    .where(eq(v_testimonios_publicos.id, id))
    .limit(1);
  if (f) await emitirEventoMapa(antes ? 'testimonio.actualizado' : 'testimonio.publicado', f);
}

/** Convierte los campos de contenido de la API en columnas, resolviendo categoría/expediente. */
async function aColumnas(input: Record<string, unknown>): Promise<CambiosInternos> {
  const { categoria, expediente, nombre_publico, ...resto } = input as Record<string, unknown> & { categoria?: string; expediente?: string; nombre_publico?: string | null };
  const set: Record<string, unknown> = { ...resto };
  if (categoria) set.categoria_id = (await resolverCategoria(categoria, false)).id;
  if (expediente) set.expediente_id = (await resolverExpediente(expediente)).id;
  if (nombre_publico !== undefined) set.nombre_publico = nombre_publico;
  return set as CambiosInternos;
}

/** Links de evidencia: los que ya estaban conservan si son públicos; los nuevos siguen la regla de las fotos. */
function aEnlaces(urls: string[], previos: EnlaceEvidencia[], publicaNueva: boolean): EnlaceEvidencia[] {
  return [...new Set(urls)].map((url) => ({ url, publica: previos.find((e) => e.url === url)?.publica ?? publicaNueva }));
}

/** Garantiza la coherencia nombre público ↔ «cómo desea aparecer» (también lo exige un CHECK en la base). */
function coherenciaNombre(actual: { aparecer_como: string; nombre_publico: string | null }, set: CambiosInternos) {
  const aparecer = (set.aparecer_como ?? actual.aparecer_como) as string;
  if (aparecer === 'anonimo') {
    if (actual.nombre_publico !== null) set.nombre_publico = null;
  } else if (!(set.nombre_publico ?? actual.nombre_publico)) throw E.invalido('Para aparecer con nombre indica "nombre_publico"');
}

export async function editarPropio(c: Ctx, participanteId: string, id: string, input: z.infer<typeof EditarMiTestimonioSchema>) {
  const cfg = await obtenerConfiguracion();
  if (!cfg.participantes_pueden_editar) throw E.prohibido('La edición de testimonios por parte de las personas está deshabilitada');
  const db = getDb();
  const [actual] = await db.select(selDetalle).from(testimonios).where(and(eq(testimonios.id, id), eq(testimonios.participante_id, participanteId))).limit(1);
  if (!actual) throw E.noEncontrado('Testimonio');

  const set = await aColumnas(input);
  coherenciaNombre(actual, set);
  const sensible = set.info_sensible ?? actual.info_sensible;
  const accion = set.sensible_accion ?? actual.sensible_accion;
  if (set.info_sensible === false) set.sensible_accion = null;
  if (sensible && !accion) throw E.invalido('Indica qué hacer con la información sensible');

  // Cualquier edición vuelve a evaluarse: a revisión (por defecto) o según el modo de publicación.
  const decision = decidirPublicacion(cfg.modo_publicacion, {
    autorizacion: (set.autorizacion ?? actual.autorizacion) as never,
    info_sensible: sensible,
    sensible_accion: (set.info_sensible === false ? null : accion) as never,
    info_menores: (set.info_menores ?? actual.info_menores) as boolean,
  });
  set.estado = cfg.edicion_requiere_revision ? 'pendiente' : decision.estado;
  set.motivo_rechazo = null;
  set.moderado_por = null;
  set.moderado_at = set.estado === 'aprobado' ? new Date() : null;
  if (decision.ubicacion_aproximada) set.ubicacion_aproximada = true; // solo se activa; quitarla es decisión del equipo
  if (input.enlaces_evidencia) {
    const multimedia = (set.autoriza_multimedia ?? actual.autoriza_multimedia) as 'si' | 'no' | 'na';
    set.enlaces_evidencia = aEnlaces(input.enlaces_evidencia, actual.enlaces_evidencia, evidenciaPublicaPorDefecto(cfg.modo_publicacion, set.estado, multimedia, 'link'));
  }

  await persistirCambios(c, id, actual, set, 'testimonio.editar_propio');
  return obtenerPropio(participanteId, id);
}

export async function darDeBajaPropio(c: Ctx, participanteId: string, id: string) {
  const cfg = await obtenerConfiguracion();
  if (!cfg.participantes_pueden_eliminar) throw E.prohibido('La baja de testimonios por parte de las personas está deshabilitada');
  const [actual] = await getDb().select(selDetalle).from(testimonios).where(and(eq(testimonios.id, id), eq(testimonios.participante_id, participanteId))).limit(1);
  if (!actual) throw E.noEncontrado('Testimonio');
  await persistirCambios(c, id, actual, { activo: false }, 'testimonio.baja_propia');
}

export async function editarStaff(c: Ctx, usuario: UsuarioAuth, id: string, input: EditarTestimonioStaffInput) {
  const db = getDb();
  const [actual] = await db.select(selDetalle).from(testimonios).where(eq(testimonios.id, id)).limit(1);
  if (!actual) throw E.noEncontrado('Testimonio');

  if (Object.keys(input).length === 0) throw E.invalido('No hay cambios que aplicar');
  const set = await aColumnas(input);
  coherenciaNombre(actual, set);
  if (set.info_sensible === false) set.sensible_accion = null;
  const sensible = set.info_sensible ?? actual.info_sensible;
  if (sensible && !(set.sensible_accion ?? actual.sensible_accion)) throw E.invalido('Indica qué hacer con la información sensible');
  if (set.estado && set.estado !== actual.estado) {
    set.moderado_por = usuario.id;
    set.moderado_at = new Date();
    if (set.estado !== 'rechazado' && set.motivo_rechazo === undefined) set.motivo_rechazo = null;
  }
  if (input.enlaces_evidencia) {
    const cfg = await obtenerConfiguracion();
    const multimedia = (set.autoriza_multimedia ?? actual.autoriza_multimedia) as 'si' | 'no' | 'na';
    set.enlaces_evidencia = aEnlaces(input.enlaces_evidencia, actual.enlaces_evidencia, evidenciaPublicaPorDefecto(cfg.modo_publicacion, (set.estado ?? actual.estado) as string, multimedia, 'link'));
  }
  if (Object.keys(set).length === 0) throw E.invalido('No hay cambios que aplicar');
  await persistirCambios(c, id, actual, set, 'testimonio.editar');
  return obtenerStaff(id);
}

export type AccionModeracion = 'aprobar' | 'rechazar' | 'desaprobar' | 'activar' | 'desactivar';

/** Cambios de estado de moderación y activación (1/0). Quién, cuándo y por qué queda en la bitácora. */
export async function moderar(c: Ctx, usuario: UsuarioAuth, id: string, accion: AccionModeracion, motivo?: string, publicarEvidencias?: boolean) {
  const db = getDb();
  const [actual] = await db.select(selDetalle).from(testimonios).where(eq(testimonios.id, id)).limit(1);
  if (!actual) throw E.noEncontrado('Testimonio');

  const ahora = new Date();
  const mod = { moderado_por: usuario.id, moderado_at: ahora };
  const set: CambiosInternos =
    accion === 'aprobar' ? { estado: 'aprobado', motivo_rechazo: null, ...mod }
    : accion === 'rechazar' ? { estado: 'rechazado', motivo_rechazo: motivo ?? null, ...mod }
    : accion === 'desaprobar' ? { estado: 'pendiente', ...mod }
    : accion === 'activar' ? { activo: true }
    : { activo: false };
  if (accion === 'rechazar' && !motivo) throw E.invalido('Indica el motivo del rechazo');

  await persistirCambios(c, id, actual, set, `testimonio.${accion}`, motivo ? { motivo } : undefined);

  if (accion === 'aprobar') {
    // Al aprobar se puede publicar la multimedia (por defecto, si la persona autorizó foto/audio/video)
    const publicar = publicarEvidencias ?? actual.autoriza_multimedia === 'si';
    if (publicar) {
      await db
        .update(evidencias)
        .set({ publica: true })
        .where(and(eq(evidencias.testimonio_id, id), eq(evidencias.activo, true), eq(evidencias.estado_subida, 'subida'), sql`${evidencias.tipo} not in ('recibo_factura','documento_oficial')`));
      if (actual.enlaces_evidencia.some((e) => !e.publica)) {
        await db.update(testimonios).set({ enlaces_evidencia: actual.enlaces_evidencia.map((e) => ({ ...e, publica: true })) }).where(eq(testimonios.id, id));
      }
    }
  }
  return obtenerStaff(id);
}

/** Hace público o privado un link de evidencia (igual que «Hacer pública» en las fotos). */
export async function publicarEnlace(c: Ctx, id: string, url: string, publica: boolean) {
  const db = getDb();
  const [actual] = await db.select({ folio: testimonios.folio, enlaces: testimonios.enlaces_evidencia }).from(testimonios).where(eq(testimonios.id, id)).limit(1);
  if (!actual) throw E.noEncontrado('Testimonio');
  if (!actual.enlaces.some((e) => e.url === url)) throw E.noEncontrado('Link');
  const enlaces = actual.enlaces.map((e) => (e.url === url ? { ...e, publica } : e));
  await db.update(testimonios).set({ enlaces_evidencia: enlaces }).where(eq(testimonios.id, id));
  await registrarBitacora(c, { accion: 'enlace.editar', entidad: 'testimonio', entidadId: id, folio: actual.folio, despues: { url, publica } });
  return enlaces;
}

/** Borrado DEFINITIVO de la base de datos (y de R2). Solo con confirmación explícita (el folio). */
export async function eliminarPermanente(c: Ctx, id: string) {
  const db = getDb();
  const [t] = await db.select({ id: testimonios.id, folio: testimonios.folio, es_publico: testimonios.es_publico }).from(testimonios).where(eq(testimonios.id, id)).limit(1);
  if (!t) throw E.noEncontrado('Testimonio');
  const archivos = await db.select({ key: evidencias.storage_key }).from(evidencias).where(eq(evidencias.testimonio_id, id));
  for (const a of archivos) {
    try {
      await borrarObjeto(a.key);
    } catch (err) {
      console.error('No se pudo borrar el objeto de R2', a.key, (err as Error).message);
    }
  }
  await db.transaction(async (tx) => {
    await tx.delete(testimonios).where(eq(testimonios.id, id)); // cascada: evidencias, comentarios, reacciones, auditoría
    await registrarBitacora(c, { accion: 'testimonio.eliminar_permanente', entidad: 'testimonio', entidadId: id, folio: t.folio, antes: { folio: t.folio }, detalle: { archivos_borrados: archivos.length } }, tx);
  });
  if (t.es_publico) await emitirEventoMapa('testimonio.retirado', { id });
}
