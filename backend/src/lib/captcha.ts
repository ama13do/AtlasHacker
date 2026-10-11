import { env } from '../config/env.js';
import { AppError, E } from './errors.js';

/**
 * Valida un token de Cloudflare Turnstile.
 * - Sin TURNSTILE_SECRET_KEY: en desarrollo se omite (devuelve null); en producción es un error de configuración.
 * - Claves de PRUEBA de Cloudflare (siempre pasan): secret 1x0000000000000000000000000000000AA / sitekey 1x00000000000000000000AA
 */
export async function verificarTurnstile(token: string | undefined, ip: string): Promise<boolean | null> {
  const secreto = env().TURNSTILE_SECRET_KEY;
  if (!secreto) {
    if (env().esProduccion) throw E.noDisponible('Captcha no configurado en el servidor');
    return null;
  }
  if (!token) throw E.invalido('Falta la verificación captcha (cabecera X-Captcha-Token)');

  const cuerpo = new URLSearchParams({ secret: secreto, response: token });
  if (ip && ip !== 'desconocida') cuerpo.set('remoteip', ip);

  let datos: { success?: boolean };
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: cuerpo,
      signal: AbortSignal.timeout(5000),
    });
    datos = (await r.json()) as { success?: boolean };
  } catch (err) {
    console.error('Turnstile: no se pudo verificar', err);
    throw E.noDisponible('No se pudo verificar el captcha, intenta de nuevo');
  }
  if (!datos.success) throw new AppError(400, 'CAPTCHA_INVALIDO', 'Captcha inválido o expirado');
  return true;
}
