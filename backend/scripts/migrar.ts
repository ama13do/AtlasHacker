/**
 * Aplica las migraciones de /drizzle a la base de datos.  →  npm run db:migrate
 * Usa DIRECT_URL (conexión directa o pooler en modo sesión); si no existe, DATABASE_URL.
 * Las migraciones son idempotentes entre ejecuciones: drizzle guarda cuáles ya se aplicaron.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DIRECT_URL (o DATABASE_URL) en backend/.env');
  process.exit(1);
}

const ssl = process.env.DATABASE_SSL === 'false' ? false : 'require';
const cliente = postgres(url, { max: 1, ssl, prepare: false, onnotice: (n) => console.log('  ·', n.message) });

try {
  const host = new URL(url).host;
  console.log(`Aplicando migraciones en ${host} ...`);
  await migrate(drizzle(cliente), { migrationsFolder: './drizzle' });
  console.log('Migraciones aplicadas.');
} catch (err) {
  console.error('Error aplicando migraciones:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await cliente.end({ timeout: 5 });
}
