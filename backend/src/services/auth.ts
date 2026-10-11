import { randomBytes, randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign } from 'hono/jwt';
import { z } from '@hono/zod-openapi';
import { env } from '../config/env.js';
import { getDb } from '../db/client.js';
import { sesiones, usuarios, type Usuario } from '../db/schema.js';
import { hmac, sha256 } from '../lib/crypto.js';
import { E } from '../lib/errors.js';
import { hashPassword, verificacionFalsa, verificarPassword } from '../lib/passwords.js';
import { limitar } from '../lib/rate-limit.js';
import type { AppEnv } from '../types.js';

type Ctx = Context<AppEnv>;

export const COOKIE_REFRESH = 'atlas_rt';
const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;

export const PasswordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .max(128)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), 'Debe incluir mayúsculas, minúsculas y números');

export const normalizarEmail = (e: string) => e.trim().toLowerCase();

export async function buscarUsuarioPorEmail(email: string): Promise<Usuario | undefined> {
  const [u] = await getDb().select().from(usuarios).where(sql`lower(${usuarios.email}) = ${normalizarEmail(email)}`).limit(1);
  return u;
}

/**
 * Verifica correo + contraseña con: límite por IP y por correo, bloqueo temporal tras 5 fallos,
 * tiempo constante cuando el usuario no existe y mensaje genérico (no revela qué falló).
 */
export async function verificarCredenciales(email: string, password: string, ip: string): Promise<Usuario> {
  await limitar(`login:ip:${ip}`, 30, 900, 'Demasiados intentos de inicio de sesión desde esta red');
  await limitar(`login:email:${hmac(normalizarEmail(email), 'login')}`, 10, 900, 'Demasiados intentos para esta cuenta');

  const usuario = await buscarUsuarioPorEmail(email);
  if (!usuario) {
    await verificacionFalsa(password);
    throw E.credenciales();
  }
  if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > new Date()) {
    throw E.bloqueado('Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde.');
  }
  const ok = await verificarPassword(password, usuario.password_hash);
  if (!ok || !usuario.activo) {
    if (!ok) {
      const intentos = usuario.intentos_fallidos + 1;
      await getDb()
        .update(usuarios)
        .set(
          intentos >= MAX_INTENTOS
            ? { intentos_fallidos: 0, bloqueado_hasta: new Date(Date.now() + BLOQUEO_MIN * 60_000) }
            : { intentos_fallidos: intentos },
        )
        .where(eq(usuarios.id, usuario.id));
    }
    throw E.credenciales();
  }
  if (usuario.intentos_fallidos > 0 || usuario.bloqueado_hasta) {
    await getDb().update(usuarios).set({ intentos_fallidos: 0, bloqueado_hasta: null }).where(eq(usuarios.id, usuario.id));
  }
  return usuario;
}

export async function emitirAccessToken(usuarioId: string) {
  const ahora = Math.floor(Date.now() / 1000);
  const ttl = env().ACCESS_TTL_MIN * 60;
  const token = await sign({ sub: usuarioId, typ: 'access', iat: ahora, exp: ahora + ttl }, env().JWT_SECRET, 'HS256');
  return { token, expira_en: ttl };
}

function cookieOpciones() {
  const prod = env().esProduccion;
  return {
    httpOnly: true,
    secure: prod,
    sameSite: (prod ? 'None' : 'Lax') as 'None' | 'Lax',
    // Front (vercel.app) y API (amazonaws.com) son sitios distintos: la cookie es "de terceros".
    // Partitioned (CHIPS) permite que siga funcionando en navegadores que bloquean cookies de terceros sin particionar.
    partitioned: prod,
    path: '/api/auth',
    maxAge: env().REFRESH_TTL_DIAS * 86400,
  };
}

async function crearRefresh(c: Ctx, usuarioId: string, familiaId: string = randomUUID()) {
  const plano = randomBytes(48).toString('base64url');
  const [fila] = await getDb()
    .insert(sesiones)
    .values({
      usuario_id: usuarioId,
      familia_id: familiaId,
      token_hash: sha256(plano),
      expira_en: new Date(Date.now() + env().REFRESH_TTL_DIAS * 86400_000),
      user_agent: c.req.header('user-agent')?.slice(0, 300) ?? null,
      ip_hash: hmac(c.get('ip'), 'ip'),
    })
    .returning({ id: sesiones.id });
  setCookie(c, COOKIE_REFRESH, plano, cookieOpciones());
  return fila!.id;
}

export const datosUsuarioPublico = (u: Usuario) => ({
  id: u.id,
  email: u.email,
  nombre: u.nombre,
  rol: u.rol,
  debe_cambiar_password: u.debe_cambiar_password,
});

export async function iniciarSesion(c: Ctx, email: string, password: string) {
  const usuario = await verificarCredenciales(email, password, c.get('ip'));
  await getDb().update(usuarios).set({ ultimo_login_at: new Date() }).where(eq(usuarios.id, usuario.id));
  await crearRefresh(c, usuario.id);
  const acceso = await emitirAccessToken(usuario.id);
  return { usuario, ...acceso };
}

/** Rotación: cada refresh se usa una sola vez. Reutilizar uno ya usado revoca toda la familia (token robado). */
export async function refrescarSesion(c: Ctx) {
  const plano = getCookie(c, COOKIE_REFRESH);
  if (!plano) throw E.noAutenticado('Sesión no iniciada');
  const db = getDb();
  const [s] = await db.select().from(sesiones).where(eq(sesiones.token_hash, sha256(plano))).limit(1);
  if (!s || s.expira_en < new Date()) {
    deleteCookie(c, COOKIE_REFRESH, cookieOpciones());
    throw E.noAutenticado('Sesión expirada');
  }
  if (s.revocada_at) {
    // Margen de 15 s para dos pestañas refrescando a la vez; fuera de él es reutilización sospechosa.
    if (Date.now() - s.revocada_at.getTime() > 15_000) {
      await db.update(sesiones).set({ revocada_at: new Date() }).where(and(eq(sesiones.familia_id, s.familia_id), isNull(sesiones.revocada_at)));
    }
    deleteCookie(c, COOKIE_REFRESH, cookieOpciones());
    throw E.noAutenticado('Sesión inválida');
  }
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, s.usuario_id)).limit(1);
  if (!usuario || !usuario.activo) throw E.noAutenticado('Cuenta inactiva');

  const nuevoId = await crearRefresh(c, usuario.id, s.familia_id);
  await db.update(sesiones).set({ revocada_at: new Date(), reemplazada_por: nuevoId }).where(eq(sesiones.id, s.id));
  const acceso = await emitirAccessToken(usuario.id);
  return { usuario, ...acceso };
}

export async function cerrarSesion(c: Ctx) {
  const plano = getCookie(c, COOKIE_REFRESH);
  if (plano) {
    const db = getDb();
    const [s] = await db.select({ familia_id: sesiones.familia_id }).from(sesiones).where(eq(sesiones.token_hash, sha256(plano))).limit(1);
    if (s) await db.update(sesiones).set({ revocada_at: new Date() }).where(and(eq(sesiones.familia_id, s.familia_id), isNull(sesiones.revocada_at)));
  }
  deleteCookie(c, COOKIE_REFRESH, cookieOpciones());
}

/** Cierra todas las sesiones de un usuario: revoca refresh tokens e invalida los access tokens ya emitidos. */
export async function revocarSesionesDeUsuario(usuarioId: string) {
  const db = getDb();
  await db.update(sesiones).set({ revocada_at: new Date() }).where(and(eq(sesiones.usuario_id, usuarioId), isNull(sesiones.revocada_at)));
  await db.update(usuarios).set({ tokens_validos_desde: new Date() }).where(eq(usuarios.id, usuarioId));
}

export async function cambiarPassword(usuarioId: string, actual: string, nueva: string) {
  const db = getDb();
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1);
  if (!u || !(await verificarPassword(actual, u.password_hash))) throw E.credenciales();
  await db
    .update(usuarios)
    .set({ password_hash: await hashPassword(nueva), debe_cambiar_password: false, password_cambiada_at: new Date() })
    .where(eq(usuarios.id, usuarioId));
  await revocarSesionesDeUsuario(usuarioId);
}
