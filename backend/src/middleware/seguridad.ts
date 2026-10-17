import { eq, and } from 'drizzle-orm';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import { env, initEnv } from '../config/env.js';
import { getDb } from '../db/client.js';
import { participantes, usuarios, type Rol } from '../db/schema.js';
import { hmac } from '../lib/crypto.js';
import { E } from '../lib/errors.js';
import { normalizarFolioParticipante } from '../lib/ids.js';
import { ipCliente } from '../lib/ip.js';
import { limitar } from '../lib/rate-limit.js';
import { verificarTurnstile } from '../lib/captcha.js';
import { obtenerConfiguracion } from '../services/configuracion.js';
import type { AppEnv, UsuarioAuth } from '../types.js';

/** Primer middleware: carga/valida el entorno (cold start), asigna requestId e IP real. */
export const contexto = createMiddleware<AppEnv>(async (c, next) => {
  await initEnv();
  const evento = (c.env as { event?: { requestContext?: { requestId?: string } } } | undefined)?.event;
  c.set('requestId', evento?.requestContext?.requestId ?? crypto.randomUUID());
  c.set('ip', ipCliente(c));
  c.header('X-Request-Id', c.get('requestId'));
  await next();
});

export function tokenBearer(authorization: string | undefined): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
  return m?.[1] ?? null;
}

/** Administración (admin y superadmin): ve datos sensibles y personales, edita, configura y gestiona usuarios. */
export const esAdmin = (u: Pick<UsuarioAuth, 'rol'>) => u.rol === 'admin' || u.rol === 'superadmin';
/** Superadmin: el único que borra definitivamente, exporta y consulta la bitácora. */
export const esSuperadmin = (u: Pick<UsuarioAuth, 'rol'>) => u.rol === 'superadmin';

/**
 * Exige un usuario del dashboard autenticado (JWT) y con alguno de los roles indicados (sin roles = cualquiera).
 * El superadmin pasa siempre: ve y edita todo.
 */
export const requiereUsuario = (...roles: Rol[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const token = tokenBearer(c.req.header('authorization'));
    if (!token) throw E.noAutenticado();

    let sub: string;
    let iat: number;
    try {
      const payload = await verify(token, env().JWT_SECRET, 'HS256');
      if (payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.iat !== 'number') throw new Error();
      sub = payload.sub;
      iat = payload.iat;
    } catch {
      throw E.noAutenticado('Token inválido o expirado');
    }

    // El rol y el estado se leen de la base en cada petición: los cambios y bajas aplican de inmediato.
    const [u] = await getDb().select().from(usuarios).where(eq(usuarios.id, sub)).limit(1);
    if (!u || !u.activo || iat < Math.floor(u.tokens_validos_desde.getTime() / 1000)) throw E.noAutenticado('Sesión no válida');
    if (roles.length > 0 && u.rol !== 'superadmin' && !roles.includes(u.rol)) throw E.prohibido(`Requiere rol: ${roles.join(' o ')}`);

    c.set('usuario', { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol });
    await next();
  });

async function resolverFolio(c: Context<AppEnv>, obligatorio: boolean) {
  const crudo = c.req.header('x-folio');
  if (!crudo) {
    if (obligatorio) throw E.noAutenticado('Falta tu folio (cabecera X-Folio)');
    return;
  }
  const folio = normalizarFolioParticipante(crudo);
  if (!folio) throw E.noAutenticado('Folio con formato inválido');
  await limitar(`folio:${c.get('ip')}`, 40, 60, 'Demasiados intentos con folio');
  const [p] = await getDb()
    .select({ id: participantes.id })
    .from(participantes)
    .where(and(eq(participantes.folio_hash, hmac(folio, 'folio')), eq(participantes.activo, true)))
    .limit(1);
  if (!p) throw E.noAutenticado('Folio no válido');
  c.set('participante', { id: p.id });
}

/** El folio (cabecera X-Folio) es obligatorio: identifica a la persona que aporta. */
export const requiereFolio = createMiddleware<AppEnv>(async (c, next) => {
  await resolverFolio(c, true);
  await next();
});

/** Si viene folio se valida y se asocia; si no, la petición continúa como anónima. */
export const folioOpcional = createMiddleware<AppEnv>(async (c, next) => {
  await resolverFolio(c, false);
  await next();
});

/** Límite de peticiones por IP para una ruta o grupo de rutas. */
export const limite = (nombre: string, max: number, ventanaSeg: number) =>
  createMiddleware<AppEnv>(async (c, next) => {
    await limitar(`${nombre}:${c.get('ip')}`, max, ventanaSeg);
    await next();
  });

async function resolverCaptcha(c: Context<AppEnv>) {
  if ((await obtenerConfiguracion()).captcha_requerido) {
    const ok = await verificarTurnstile(c.req.header('x-captcha-token'), c.get('ip'));
    c.set('captchaOk', ok ?? undefined);
  }
}

/** Cloudflare Turnstile (cabecera X-Captcha-Token). Se puede apagar desde la configuración del dashboard. */
export const captcha = createMiddleware<AppEnv>(async (c, next) => {
  await resolverCaptcha(c);
  await next();
});

/**
 * Entrada pública de escritura (subir testimonio, comentar): límite por IP + folio opcional + captcha.
 * Se combinan en un solo middleware (en este orden: lo barato primero).
 */
export const aportePublico = (nombre: string, max: number, ventanaSeg: number) =>
  createMiddleware<AppEnv>(async (c, next) => {
    await limitar(`${nombre}:${c.get('ip')}`, max, ventanaSeg);
    await resolverFolio(c, false);
    await resolverCaptcha(c);
    await next();
  });

/** Identificador anónimo de dispositivo para likes/reacciones (HMAC; nunca se guarda el dato original). */
export function huellaDispositivo(c: { req: { header: (n: string) => string | undefined }; get: (k: 'ip') => string }): string {
  const id = c.req.header('x-device-id')?.slice(0, 100);
  return id ? hmac(id, 'dispositivo') : hmac(`${c.get('ip')}|${c.req.header('user-agent') ?? ''}`, 'dispositivo');
}
