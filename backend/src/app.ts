import { swaggerUI } from '@hono/swagger-ui';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { etag } from 'hono/etag';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { env, esOrigenPermitido } from './config/env.js';
import { limpiarCache } from './lib/cache.js';
import { AppError } from './lib/errors.js';
import { contexto } from './middleware/seguridad.js';
import { adminCatalogos } from './routes/admin/catalogos.js';
import { adminComentarios } from './routes/admin/comentarios.js';
import { adminEventos } from './routes/admin/eventos.js';
import { adminParticipantes } from './routes/admin/participantes.js';
import { adminSistema } from './routes/admin/sistema.js';
import { adminTestimonios } from './routes/admin/testimonios.js';
import { adminUsuarios } from './routes/admin/usuarios.js';
import { auth } from './routes/auth.js';
import { nuevoRouter } from './routes/base.js';
import { participante } from './routes/participante.js';
import { publico } from './routes/publico.js';
import { verificarCredenciales } from './services/auth.js';
import type { AppEnv } from './types.js';

export const app = nuevoRouter();

/* ─────────────────────────────────────────── Middlewares globales ─────────────────────────────────────────── */

app.use('*', contexto); // entorno, requestId, IP real (debe ir primero)
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    // Lista blanca de orígenes (CORS_ORIGINS, subdominios de Vercel y localhost).
    origin: (origin) => (esOrigenPermitido(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Folio', 'X-Captcha-Token', 'X-Device-Id'],
    exposeHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 86400,
  }),
);
// gzip: el GeoJSON del mapa viaja ~8 veces más ligero. ETag: si nada cambió, el navegador recibe un 304 vacío
app.use('*', compress());
app.use('/api/*', etag({ weak: true }));
// Una escritura vacía la caché de lecturas públicas de este contenedor (salvo el contador de /ir y las sesiones,
// que no cambian nada público: con la lona escaneándose sin parar, la caché nunca serviría)
app.use('/api/*', async (c, next) => {
  await next();
  if (c.req.method !== 'GET' && c.res.status < 400 && c.req.path !== '/api/ir' && !c.req.path.startsWith('/api/auth/')) limpiarCache();
});
app.use(
  '/api/*',
  bodyLimit({
    maxSize: 1024 * 1024, // 1 MB de JSON; los archivos van directo a R2 con URL firmada
    onError: (c) => c.json({ success: false, error: { codigo: 'CUERPO_DEMASIADO_GRANDE', mensaje: 'La petición excede 1 MB' } }, 413),
  }),
);

/* ───────────────────────────────────────── Documentación (Swagger protegido) ───────────────────────────────────────── */

/**
 * /docs exige HTTP Basic con un usuario ACTIVO del dashboard (cualquier rol). Reutiliza los mismos límites de intentos
 * y bloqueo de cuenta que el login. Con DOCS_ENABLED=false desaparece por completo.
 */
const protegerDocs = createMiddleware<AppEnv>(async (c, next) => {
  if (!env().DOCS_ENABLED) return c.notFound();
  const m = /^Basic\s+(.+)$/i.exec(c.req.header('authorization') ?? '');
  if (m) {
    const [email = '', ...resto] = Buffer.from(m[1]!, 'base64').toString('utf8').split(':');
    try {
      await verificarCredenciales(email, resto.join(':'), c.get('ip'));
      return next();
    } catch (err) {
      if (!(err instanceof AppError) || err.status !== 401) throw err;
    }
  }
  return c.text('Autenticación requerida', 401, { 'WWW-Authenticate': 'Basic realm="AtlasHacker API docs", charset="UTF-8"' });
});

app.use('/docs', protegerDocs);
app.use('/docs/*', protegerDocs);

app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Access token de `POST /api/auth/login` (dura pocos minutos; se renueva con `/api/auth/refresh`).',
});
app.openAPIRegistry.registerComponent('securitySchemes', 'folioAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'X-Folio',
  description: 'Folio de la persona que aporta (P-XXXX-XXXX-XXXX-XXXX). Se entrega una sola vez al subir el primer testimonio.',
});

app.doc31('/docs/openapi.json', () => ({
  openapi: '3.1.0',
  info: {
    title: 'AtlasHacker API · Tribunal Popular por Nuestro Futuro',
    version: '2.0.0',
    description: [
      'API del mapa de testimonios y del dashboard de moderación.',
      '',
      '**Zonas**',
      '- **Público** (`/api/mapa`, `/api/testimonios`…): lo que ve cualquier persona; solo testimonios aprobados y autorizados.',
      '- **Mi folio** (`/api/mis-testimonios`, `/api/mi-perfil`): la persona que aporta, con su folio en `X-Folio`.',
      '- **Dashboard** (`/api/admin/*`): usuarios con rol (admin, moderador, facilitador, lector), con `Authorization: Bearer`.',
      '',
      '**Tiempo real**: el mapa escucha el canal privado `mapa` de Supabase Realtime (eventos `testimonio.publicado`, `testimonio.actualizado`, `testimonio.retirado`).',
      '',
      '**Formato**: éxito `{ success: true, data, ... }` · error `{ success: false, error: { codigo, mensaje, detalles? } }`.',
      '**Geometrías**: GeoJSON, SRID 4326, `[longitud, latitud]`.',
    ].join('\n'),
  },
  servers: [{ url: env().PUBLIC_API_URL ?? `http://localhost:${env().PORT}` }],
  tags: [
    { name: 'Sistema' },
    { name: 'Mapa público' },
    { name: 'Testimonios (público)' },
    { name: 'Comentarios y reacciones' },
    { name: 'Mi folio (persona que aporta)' },
    { name: 'Autenticación (dashboard)' },
    { name: 'Dashboard · Estadísticas' },
    { name: 'Dashboard · Testimonios' },
    { name: 'Dashboard · Evidencias' },
    { name: 'Dashboard · Personas (folios)' },
    { name: 'Dashboard · Comentarios' },
    { name: 'Dashboard · Categorías' },
    { name: 'Dashboard · Expedientes' },
    { name: 'Dashboard · Usuarios y roles' },
    { name: 'Dashboard · Enlace /ir y eventos' },
    { name: 'Dashboard · Configuración' },
    { name: 'Dashboard · Bitácora' },
  ],
}));
app.get('/docs', swaggerUI({ url: 'docs/openapi.json', persistAuthorization: true }));

/* ─────────────────────────────────────────────────── Rutas ─────────────────────────────────────────────────── */

app.get('/', (c) => c.json({ nombre: 'AtlasHacker API', estado: 'online' }));
app.route('/', publico);
app.route('/', participante);
app.route('/', auth);
app.route('/', adminSistema);
app.route('/', adminTestimonios);
app.route('/', adminParticipantes);
app.route('/', adminComentarios);
app.route('/', adminCatalogos);
app.route('/', adminUsuarios);
app.route('/', adminEventos);

/* ────────────────────────────────────────────── 404 y errores ────────────────────────────────────────────── */

app.notFound((c) => c.json({ success: false, error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: 'Ruta no encontrada' } }, 404));

type ErrorPg = { code?: string; message?: string };

/** Mensaje apto para logs: los errores de Drizzle incluyen el SQL y sus parámetros (testimonios, datos personales), así que se usa solo la causa. */
function mensajeSeguro(err: unknown): string {
  const causa = (err as { cause?: ErrorPg }).cause;
  if (causa?.code || causa?.message) return `${causa.code ?? ''} ${causa.message ?? ''}`.trim();
  if ((err as Error).name === 'DrizzleQueryError') return 'DrizzleQueryError';
  return (err as Error).message;
}

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ success: false, error: { codigo: err.codigo, mensaje: err.message, ...(err.detalles ? { detalles: err.detalles } : {}) } }, err.status as ContentfulStatusCode);
  }
  if (err instanceof HTTPException) {
    return c.json({ success: false, error: { codigo: 'HTTP_' + err.status, mensaje: err.message } }, err.status);
  }
  // Rechazos de la base por reglas de datos (geometría inválida, CHECK, enum/uuid mal formado) = petición inválida, no fallo del servidor
  const pg = ((err as { cause?: ErrorPg }).cause ?? (err as ErrorPg)).code;
  if (pg === '22023' || pg === '23514' || pg === '22P02') {
    return c.json({ success: false, error: { codigo: 'DATOS_INVALIDOS', mensaje: 'Los datos enviados no cumplen las reglas del sistema' } }, 400);
  }
  console.error(JSON.stringify({ nivel: 'error', request_id: c.get('requestId'), metodo: c.req.method, ruta: c.req.path, error: mensajeSeguro(err), pila: (err as Error).stack?.split('\n').slice(0, 6) }));
  return c.json({ success: false, error: { codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor', request_id: c.get('requestId') } }, 500);
});
