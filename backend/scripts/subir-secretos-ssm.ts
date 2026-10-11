/**
 * Sube los secretos del .env a AWS Systems Manager Parameter Store (SecureString, cifrados con KMS).
 *   npm run secretos:subir -- --stage prod --set CORS_ORIGINS=https://atlashacker.vercel.app
 * --set CLAVE=valor (repetible) sube ese valor en lugar del del .env (p. ej. CORS solo con el dominio de producción).
 * La Lambda los lee en runtime desde /atlashacker/<stage>/<NOMBRE> (ver SSM_PREFIX en serverless.yml),
 * así NO quedan como variables de entorno visibles en la consola de Lambda.
 *
 * Usa las credenciales de AWS de tu máquina (aws configure o variables AWS_*). Solo necesita permiso ssm:PutParameter.
 */
import 'dotenv/config';
import { PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const CLAVES = [
  'DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY', 'ENCRYPTION_KEY_ANTERIOR', 'HASH_PEPPER',
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME',
  'TURNSTILE_SECRET_KEY', 'CORS_ORIGINS', 'PUBLIC_API_URL', 'DOCS_ENABLED',
];

const sobrescritos: Record<string, string> = {};
process.argv.forEach((a, j) => {
  if (a === '--set') {
    const [k, ...v] = (process.argv[j + 1] ?? '').split('=');
    if (k) sobrescritos[k] = v.join('=');
  }
});

const i = process.argv.indexOf('--stage');
const stage = i >= 0 ? process.argv[i + 1] : 'dev';
const region = process.env.AWS_REGION ?? 'us-west-2';
const prefijo = `/atlashacker/${stage}`;
const ssm = new SSMClient({ region });

let subidos = 0;
for (const clave of CLAVES) {
  const valor = sobrescritos[clave] ?? process.env[clave];
  if (!valor) {
    console.log(`  - ${clave}: (vacío, se omite)`);
    continue;
  }
  await ssm.send(new PutParameterCommand({ Name: `${prefijo}/${clave}`, Value: valor, Type: 'SecureString', Overwrite: true }));
  console.log(`  ✓ ${prefijo}/${clave}`);
  subidos++;
}
console.log(`\n${subidos} parámetros guardados en ${prefijo} (${region}).`);
