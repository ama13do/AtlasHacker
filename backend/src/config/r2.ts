import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const accountId = process.env.R2_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';

export const r2BucketName = process.env.R2_BUCKET_NAME || 'atlashacker-media';
export const r2PublicUrl = process.env.R2_PUBLIC_URL || '';

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.warn(
    '[ADVERTENCIA] Credenciales de Cloudflare R2 incompletas en las variables de entorno.'
  );
}

// Endpoint estándar S3 de Cloudflare R2
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});
