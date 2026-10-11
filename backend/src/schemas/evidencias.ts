import { z } from '@hono/zod-openapi';
import { TIPOS_EVIDENCIA } from '../db/schema.js';
import { Uuid } from './comunes.js';

export const PresignEvidenciasSchema = z
  .object({
    archivos: z
      .array(
        z.object({
          nombre: z.string().trim().min(1).max(200).openapi({ example: 'recibo-cfe-marzo.pdf' }),
          mime: z.string().max(100).openapi({ example: 'application/pdf' }),
          bytes: z.number().int().positive().openapi({ description: 'Tamaño exacto en bytes' }),
          tipo: z.enum(TIPOS_EVIDENCIA),
          descripcion: z.string().trim().max(500).optional(),
        }),
      )
      .min(1)
      .max(10),
  })
  .openapi('PresignEvidencias');
export type PresignEvidenciasInput = z.infer<typeof PresignEvidenciasSchema>;

export const EvidenciaParams = z.object({
  id: Uuid.openapi({ param: { name: 'id', in: 'path' }, description: 'Id del testimonio' }),
  evidenciaId: Uuid.openapi({ param: { name: 'evidenciaId', in: 'path' } }),
});

export const EditarEvidenciaSchema = z
  .object({
    publica: z.boolean(),
    activo: z.boolean(),
    descripcion: z.string().trim().max(500).nullable(),
    tipo: z.enum(TIPOS_EVIDENCIA),
  })
  .partial()
  .openapi('EditarEvidencia');
