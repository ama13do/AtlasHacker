import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  crearTestimonio,
  listarTestimonios,
  obtenerTestimonioPorId,
} from './controllers/testimonios.controller.js';
import { obtenerPresignedUrl } from './controllers/media.controller.js';
import {
  agregarComentario,
  listarComentarios,
} from './controllers/comentarios.controller.js';
import { agregarReaccion } from './controllers/reacciones.controller.js';

export const app = new Hono();

// Middlewares globales
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*', // Se puede restringir al dominio de frontend en producción
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
);

// Ruta de Salud / Healthcheck
app.get('/', (c) => {
  return c.json({
    nombre: 'AtlasHacker API',
    version: '1.0.0',
    estado: 'online',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', uptime: process.uptime() });
});

// Rutas de Testimonios
app.post('/api/testimonios', crearTestimonio);
app.get('/api/testimonios', listarTestimonios);
app.get('/api/testimonios/:id', obtenerTestimonioPorId);

// Rutas de Comentarios
app.post('/api/testimonios/:id/comentarios', agregarComentario);
app.get('/api/testimonios/:id/comentarios', listarComentarios);

// Rutas de Reacciones
app.post('/api/testimonios/:id/reacciones', agregarReaccion);

// Rutas de Media (Cloudflare R2 Presigned Upload URLs)
app.post('/api/media/presigned-url', obtenerPresignedUrl);

// Manejo de rutas no encontradas (404)
app.notFound((c) => {
  return c.json({ error: 'Ruta no encontrada', path: c.req.path }, 404);
});

// Manejo global de errores
app.onError((err, c) => {
  console.error('Error no capturado:', err);
  return c.json(
    {
      error: 'Error interno del servidor',
      message: err.message || 'Error desconocido',
    },
    500
  );
});
