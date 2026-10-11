import type { Context } from 'hono';
import { bitacora } from '../db/schema.js';
import { getDb, type Ejecutor } from '../db/client.js';
import { cifrar } from '../lib/crypto.js';
import type { AppEnv } from '../types.js';

type Ctx = Context<AppEnv>;

export type EntradaBitacora = {
  accion: string; // p. ej. testimonio.aprobar
  entidad: string; // p. ej. testimonio
  entidadId?: string | null;
  antes?: unknown;
  despues?: unknown;
  detalle?: unknown;
};

/**
 * Registra QUIÉN hizo QUÉ (y el antes/después). La tabla es append-only (un trigger impide UPDATE/DELETE).
 * Nunca guardar aquí valores de datos personales: solo nombres de campos o ids.
 */
export async function registrarBitacora(c: Ctx, e: EntradaBitacora, ejecutor: Ejecutor = getDb()): Promise<void> {
  const usuario = c.get('usuario');
  const participante = c.get('participante');
  const ip = c.get('ip');
  await ejecutor.insert(bitacora).values({
    actor_tipo: usuario ? 'usuario' : participante ? 'participante' : 'anonimo',
    usuario_id: usuario?.id ?? null,
    usuario_email: usuario?.email ?? null,
    participante_id: participante?.id ?? null,
    accion: e.accion,
    entidad: e.entidad,
    entidad_id: e.entidadId ?? null,
    antes: (e.antes ?? null) as never,
    despues: (e.despues ?? null) as never,
    detalle: (e.detalle ?? null) as never,
    ip_enc: ip && ip !== 'desconocida' ? cifrar(ip, 'bitacora.ip') : null,
    user_agent: c.req.header('user-agent')?.slice(0, 300) ?? null,
    request_id: c.get('requestId'),
  });
}

/** Devuelve solo los campos que cambiaron, como { antes, despues } (para la bitácora). */
export function diferencias(antes: Record<string, unknown>, cambios: Record<string, unknown>) {
  const a: Record<string, unknown> = {};
  const d: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cambios)) {
    if (v === undefined) continue;
    if (JSON.stringify(antes[k]) !== JSON.stringify(v)) {
      a[k] = antes[k] ?? null;
      d[k] = v;
    }
  }
  return { antes: a, despues: d, cambio: Object.keys(d).length > 0 };
}
