import { createRoute, z } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { env, esOrigenPermitido } from '../config/env.js';
import { getDb } from '../db/client.js';
import { usuarios, type Usuario } from '../db/schema.js';
import { AppError, E } from '../lib/errors.js';
import { requiereUsuario } from '../middleware/seguridad.js';
import { ERRORES, SEG_USUARIO, cuerpo, resp } from '../schemas/comunes.js';
import { PasswordSchema, buscarUsuarioPorEmail, cambiarPassword, cerrarSesion, datosUsuarioPublico, iniciarSesion, refrescarSesion } from '../services/auth.js';
import { registrarBitacora } from '../services/bitacora.js';
import type { AppEnv } from '../types.js';
import { nuevoRouter, ok, sinCache } from './base.js';

export const auth = nuevoRouter();
const TAG = ['Autenticación (dashboard)'];

const LoginSchema = z.object({ email: z.email().max(200), password: z.string().min(1).max(200) }).openapi('Login');

const comoActor = (c: Context<AppEnv>, u: Pick<Usuario, 'id' | 'email' | 'nombre' | 'rol'>) => c.set('usuario', { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol });

/** El refresh token viaja en cookie httpOnly: solo se acepta desde los orígenes permitidos (defensa CSRF). */
function exigirOrigenPermitido(origin: string | undefined) {
  if (origin && !esOrigenPermitido(origin)) throw E.prohibido('Origen no permitido');
}

auth.openapi(
  createRoute({
    method: 'post', path: '/api/auth/login', tags: TAG, summary: 'Iniciar sesión',
    description:
      'Devuelve un **access token** JWT de corta duración (`Authorization: Bearer ...`) y deja un **refresh token** en cookie `httpOnly`. ' +
      'Protegido con límite de intentos, bloqueo temporal de cuenta y respuesta genérica (no revela si el correo existe).',
    request: { body: cuerpo(LoginSchema) },
    responses: { 200: resp('Sesión iniciada'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    exigirOrigenPermitido(c.req.header('origin'));
    const { email, password } = c.req.valid('json');
    let r: Awaited<ReturnType<typeof iniciarSesion>>;
    try {
      r = await iniciarSesion(c, email, password);
    } catch (err) {
      // Intento fallido sobre una cuenta que existe: queda en la bitácora (sin la contraseña). Si el correo no existe no se guarda nada.
      if (err instanceof AppError && err.status !== 429) {
        const u = await buscarUsuarioPorEmail(email);
        if (u) await registrarBitacora(c, { accion: 'auth.login_fallido', entidad: 'usuario', entidadId: u.id, detalle: { email: u.email, motivo: err.codigo } });
      }
      throw err;
    }
    comoActor(c, r.usuario);
    await registrarBitacora(c, { accion: 'auth.login', entidad: 'usuario', entidadId: r.usuario.id });
    return c.json(ok({ access_token: r.token, token_type: 'Bearer' as const, expira_en_segundos: r.expira_en, usuario: datosUsuarioPublico(r.usuario) }), 200);
  },
);

auth.openapi(
  createRoute({
    method: 'post', path: '/api/auth/refresh', tags: TAG, summary: 'Renovar el access token',
    description: 'Usa la cookie de refresh. Cada refresh se rota: reutilizar uno viejo invalida toda la sesión.',
    responses: { 200: resp('Nuevo access token'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    exigirOrigenPermitido(c.req.header('origin'));
    const r = await refrescarSesion(c);
    return c.json(ok({ access_token: r.token, token_type: 'Bearer' as const, expira_en_segundos: r.expira_en, usuario: datosUsuarioPublico(r.usuario) }), 200);
  },
);

auth.openapi(
  createRoute({ method: 'post', path: '/api/auth/logout', tags: TAG, summary: 'Cerrar sesión', responses: { 200: resp('Sesión cerrada'), ...ERRORES } }),
  async (c) => {
    exigirOrigenPermitido(c.req.header('origin'));
    const usuarioId = await cerrarSesion(c);
    const [u] = usuarioId ? await getDb().select().from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1) : [];
    if (u) {
      comoActor(c, u);
      await registrarBitacora(c, { accion: 'auth.logout', entidad: 'usuario', entidadId: u.id });
    }
    return c.json(ok({ cerrada: true }), 200);
  },
);

auth.openapi(
  createRoute({
    method: 'get', path: '/api/auth/me', tags: TAG, summary: 'Usuario actual', security: SEG_USUARIO, middleware: [requiereUsuario()],
    responses: { 200: resp('Usuario'), ...ERRORES },
  }),
  (c) => {
    sinCache(c);
    return c.json(ok(c.get('usuario')!), 200);
  },
);

const CambiarPasswordSchema = z.object({ password_actual: z.string().min(1).max(200), password_nueva: PasswordSchema }).openapi('CambiarPassword');

auth.openapi(
  createRoute({
    method: 'post', path: '/api/auth/cambiar-password', tags: TAG, summary: 'Cambiar mi contraseña',
    description: 'Mínimo 12 caracteres con mayúsculas, minúsculas y números. Cierra todas las sesiones abiertas; hay que iniciar sesión de nuevo.',
    security: SEG_USUARIO, middleware: [requiereUsuario()], request: { body: cuerpo(CambiarPasswordSchema) }, responses: { 200: resp('Contraseña actualizada'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const u = c.get('usuario')!;
    const { password_actual, password_nueva } = c.req.valid('json');
    await cambiarPassword(u.id, password_actual, password_nueva);
    await registrarBitacora(c, { accion: 'auth.cambiar_password', entidad: 'usuario', entidadId: u.id });
    await cerrarSesion(c);
    return c.json(ok({ actualizada: true, mensaje: 'Inicia sesión de nuevo' }), 200);
  },
);
