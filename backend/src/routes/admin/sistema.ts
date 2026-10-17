import { createRoute, z } from '@hono/zod-openapi';
import { and, desc, eq, sql } from 'drizzle-orm';
import { enSerie, getDb } from '../../db/client.js';
import { featureCollection, geoJson } from '../../db/geo.js';
import { bitacora, categorias, expedientes, testimonios } from '../../db/schema.js';
import { descifrarOpcional } from '../../lib/crypto.js';
import { PaginacionOffset } from '../../lib/paginacion.js';
import { requiereUsuario } from '../../middleware/seguridad.js';
import { ERRORES, SEG_USUARIO, Uuid, cuerpo, resp } from '../../schemas/comunes.js';
import { FiltrosStaffQuery } from '../../schemas/testimonios.js';
import { registrarBitacora } from '../../services/bitacora.js';
import { ConfiguracionParcialSchema, actualizarConfiguracion, obtenerConfiguracion } from '../../services/configuracion.js';
import { geografia, resumen, serie } from '../../services/estadisticas.js';
import { nuevoRouter, ok, sinCache } from '../base.js';

export const adminSistema = nuevoRouter();
const TAG_DASH = ['Dashboard · Estadísticas'];
const TAG_CFG = ['Dashboard · Configuración'];
const TAG_BIT = ['Dashboard · Bitácora'];
// Resumen: administración y lectura. Exportar, purgar y la bitácora: solo superadmin (el superadmin pasa siempre)
const RESUMEN = { security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'lector')] };
const ADMIN = { security: SEG_USUARIO, middleware: [requiereUsuario('admin')] };
const SUPERADMIN = { security: SEG_USUARIO, middleware: [requiereUsuario('superadmin')] };

/* ───────────────────────────────────────────── Estadísticas ───────────────────────────────────────────── */

adminSistema.openapi(
  createRoute({
    ...RESUMEN, tags: TAG_DASH, method: 'get', path: '/api/admin/resumen', summary: 'Resumen general del dashboard',
    description: 'Totales por estado, categoría, expediente y origen; personas; comentarios; evidencias; y la serie de los últimos 30 días. Todo en una sola llamada.',
    responses: { 200: resp('Resumen'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    return c.json(ok(await resumen()), 200);
  },
);

adminSistema.openapi(
  createRoute({
    ...RESUMEN, tags: TAG_DASH, method: 'get', path: '/api/admin/estadisticas/serie', summary: 'Serie de tiempo de testimonios',
    request: {
      query: z.object({
        desde: z.iso.date(),
        hasta: z.iso.date(),
        agrupar: z.enum(['dia', 'semana', 'mes']).default('dia'),
        categoria: z.string().max(100).optional().openapi({ description: 'slug' }),
      }),
    },
    responses: { 200: resp('Serie'), ...ERRORES },
  }),
  async (c) => {
    const q = c.req.valid('query');
    return c.json(ok(await serie(q.desde, q.hasta, q.agrupar, q.categoria)), 200);
  },
);

adminSistema.openapi(
  createRoute({
    ...RESUMEN, tags: TAG_DASH, method: 'get', path: '/api/admin/estadisticas/geografia', summary: 'Distribución geográfica (por entidad y celdas)',
    description: 'Usa la ubicación exacta (solo personal). `celda` en grados: 0.25 ≈ 28 km.',
    request: { query: z.object({ celda: z.coerce.number().min(0.01).max(5).default(0.25) }) },
    responses: { 200: resp('Entidades y celdas'), ...ERRORES },
  }),
  async (c) => c.json(ok(await geografia(c.req.valid('query').celda)), 200),
);

adminSistema.openapi(
  createRoute({
    ...SUPERADMIN, tags: TAG_DASH, method: 'get', path: '/api/admin/exportar/testimonios.geojson', summary: 'Exportar testimonios a GeoJSON (QGIS, análisis)',
    description: 'Solo superadmin. Mismos filtros que el listado. Incluye la ubicación EXACTA y los campos de la ficha, sin datos personales de la persona. Máx. 10 000.',
    request: { query: FiltrosStaffQuery },
    responses: { 200: resp('FeatureCollection'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const f = c.req.valid('query');
    const cond = and(
      f.estado ? eq(testimonios.estado, f.estado) : undefined,
      f.activo !== undefined ? eq(testimonios.activo, f.activo) : undefined,
      f.es_publico !== undefined ? eq(testimonios.es_publico, f.es_publico) : undefined,
      f.entidad ? eq(testimonios.entidad, f.entidad) : undefined,
      f.categoria ? sql`${testimonios.categoria_id} = (select id from categorias where slug = ${f.categoria})` : undefined,
      f.expediente ? sql`${testimonios.expediente_id} = (select id from expedientes where codigo = ${f.expediente.toUpperCase()})` : undefined,
      f.desde ? sql`${testimonios.created_at} >= ${f.desde}::date` : undefined,
      f.hasta ? sql`${testimonios.created_at} < (${f.hasta}::date + 1)` : undefined,
    );
    const filas = await getDb()
      .select({
        id: testimonios.id, folio: testimonios.folio, titulo: testimonios.titulo, estado: testimonios.estado, activo: testimonios.activo, es_publico: testimonios.es_publico,
        fecha: testimonios.fecha, lugar_territorio: testimonios.lugar_territorio, entidad: testimonios.entidad, municipio: testimonios.municipio,
        categoria: categorias.slug, expediente: expedientes.codigo, autorizacion: testimonios.autorizacion, info_sensible: testimonios.info_sensible,
        tipo_geometria: testimonios.tipo_geometria, relato: testimonios.relato, territorio_dice: testimonios.territorio_dice, comunidad_dice: testimonios.comunidad_dice,
        dato_fuente_anio: testimonios.dato_fuente_anio, fuentes: testimonios.fuentes, pregunta_tribunal: testimonios.pregunta_tribunal, created_at: testimonios.created_at,
        geometry: geoJson(testimonios.ubicacion),
      })
      .from(testimonios)
      .innerJoin(categorias, eq(categorias.id, testimonios.categoria_id))
      .innerJoin(expedientes, eq(expedientes.id, testimonios.expediente_id))
      .where(cond)
      .orderBy(desc(testimonios.created_at))
      .limit(10000);
    const features = filas.map(({ geometry, ...properties }) => ({ type: 'Feature' as const, id: properties.id, geometry, properties }));
    await registrarBitacora(c, { accion: 'exportar.geojson', entidad: 'testimonio', detalle: { filas: filas.length } });
    return c.json({ success: true as const, data: featureCollection(features) }, 200);
  },
);

/* ───────────────────────────────────────────── Configuración ───────────────────────────────────────────── */

adminSistema.openapi(
  createRoute({
    ...ADMIN, tags: TAG_CFG, method: 'get', path: '/api/admin/configuracion', summary: 'Ver la configuración',
    description:
      '**modo_publicacion**: `revisar_todo` (todo requiere aprobación) · `auto_si_no_sensible` (se publica solo si no hay información sensible) · `auto_todo` (se publica todo sin revisión). ' +
      'En cualquier modo: sin autorización de publicación NO se publica; «revisión antes de publicar» siempre pasa a revisión; «anonimizar» oculta el nombre.',
    responses: { 200: resp('Configuración vigente'), ...ERRORES },
  }),
  async (c) => c.json(ok(await obtenerConfiguracion()), 200),
);

adminSistema.openapi(
  createRoute({
    ...ADMIN, tags: TAG_CFG, method: 'patch', path: '/api/admin/configuracion', summary: 'Cambiar la configuración',
    description: 'Cualquier subconjunto de claves: modo de publicación, máximo de archivos y megas por testimonio, tipos de archivo, captcha, auditoría y retención, comentarios, reacciones, edición por las personas, tiempo real…',
    request: { body: cuerpo(ConfiguracionParcialSchema) }, responses: { 200: resp('Configuración actualizada'), ...ERRORES },
  }),
  async (c) => {
    const cambios = c.req.valid('json');
    const antes = await obtenerConfiguracion();
    const despues = await actualizarConfiguracion(cambios, c.get('usuario')!.id);
    const previo = Object.fromEntries(Object.keys(cambios).map((k) => [k, (antes as Record<string, unknown>)[k]]));
    await registrarBitacora(c, { accion: 'configuracion.editar', entidad: 'configuracion', antes: previo, despues: cambios });
    return c.json(ok(despues), 200);
  },
);

adminSistema.openapi(
  createRoute({
    ...SUPERADMIN, tags: TAG_CFG, method: 'post', path: '/api/admin/mantenimiento/purgar', summary: 'Purgar auditoría vencida, sesiones y límites expirados',
    description: 'Solo superadmin. Borra la auditoría de envío cuya retención ya venció (`auditoria_retencion_dias`) y datos técnicos caducados. Puede ejecutarse periódicamente.',
    responses: { 200: resp('Filas purgadas'), ...ERRORES },
  }),
  async (c) => {
    const db = getDb();
    const [[a], [s]] = await enSerie(
      () => db.execute<{ n: number }>(sql`select purgar_auditoria_vencida() as n`),
      () => db.execute<{ n: number }>(sql`select purgar_sesiones_y_limites() as n`),
    );
    const r = { auditoria: Number(a?.n ?? 0), sesiones_y_limites: Number(s?.n ?? 0) };
    await registrarBitacora(c, { accion: 'mantenimiento.purgar', entidad: 'sistema', detalle: r });
    return c.json(ok(r), 200);
  },
);

/* ─────────────────────────────────────────────── Bitácora ─────────────────────────────────────────────── */

adminSistema.openapi(
  createRoute({
    ...SUPERADMIN, tags: TAG_BIT, method: 'get', path: '/api/admin/bitacora', summary: 'Bitácora: quién hizo qué',
    description:
      'Solo superadmin. Registro de solo-agregar de todo lo que modifican, aprueban, suben o borran usuarios y personas: quién (nombre, correo y rol de ese momento), ' +
      'qué folio, cuándo, desde dónde (IP y navegador) y el antes y el después. La IP se descifra para este endpoint.',
    request: {
      query: z
        .object({
          usuario_id: Uuid.optional(),
          accion: z.string().max(80).optional().openapi({ description: 'Prefijo o exacta, p. ej. testimonio.aprobar o testimonio.' }),
          entidad: z.string().max(40).optional(),
          entidad_id: z.string().max(80).optional(),
          folio: z.string().trim().max(60).optional().openapi({ description: 'Folio del testimonio, p. ej. FUTURO/001-T7K3MQ9X' }),
          desde: z.iso.date().optional(),
          hasta: z.iso.date().optional(),
        })
        .extend(PaginacionOffset.shape),
    },
    responses: { 200: resp('Eventos'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const q = c.req.valid('query');
    const cond = and(
      q.usuario_id ? eq(bitacora.usuario_id, q.usuario_id) : undefined,
      q.accion ? sql`${bitacora.accion} like ${q.accion.replace(/[%_]/g, '\\$&') + '%'}` : undefined,
      q.entidad ? eq(bitacora.entidad, q.entidad) : undefined,
      q.entidad_id ? eq(bitacora.entidad_id, q.entidad_id) : undefined,
      q.folio ? sql`upper(${bitacora.folio}) = ${q.folio.toUpperCase()}` : undefined,
      q.desde ? sql`${bitacora.created_at} >= ${q.desde}::date` : undefined,
      q.hasta ? sql`${bitacora.created_at} < (${q.hasta}::date + 1)` : undefined,
    );
    const db = getDb();
    const [filas, [t]] = await enSerie(
      () => db.select().from(bitacora).where(cond).orderBy(desc(bitacora.created_at), desc(bitacora.id)).limit(q.por_pagina).offset((q.pagina - 1) * q.por_pagina),
      () => db.select({ total: sql<number>`count(*)::int` }).from(bitacora).where(cond),
    );
    const data = filas.map(({ ip_enc, ...f }) => ({ ...f, ip: descifrarOpcional(ip_enc, 'bitacora.ip') }));
    return c.json({ success: true as const, data, total: t?.total ?? 0, pagina: q.pagina, por_pagina: q.por_pagina }, 200);
  },
);

