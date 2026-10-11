/**
 * Verifica que backend/.env sea válido (sin mostrar ningún secreto).  →  npm run entorno:verificar
 */
import { initEnv } from '../src/config/env.js';

try {
  const e = await initEnv();
  const host = new URL(e.DATABASE_URL);
  const si = (v: unknown) => (v ? 'sí' : 'NO');
  console.log('Entorno válido ✓');
  console.log(`  Base de datos : ${host.hostname}:${host.port}  ${host.port === '6543' ? '(pooler transacción: ideal para Lambda)' : host.port === '5432' ? '(conexión directa/sesión: úsala para migraciones; para Lambda usa el pooler 6543)' : ''}`);
  if (/^db\.[a-z0-9]+\.supabase\.co$/.test(host.hostname)) {
    console.log('  ⚠ Ese host es la conexión DIRECTA de Supabase: solo tiene IPv6, y AWS Lambda (y muchas redes) no la alcanzan.');
    console.log('    En Supabase → Connect → "Transaction pooler" copia la cadena (aws-0-<región>.pooler.supabase.com:6543) y úsala en DATABASE_URL;');
    console.log('    para migraciones usa "Session pooler" (puerto 5432) en DIRECT_URL.');
  }
  console.log(`  Secretos      : JWT ${si(e.JWT_SECRET)} · cifrado ${si(e.ENCRYPTION_KEY)} · pepper ${si(e.HASH_PEPPER)}`);
  console.log(`  R2            : ${si(e.R2_BUCKET_NAME && e.R2_ACCESS_KEY_ID)}`);
  console.log(`  Realtime      : ${si(e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY)}`);
  console.log(`  Captcha       : ${e.TURNSTILE_SECRET_KEY ? 'Turnstile configurado' : 'sin TURNSTILE_SECRET_KEY (en desarrollo se omite; en producción es obligatorio)'}`);
  console.log(`  CORS          : ${e.corsOrigins.join(', ')}`);
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
}
