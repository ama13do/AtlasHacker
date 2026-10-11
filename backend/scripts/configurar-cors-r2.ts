/**
 * Configura el CORS del bucket R2 para que el navegador pueda subir (PUT) y ver (GET) evidencias
 * con las URLs firmadas.   →  npm run r2:cors -- https://atlashacker.vercel.app [http://localhost:5173 ...]
 * Requiere un token de R2 con permiso de administración del bucket (si no, hazlo en el panel de Cloudflare).
 */
import 'dotenv/config';
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';

const origenes = process.argv.slice(2).filter((a) => a.startsWith('http'));
if (origenes.length === 0) {
  console.error('Uso: npm run r2:cors -- https://tu-front.vercel.app [http://localhost:5173]');
  process.exit(1);
}
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
});
try {
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: R2_BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [{ AllowedOrigins: origenes, AllowedMethods: ['PUT', 'GET'], AllowedHeaders: ['Content-Type'], MaxAgeSeconds: 3600 }],
      },
    }),
  );
  const r = await s3.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET_NAME }));
  console.log('CORS de R2 configurado:', JSON.stringify(r.CORSRules));
} catch (err) {
  const e = err as { name?: string; message?: string };
  console.error(`No se pudo configurar el CORS de R2 (${e.name}): ${e.message}`);
  console.error('Hazlo en Cloudflare → R2 → bucket → Settings → CORS policy (ver instrucciones.md).');
  process.exitCode = 1;
}
