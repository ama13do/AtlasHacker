import { drizzle, type PostgresJsDatabase, type PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

export type DB = PostgresJsDatabase<typeof schema>;
/** Acepta tanto la conexión normal como una transacción (tx) */
export type Ejecutor = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

let cliente: ReturnType<typeof postgres> | undefined;
let instancia: DB | undefined;

/**
 * Conexión lazy y reutilizada entre invocaciones de Lambda.
 * - prepare:false → obligatorio con el pooler de Supabase en modo transacción (puerto 6543).
 * - max:1 en Lambda: cada contenedor atiende una petición a la vez; el pooler multiplexa.
 */
export function getDb(): DB {
  if (!instancia) {
    const e = env();
    const enLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
    cliente = postgres(e.DATABASE_URL, {
      max: e.DB_POOL_MAX ?? (enLambda ? 1 : 10),
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: e.DATABASE_SSL ? 'require' : false,
      onnotice: () => {},
    });
    instancia = drizzle(cliente, { schema });
  }
  return instancia;
}

export async function cerrarDb(): Promise<void> {
  await cliente?.end({ timeout: 5 });
  cliente = undefined;
  instancia = undefined;
}

/**
 * Ejecuta consultas UNA TRAS OTRA (conservando los tipos, como un Promise.all).
 * IMPORTANTE: no usar Promise.all con consultas a la base. Con el pooler de Supabase en modo transacción
 * (Supavisor, puerto 6543) y 1 conexión por Lambda, postgres.js envía las consultas en pipeline por la misma
 * conexión y el pooler se queda colgado (la Lambda llega a su timeout).
 */
export async function enSerie<T extends unknown[]>(...tareas: { [K in keyof T]: () => PromiseLike<T[K]> }): Promise<T> {
  const resultados: unknown[] = [];
  for (const tarea of tareas as (() => PromiseLike<unknown>)[]) resultados.push(await tarea());
  return resultados as T;
}
