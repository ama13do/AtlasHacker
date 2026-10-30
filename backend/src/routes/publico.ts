import { createRoute, z } from '@hono/zod-openapi';
import { TIPOS_REACCION } from '../db/schema.js';
import { hmac } from '../lib/crypto.js';
import { claveDe, enCache } from '../lib/cache.js';
import { AppError } from '../lib/errors.js';
import { limitar } from '../lib/rate-limit.js';
import { aportePublico, huellaDispositivo, limite } from '../middleware/seguridad.js';
import { ERRORES, IdParam, SEG_FOLIO_OPCIONAL, Uuid, cuerpo, resp } from '../schemas/comunes.js';
import { PaginacionCursor } from '../lib/paginacion.js';
import { CrearTestimonioSchema, FiltrosPublicosQuery, MapaQuery } from '../schemas/testimonios.js';
import { asistenteDisponible, responderAsistente } from '../services/asistente.js';
import { configuracionPublica, obtenerConfiguracion } from '../services/configuracion.js';
import { catalogosPublicos, colaboradoresPublicos, detallePublico, estadisticasPublicas, listarPublicos, mapaPublico } from '../services/publico.js';
import { comentar, likeComentario, listarComentariosPublicos, misReacciones, quitarLikeComentario, quitarReaccion, reaccionar } from '../services/social.js';
import { esRobot, registrarVisita } from '../services/ir.js';
import { crearTestimonio } from '../services/testimonios.js';
import { cachePublico, nuevoRouter, ok, sinCache } from './base.js';
import { enSerie } from '../db/client.js';

export const publico = nuevoRouter();
const TAG_MAPA = ['Mapa público'];
const TAG_TESTIMONIOS = ['Testimonios (público)'];
const TAG_SOCIAL = ['Comentarios y reacciones'];

/* ───────────────────────────────────────────── Salud y configuración ───────────────────────────────────────────── */

publico.openapi(
  createRoute({ method: 'get', path: '/health', tags: ['Sistema'], summary: 'Estado de la API', responses: { 200: resp('API en línea') } }),
  (c) => c.json(ok({ estado: 'online', timestamp: new Date().toISOString() }), 200),
);

publico.openapi(
  createRoute({
    method: 'get', path: '/api/config', tags: TAG_MAPA, summary: 'Configuración pública, categorías y expedientes',
    description: 'Todo lo que el frontend necesita para armar el formulario y el mapa: categorías, expedientes, límites de archivos, si pide captcha, etc.',
    responses: { 200: resp('Catálogos y configuración'), ...ERRORES },
  }),
  async (c) => {
    cachePublico(c, 60);
    const datos = await enCache('config', 60, async () => {
      const [cat, cfg] = await enSerie(() => catalogosPublicos(), () => obtenerConfiguracion());
      return { ...cat, configuracion: { ...configuracionPublica(cfg), asistente_ia: asistenteDisponible() } };
    });
    return c.json(ok(datos), 200);
  },
);

publico.openapi(
  createRoute({ method: 'get', path: '/api/estadisticas', tags: TAG_MAPA, summary: 'Contadores públicos', responses: { 200: resp('Totales por categoría y entidad'), ...ERRORES } }),
  async (c) => {
    cachePublico(c, 30);
    return c.json(ok(await estadisticasPublicas()), 200);
  },
);

publico.openapi(
  createRoute({
    method: 'get', path: '/api/colaboradores', tags: TAG_MAPA, summary: 'Personas con perfil público',
    description: 'Solo personas que eligieron hacer público su perfil, con el nombre que decidieron mostrar y su número de testimonios publicados.',
    responses: { 200: resp('Lista de colaboradores'), ...ERRORES },
  }),
  async (c) => {
    cachePublico(c, 60);
    return c.json(ok(await enCache('colaboradores', 60, colaboradoresPublicos)), 200);
  },
);

/* ──────────────────────────────────────── Enlace /ir (QR impreso) ──────────────────────────────────────── */

publico.openapi(
  createRoute({
    method: 'post', path: '/api/ir', tags: ['Sistema'], summary: 'Contar una visita al enlace /ir (QR de la lona)',
    description:
      'La página atlashacker.hxnf.mx/ir llama aquí y manda a la portada. Una fila por hora (no por visita). ' +
      'Persona distinta = misma IP + mismo dispositivo (`X-Device-Id`) una vez al día. Robots y previsualizaciones no cuentan. Nunca falla: si algo sale mal, la visita solo no se cuenta.',
    responses: { 200: resp('Visita registrada (o ignorada)', z.object({ contada: z.boolean() })) },
  }),
  async (c) => {
    sinCache(c);
    if (esRobot(c.req.header('user-agent'))) return c.json(ok({ contada: false }), 200);
    try {
      // Tope por IP: una red de evento con mucha gente cabe holgada; un script que recarga, no
      await limitar(`ir:${c.get('ip')}`, 300, 3600);
      await registrarVisita(hmac(`${c.get('ip')}|${c.req.header('x-device-id')?.slice(0, 100) ?? c.req.header('user-agent') ?? ''}`, 'ir'));
      return c.json(ok({ contada: true }), 200);
    } catch (err) {
      if (!(err instanceof AppError)) console.error('ir: no se pudo contar la visita', err);
      return c.json(ok({ contada: false }), 200);
    }
  },
);

/* ────────────────────────────────────────────────── Mapa ────────────────────────────────────────────────── */

publico.openapi(
  createRoute({
    method: 'get', path: '/api/mapa', tags: TAG_MAPA, summary: 'Testimonios para el mapa (GeoJSON)',
    description:
      'FeatureCollection GeoJSON de los testimonios públicos. Filtra por la caja visible (`bbox`), por radio (`lat`,`lng`,`radio` en metros), categoría, expediente, fechas o texto. ' +
      'Con `geometria=punto` (default) cada testimonio es un pin; con `simple`/`completa` se devuelven líneas y polígonos. Las ubicaciones marcadas como aproximadas ya vienen generalizadas.',
    request: { query: MapaQuery },
    responses: { 200: resp('GeoJSON FeatureCollection'), ...ERRORES },
  }),
  async (c) => {
    cachePublico(c, 15);
    const q = c.req.valid('query');
    const fc = await enCache(claveDe('mapa', q), 20, () => mapaPublico(q));
    return c.json({ success: true as const, data: fc }, 200);
  },
);

/* ─────────────────────────────────────────────── Testimonios ─────────────────────────────────────────────── */

publico.openapi(
  createRoute({
    method: 'get', path: '/api/testimonios', tags: TAG_TESTIMONIOS, summary: 'Listado público paginado',
    description: 'Paginación por cursor (rápida y estable): pasa `siguiente_cursor` como `cursor` para la página siguiente.',
    request: { query: FiltrosPublicosQuery.extend(PaginacionCursor.shape) },
    responses: { 200: resp('Página de testimonios'), ...ERRORES },
  }),
  async (c) => {
    cachePublico(c, 15);
    const q = c.req.valid('query');
    const { limite: lim, cursor, ...filtros } = q;
    const r = await enCache(claveDe('listado', q), 20, () => listarPublicos(filtros, lim, cursor));
    return c.json({ success: true as const, data: r.items, siguiente_cursor: r.siguiente_cursor }, 200);
  },
);

publico.openapi(
  createRoute({
    method: 'get', path: '/api/testimonios/{id}', tags: TAG_TESTIMONIOS, summary: 'Detalle de un testimonio público',
    description: 'Incluye la ficha completa pública y las evidencias autorizadas con URLs firmadas temporales (1 h).',
    request: { params: IdParam }, responses: { 200: resp('Testimonio'), ...ERRORES },
  }),
  async (c) => {
    c.header('Cache-Control', 'private, max-age=30');
    const { id } = c.req.valid('param');
    return c.json(ok(await enCache(`ficha:${id}`, 20, () => detallePublico(id))), 200);
  },
);

publico.openapi(
  createRoute({
    method: 'post', path: '/api/testimonios', tags: TAG_TESTIMONIOS, summary: 'Subir un testimonio (ficha completa)',
    description:
      '**Cualquier persona** puede subir un testimonio, aunque sea anónima. \n\n' +
      '- Sin cabecera `X-Folio`: se crea la persona y la respuesta incluye su **folio** (`participante.folio`). **Se muestra una sola vez**: debe guardarlo. En la base solo queda su hash.\n' +
      '- Con `X-Folio`: el testimonio se asocia a esa persona (así se sabe cuántos aporta).\n' +
      '- Requiere captcha Cloudflare Turnstile en la cabecera `X-Captcha-Token` (si está activado en la configuración).\n' +
      '- Si el testimonio queda pendiente, un moderador lo aprueba antes de salir en el mapa. El modo (revisar todo / automático) es configurable.\n' +
      '- Después de crearlo, se suben las evidencias con `POST /api/mis-testimonios/{id}/evidencias`.',
    middleware: aportePublico('crear-testimonio', 10, 3600),
    request: { body: cuerpo(CrearTestimonioSchema) },
    security: SEG_FOLIO_OPCIONAL,
    responses: { 201: resp('Testimonio creado'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const r = await crearTestimonio(c, c.req.valid('json'), { origen: 'web', participanteId: c.get('participante')?.id });
    return c.json(
      ok({
        testimonio: { id: r.id, folio: r.folio, estado: r.estado, publicado: r.es_publico },
        participante: r.folio_participante
          ? { folio: r.folio_participante, aviso: 'Guarda este folio: es tu llave para subir más testimonios y editar los tuyos. No se muestra otra vez. Si lo pierdes, escribe al equipo para recuperarlo.' }
          : null,
        mensaje: r.es_publico ? 'Tu testimonio ya está publicado en el mapa.' : 'Recibimos tu testimonio. Será revisado antes de publicarse.',
      }),
      201,
    );
  },
);

/* ───────────────────────────────────────── Comentarios, likes y reacciones ───────────────────────────────────────── */

const ComentarioSchema = z.object({
  contenido: z.string().trim().min(1).max(2000),
  autor_nombre: z.string().trim().max(100).optional().openapi({ description: 'Opcional; si se omite, aparece como anónimo.' }),
});

publico.openapi(
  createRoute({
    method: 'get', path: '/api/testimonios/{id}/comentarios', tags: TAG_SOCIAL, summary: 'Comentarios de un testimonio',
    description: 'Paginación por cursor (más antiguos primero). Con la cabecera `X-Device-Id` se indica en `le_di_like` cuáles comentarios ya likeó ese dispositivo.',
    request: { params: IdParam, query: PaginacionCursor }, responses: { 200: resp('Comentarios'), ...ERRORES },
  }),
  async (c) => {
    const { limite: lim, cursor } = c.req.valid('query');
    const r = await listarComentariosPublicos(c.req.valid('param').id, lim, cursor, huellaDispositivo(c));
    return c.json({ success: true as const, data: r.items, siguiente_cursor: r.siguiente_cursor }, 200);
  },
);

publico.openapi(
  createRoute({
    method: 'post', path: '/api/testimonios/{id}/comentarios', tags: TAG_SOCIAL, summary: 'Comentar un testimonio',
    description: 'Con captcha. Si se envía `X-Folio` el comentario queda ligado a esa persona. Según la configuración, puede quedar pendiente de moderación.',
    middleware: aportePublico('comentar', 20, 3600),
    request: { params: IdParam, body: cuerpo(ComentarioSchema) },
    security: SEG_FOLIO_OPCIONAL,
    responses: { 201: resp('Comentario creado'), ...ERRORES },
  }),
  async (c) => {
    const r = await comentar(c, c.req.valid('param').id, c.req.valid('json'), huellaDispositivo(c));
    return c.json(ok(r), 201);
  },
);

const ComentarioIdParam = z.object({ id: Uuid.openapi({ param: { name: 'id', in: 'path' }, description: 'Id del comentario' }) });

publico.openapi(
  createRoute({
    method: 'post', path: '/api/comentarios/{id}/likes', tags: TAG_SOCIAL, summary: 'Dar like a un comentario',
    description: 'Un like por dispositivo (cabecera `X-Device-Id`; si no se envía se usa IP + user-agent). Es idempotente.',
    middleware: [limite('likes', 120, 600)], request: { params: ComentarioIdParam }, responses: { 200: resp('likes_conteo actualizado'), ...ERRORES },
  }),
  async (c) => c.json(ok(await likeComentario(c.req.valid('param').id, huellaDispositivo(c))), 200),
);

publico.openapi(
  createRoute({
    method: 'delete', path: '/api/comentarios/{id}/likes', tags: TAG_SOCIAL, summary: 'Quitar el like a un comentario',
    middleware: [limite('likes', 120, 600)], request: { params: ComentarioIdParam }, responses: { 200: resp('likes_conteo actualizado'), ...ERRORES },
  }),
  async (c) => c.json(ok(await quitarLikeComentario(c.req.valid('param').id, huellaDispositivo(c))), 200),
);

const ReaccionBody = z.object({ tipo: z.enum(TIPOS_REACCION).default('like') });
const ReaccionParams = z.object({
  id: Uuid.openapi({ param: { name: 'id', in: 'path' } }),
  tipo: z.enum(TIPOS_REACCION).openapi({ param: { name: 'tipo', in: 'path' } }),
});

publico.openapi(
  createRoute({
    method: 'post', path: '/api/testimonios/{id}/reacciones', tags: TAG_SOCIAL, summary: 'Reaccionar a un testimonio (like, apoyo, alerta, fuego)',
    middleware: [limite('reacciones', 120, 600)], request: { params: IdParam, body: cuerpo(ReaccionBody) }, responses: { 200: resp('Contadores actualizados'), ...ERRORES },
  }),
  async (c) => c.json(ok(await reaccionar(c.req.valid('param').id, c.req.valid('json').tipo, huellaDispositivo(c))), 200),
);

publico.openapi(
  createRoute({
    method: 'delete', path: '/api/testimonios/{id}/reacciones/{tipo}', tags: TAG_SOCIAL, summary: 'Quitar una reacción',
    middleware: [limite('reacciones', 120, 600)], request: { params: ReaccionParams }, responses: { 200: resp('Contadores actualizados'), ...ERRORES },
  }),
  async (c) => {
    const { id, tipo } = c.req.valid('param');
    return c.json(ok(await quitarReaccion(id, tipo, huellaDispositivo(c))), 200);
  },
);

publico.openapi(
  createRoute({
    method: 'get', path: '/api/testimonios/{id}/reacciones/mias', tags: TAG_SOCIAL, summary: 'Reacciones de este dispositivo',
    request: { params: IdParam }, responses: { 200: resp('Tipos de reacción ya dados'), ...ERRORES },
  }),
  async (c) => c.json(ok(await misReacciones(c.req.valid('param').id, huellaDispositivo(c))), 200),
);

/* ───────────────────────────────────── Asistente de IA (pregunta al Tribunal) ───────────────────────────────────── */

const texto = (max: number) => z.string().trim().max(max).optional();
const AsistenteSchema = z
  .object({
    contexto: z.object({
      hechos: z.array(z.string().max(60)).max(8).optional(),
      lugar: texto(300),
      desde_cuando: texto(40),
      sigue_pasando: texto(20),
      titulo: texto(200),
      relato: texto(1500),
      pregunta: texto(1000),
    }),
    mensajes: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(1500) })).min(1).max(16),
  })
  .openapi('AsistentePregunta');

publico.openapi(
  createRoute({
    method: 'post', path: '/api/asistente/pregunta', tags: TAG_TESTIMONIOS, summary: 'Asistente para escribir la pregunta al Tribunal (IA)',
    description: 'Solo funciona si está encendido (`configuracion.asistente_ia` en /api/config). No guarda la conversación. Límite por IP y diario.',
    middleware: [limite('asistente', 30, 600)], request: { body: cuerpo(AsistenteSchema) }, responses: { 200: resp('Respuesta del asistente'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const { contexto, mensajes } = c.req.valid('json');
    if (!asistenteDisponible()) throw new AppError(503, 'NO_DISPONIBLE', 'El asistente no está disponible');
    await limitar('asistente:dia', 1000, 86400, 'El asistente llegó a su límite de hoy. Escribe tu pregunta tú misma o tú mismo.');
    return c.json(ok({ texto: await responderAsistente(contexto, mensajes) }), 200);
  },
);
