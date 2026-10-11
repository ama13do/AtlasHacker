import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

/**
 * IP real del cliente. En Lambda se toma de API Gateway (requestContext), que no es falsificable.
 * NO se confía en X-Forwarded-For: lo puede enviar cualquiera.
 */
export function ipCliente(c: Context): string {
  const evento = (c.env as { event?: { requestContext?: { http?: { sourceIp?: string }; identity?: { sourceIp?: string } } } } | undefined)?.event;
  const ip = evento?.requestContext?.http?.sourceIp ?? evento?.requestContext?.identity?.sourceIp;
  if (ip) return ip;
  try {
    return getConnInfo(c).remote.address ?? 'desconocida';
  } catch {
    return 'desconocida';
  }
}
