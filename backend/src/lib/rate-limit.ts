import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { E } from './errors.js';

/**
 * Límite por ventana fija en Postgres (tabla UNLOGGED rate_limits): funciona entre todas las instancias de Lambda.
 * Si la base falla se deja pasar la petición (disponibilidad > límite) y se registra el error.
 */
export async function limitar(clave: string, max: number, ventanaSeg: number, mensaje?: string): Promise<void> {
  let conteo = 0;
  try {
    const filas = await getDb().execute<{ conteo: number }>(sql`
      INSERT INTO rate_limits (clave, ventana, conteo)
      VALUES (${clave}, to_timestamp(floor(extract(epoch from now()) / ${ventanaSeg}::double precision) * ${ventanaSeg}::double precision), 1)
      ON CONFLICT (clave, ventana) DO UPDATE SET conteo = rate_limits.conteo + 1
      RETURNING conteo`);
    conteo = Number(filas[0]?.conteo ?? 0);
  } catch (err) {
    console.error('rate-limit: error de base de datos, se omite el límite', err);
    return;
  }
  if (conteo > max) throw E.limite(mensaje);
}
