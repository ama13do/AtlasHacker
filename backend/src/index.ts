import { handle } from 'hono/aws-lambda';
import { app } from './app.js';
import { initEnv } from './config/env.js';
import { getDb } from './db/client.js';
import { sql } from 'drizzle-orm';

// Handler principal para AWS Lambda + API Gateway (HTTP API)
export const handler = handle(app);

/** Tarea programada (1 vez al día): purga auditoría vencida (según la retención configurada), sesiones y límites expirados. */
export const mantenimiento = async () => {
  await initEnv();
  const db = getDb();
  const [a] = await db.execute<{ n: number }>(sql`select purgar_auditoria_vencida() as n`);
  const [s] = await db.execute<{ n: number }>(sql`select purgar_sesiones_y_limites() as n`);
  console.log(JSON.stringify({ tarea: 'mantenimiento', auditoria_purgada: a?.n ?? 0, sesiones_y_limites_purgados: s?.n ?? 0 }));
};
