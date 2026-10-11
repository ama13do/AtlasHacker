import { env } from '../config/env.js';
import { obtenerConfiguracion } from '../services/configuracion.js';

export type EventoMapa = 'testimonio.publicado' | 'testimonio.actualizado' | 'testimonio.retirado';

/**
 * Emite un evento al canal PRIVADO del mapa con Supabase Realtime (Broadcast por REST).
 * Solo el servidor (service_role) puede emitir; los clientes únicamente escuchan (ver política en la migración).
 * El payload lleva solo datos ya públicos. Nunca interrumpe la operación principal.
 */
export async function emitirEventoMapa(evento: EventoMapa, payload: Record<string, unknown>): Promise<void> {
  const e = env();
  if (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    if (!(await obtenerConfiguracion()).mapa_tiempo_real) return;
    const r = await fetch(`${e.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: e.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ topic: e.REALTIME_TOPIC, event: evento, payload, private: true }] }),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) console.warn(`realtime: Supabase respondió ${r.status}`);
  } catch (err) {
    console.warn('realtime: no se pudo emitir el evento', (err as Error).message);
  }
}
