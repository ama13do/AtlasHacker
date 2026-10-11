import { OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '../types.js';

/** Router con validación Zod y respuesta de error uniforme cuando los datos no son válidos. */
export const nuevoRouter = () =>
  new OpenAPIHono<AppEnv>({
    defaultHook: (resultado, c) => {
      if (!resultado.success) {
        return c.json(
          { success: false as const, error: { codigo: 'DATOS_INVALIDOS', mensaje: 'Los datos enviados no son válidos', detalles: z.flattenError(resultado.error) } },
          400,
        );
      }
    },
  });

export const ok = <T>(data: T) => ({ success: true as const, data });

/** Datos que no deben quedar en cachés intermedias (folios, datos personales, tokens) */
export const sinCache = (c: { header: (n: string, v: string) => void }) => c.header('Cache-Control', 'no-store');
export const cachePublico = (c: { header: (n: string, v: string) => void }, segundos: number) => c.header('Cache-Control', `public, max-age=${segundos}, s-maxage=${segundos}`);
