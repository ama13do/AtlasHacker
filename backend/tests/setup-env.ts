// Entorno aislado para pruebas: NUNCA se lee backend/.env (AWS_LAMBDA_FUNCTION_NAME desactiva dotenv),
// así los tests no pueden tocar Supabase, R2 ni Cloudflare reales.
process.env.AWS_LAMBDA_FUNCTION_NAME = 'tests';
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5999/postgres',
  DATABASE_SSL: 'false',
  DB_POOL_MAX: '1',
  JWT_SECRET: 'test-jwt-secret-test-jwt-secret-test-jwt-secret',
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  HASH_PEPPER: 'test-pepper-test-pepper-test-pepper-test-pepper',
  CORS_ORIGINS: 'http://localhost:5173',
  SUPABASE_URL: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  TURNSTILE_SECRET_KEY: '',
  // Credenciales FALSAS: sirven para firmar URLs (cálculo local, sin red)
  R2_ACCOUNT_ID: 'cuentadeprueba',
  R2_ACCESS_KEY_ID: 'AKIAPRUEBA',
  R2_SECRET_ACCESS_KEY: 'secretodeprueba',
  R2_BUCKET_NAME: 'bucket-prueba',
});
