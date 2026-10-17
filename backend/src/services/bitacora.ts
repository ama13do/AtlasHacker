import { sql } from 'drizzle-orm';
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
  folio?: string | null; // del testimonio afectado; si se omite se busca a partir de la entidad (testimonio, evidencia o comentario)
  antes?: unknown;
  despues?: unknown;
  detalle?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Folio del testimonio afectado (también para sus evidencias y comentarios). */
async function folioDe(ejecutor: Ejecutor, entidad: string, id: string): Promise<string | null> {
  if (!UUID.test(id)) return null;
  const consulta =
    entidad === 'testimonio' ? sql`select folio from testimonios where id = ${id}`
    : entidad === 'evidencia' ? sql`select t.folio from evidencias e join testimonios t on t.id = e.testimonio_id where e.id = ${id}`
    : entidad === 'comentario' ? sql`select t.folio from comentarios c join testimonios t on t.id = c.testimonio_id where c.id = ${id}`
    : null;
  if (!consulta) return null;
  const [fila] = await ejecutor.execute<{ folio: string }>(consulta);
  return fila?.folio ?? null;
}

/**
 * Registra QUIÉN hizo QUÉ (y el antes/después), cuándo y desde dónde (IP cifrada y navegador). La tabla es
 * append-only (un trigger impide UPDATE/DELETE). Nunca guardar aquí valores de datos personales: solo nombres de campos o ids.
 */
export async function registrarBitacora(c: Ctx, e: EntradaBitacora, ejecutor: Ejecutor = getDb()): Promise<void> {
  const usuario = c.get('usuario');
  const participante = c.get('participante');
  const ip = c.get('ip');
  const folio = e.folio !== undefined ? e.folio : e.entidadId ? await folioDe(ejecutor, e.entidad, e.entidadId) : null;
  await ejecutor.insert(bitacora).values({
    actor_tipo: usuario ? 'usuario' : participante ? 'participante' : 'anonimo',
    usuario_id: usuario?.id ?? null,
    usuario_email: usuario?.email ?? null,
    usuario_nombre: usuario?.nombre ?? null,
    usuario_rol: usuario?.rol ?? null,
    participante_id: participante?.id ?? null,
    accion: e.accion,
    entidad: e.entidad,
    entidad_id: e.entidadId ?? null,
    folio,
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
