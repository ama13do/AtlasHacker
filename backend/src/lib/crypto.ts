import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Cifrado de datos personales a nivel aplicación: AES-256-GCM.
 * Formato: v1.<iv>.<tag>.<texto cifrado>  (base64url). El "contexto" (p. ej. "participantes.correo")
 * se autentica como AAD: un valor cifrado no puede copiarse a otra columna sin que falle el descifrado.
 */
const clave = (b64: string) => Buffer.from(b64, 'base64');

export function cifrar(texto: string, contexto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', clave(env().ENCRYPTION_KEY), iv);
  cipher.setAAD(Buffer.from(contexto));
  const ct = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function descifrar(valor: string, contexto: string): string {
  const [version, iv, tag, ct] = valor.split('.');
  if (version !== 'v1' || !iv || !tag || !ct) throw new Error('Formato de dato cifrado no reconocido');
  const claves = [env().ENCRYPTION_KEY, env().ENCRYPTION_KEY_ANTERIOR].filter(Boolean) as string[];
  let ultimo: unknown;
  for (const k of claves) {
    try {
      const d = createDecipheriv('aes-256-gcm', clave(k), Buffer.from(iv, 'base64url'));
      d.setAAD(Buffer.from(contexto));
      d.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
    } catch (e) {
      ultimo = e;
    }
  }
  throw ultimo;
}

export const cifrarOpcional = (v: string | null | undefined, ctx: string) => (v ? cifrar(v, ctx) : null);
export const descifrarOpcional = (v: string | null | undefined, ctx: string) => (v ? descifrar(v, ctx) : null);

/** HMAC-SHA256 con pepper: índice ciego para buscar sin descifrar (correo, teléfono) y para huellas de IP/dispositivo. */
export function hmac(valor: string, dominio: string): string {
  return createHmac('sha256', env().HASH_PEPPER).update(`${dominio}:${valor}`).digest('hex');
}

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export function igualesSeguro(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const normalizarCorreo = (c: string) => c.trim().toLowerCase();
export const normalizarTelefono = (t: string) => t.replace(/[^\d+]/g, '');

export const hashCorreo = (c: string) => hmac(normalizarCorreo(c), 'correo');
export const hashTelefono = (t: string) => hmac(normalizarTelefono(t), 'telefono');
