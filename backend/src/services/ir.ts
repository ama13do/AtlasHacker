import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';

/**
 * Enlace /ir (el QR impreso en la lona): un solo enlace para todos los eventos. Cada visita suma a la fila de su
 * hora; un evento es solo un horario, así que sus números salen de sumar las horas que caen dentro.
 * Persona distinta = misma IP + mismo dispositivo, contada una vez al día (hora de la Ciudad de México).
 */
const ZONA = 'America/Mexico_City';

/** Previsualizadores y robots: no son personas escaneando */
const ROBOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|skype|headless|lighthouse|curl|wget|python|go-http/i;
export const esRobot = (ua: string | undefined) => !ua || ROBOT.test(ua);

/** Una sola consulta: marca la huella del día (si es nueva, cuenta como persona distinta) y suma a la hora actual. */
export async function registrarVisita(huella: string): Promise<void> {
  await getDb().execute(sql`
    WITH nueva AS (
      INSERT INTO ir_vistos (huella, dia) VALUES (${huella}, (now() AT TIME ZONE ${ZONA})::date)
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    INSERT INTO ir_visitas (hora, total, unicos) VALUES (date_trunc('hour', now()), 1, (SELECT count(*) FROM nueva))
    ON CONFLICT (hora) DO UPDATE SET total = ir_visitas.total + 1, unicos = ir_visitas.unicos + excluded.unicos`);
}

type Conteo = { total: number; unicos: number };
export type EventoConVisitas = {
  id: string; nombre: string; lugar: string | null; inicio: string; fin: string; created_at: string; updated_at: string;
} & Conteo;

// La hora en que empieza el evento cuenta completa (si empieza 10:30, cuenta desde 10:00)
const DENTRO = sql`v.hora >= date_trunc('hour', e.inicio) AND v.hora < e.fin`;

/** Eventos con sus visitas, visitas fuera de cualquier evento, totales y la serie diaria de los últimos `dias`. */
export async function resumenEventos(dias: number) {
  const db = getDb();
  const eventos = await db.execute<EventoConVisitas>(sql`
    SELECT e.id, e.nombre, e.lugar, e.inicio, e.fin, e.created_at, e.updated_at,
           coalesce(sum(v.total), 0)::int AS total, coalesce(sum(v.unicos), 0)::int AS unicos
    FROM eventos e LEFT JOIN ir_visitas v ON ${DENTRO}
    GROUP BY e.id
    ORDER BY e.inicio DESC`);
  const [totales] = await db.execute<{ total: number; unicos: number; hoy_total: number; hoy_unicos: number; fuera_total: number; fuera_unicos: number; primera: string | null }>(sql`
    SELECT coalesce(sum(v.total), 0)::int AS total,
           coalesce(sum(v.unicos), 0)::int AS unicos,
           coalesce(sum(v.total) FILTER (WHERE (v.hora AT TIME ZONE ${ZONA})::date = (now() AT TIME ZONE ${ZONA})::date), 0)::int AS hoy_total,
           coalesce(sum(v.unicos) FILTER (WHERE (v.hora AT TIME ZONE ${ZONA})::date = (now() AT TIME ZONE ${ZONA})::date), 0)::int AS hoy_unicos,
           coalesce(sum(v.total) FILTER (WHERE NOT EXISTS (SELECT 1 FROM eventos e WHERE ${DENTRO})), 0)::int AS fuera_total,
           coalesce(sum(v.unicos) FILTER (WHERE NOT EXISTS (SELECT 1 FROM eventos e WHERE ${DENTRO})), 0)::int AS fuera_unicos,
           min(v.hora) AS primera
    FROM ir_visitas v`);
  const serie = await db.execute<{ dia: string } & Conteo>(sql`
    WITH dias AS (
      SELECT generate_series((now() AT TIME ZONE ${ZONA})::date - ${dias - 1}::int, (now() AT TIME ZONE ${ZONA})::date, interval '1 day')::date AS dia
    )
    SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia, coalesce(sum(v.total), 0)::int AS total, coalesce(sum(v.unicos), 0)::int AS unicos
    FROM dias d LEFT JOIN ir_visitas v ON (v.hora AT TIME ZONE ${ZONA})::date = d.dia
    GROUP BY d.dia
    ORDER BY d.dia`);
  const t = totales!;
  return {
    total: { total: t.total, unicos: t.unicos },
    hoy: { total: t.hoy_total, unicos: t.hoy_unicos },
    fuera_de_evento: { total: t.fuera_total, unicos: t.fuera_unicos },
    primera_visita: t.primera,
    eventos: [...eventos],
    serie: [...serie],
  };
}

/** Visitas por hora de un evento (para ver a qué hora escanearon más). */
export async function horasDeEvento(id: string) {
  return [
    ...(await getDb().execute<{ hora: string } & Conteo>(sql`
      SELECT v.hora, v.total, v.unicos
      FROM eventos e JOIN ir_visitas v ON ${DENTRO}
      WHERE e.id = ${id}
      ORDER BY v.hora`)),
  ];
}
