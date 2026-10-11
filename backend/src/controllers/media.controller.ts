import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, r2BucketName, r2PublicUrl } from '../config/r2.js';
import { z } from 'zod';
import type { Context } from 'hono';

const presignedSchema = z.object({
  filename: z.string().min(1, 'El nombre de archivo es obligatorio'),
  contentType: z.string().min(1, 'El contentType es obligatorio'),
  folder: z.enum(['testimonios', 'audios', 'imagenes', 'videos']).default('testimonios'),
});

export const obtenerPresignedUrl = async (c: Context) => {
  try {
    const body = await c.req.json();
    const parseResult = presignedSchema.safeParse(body);

    if (!parseResult.success) {
      return c.json(
        { error: 'Datos de entrada inválidos', detalles: parseResult.error.flatten() },
        400
      );
    }

    const { filename, contentType, folder } = parseResult.data;

    // Sanitizar nombre de archivo y agregar timestamp + random id
    const extension = filename.includes('.') ? filename.split('.').pop() : '';
    const cleanName = filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.[^/.]+$/, '');
    const uniqueKey = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${cleanName}${extension ? `.${extension}` : ''}`;

    const command = new PutObjectCommand({
      Bucket: r2BucketName,
      Key: uniqueKey,
      ContentType: contentType,
    });

    // URL firmada con validez de 15 minutos (900 segundos)
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

    // URL pública final para guardar en la base de datos
    const fileUrl = r2PublicUrl
      ? `${r2PublicUrl.replace(/\/$/, '')}/${uniqueKey}`
      : `https://${r2BucketName}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${uniqueKey}`;

    return c.json({
      success: true,
      uploadUrl,
      fileUrl,
      key: uniqueKey,
      expiresInSeconds: 900,
    });
  } catch (error: any) {
    console.error('Error generando Presigned URL de R2:', error);
    return c.json(
      { error: 'No se pudo generar la URL de subida', message: error?.message || 'Error desconocido' },
      500
    );
  }
};
