import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { E } from './errors.js';

let cache: { client: S3Client; bucket: string } | undefined;

function r2() {
  if (!cache) {
    const e = env();
    if (!e.R2_ACCOUNT_ID || !e.R2_ACCESS_KEY_ID || !e.R2_SECRET_ACCESS_KEY || !e.R2_BUCKET_NAME) {
      throw E.noDisponible('El almacenamiento de archivos (R2) no está configurado');
    }
    cache = {
      bucket: e.R2_BUCKET_NAME,
      client: new S3Client({
        region: 'auto',
        endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
      }),
    };
  }
  return cache;
}

/** URL firmada para SUBIR (PUT). El bucket es privado: nada es público hasta que se firma una lectura. */
export async function firmarSubida(key: string, mime: string, bytes: number, segundos = 600): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mime, ContentLength: bytes }), {
    expiresIn: segundos,
  });
}

/** URL firmada y temporal para LEER una evidencia. */
export async function firmarLectura(key: string, nombre?: string | null, segundos = 3600): Promise<string> {
  const { client, bucket } = r2();
  const disposicion = nombre ? `inline; filename*=UTF-8''${encodeURIComponent(nombre)}` : undefined;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: disposicion }), {
    expiresIn: segundos,
  });
}

/** Datos reales del objeto en R2 (o null si no existe). */
export async function inspeccionarObjeto(key: string): Promise<{ bytes: number; mime: string | undefined } | null> {
  const { client, bucket } = r2();
  try {
    const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { bytes: Number(r.ContentLength ?? 0), mime: r.ContentType };
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

export async function borrarObjeto(key: string): Promise<void> {
  const { client, bucket } = r2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
