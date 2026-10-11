import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  // Las migraciones usan la conexión directa (DIRECT_URL); la API usa el pooler (DATABASE_URL).
  dbCredentials: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? 'postgresql://localhost:5432/atlashacker' },
  strict: true,
  verbose: true,
});
