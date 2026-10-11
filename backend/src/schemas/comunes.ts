import { z } from '@hono/zod-openapi';

export const Uuid = z.uuid();

export const IdParam = z.object({
  id: Uuid.openapi({ param: { name: 'id', in: 'path' }, example: '5b2f2c1e-6a3c-4d0b-9a77-0c1f6f6f3a10' }),
});

/* ───────────── GeoJSON (puntos, líneas y polígonos; SRID 4326, orden [longitud, latitud]) ───────────── */

const Posicion = z
  .array(z.number().finite())
  .min(2)
  .max(3)
  .refine(([x, y]) => x! >= -180 && x! <= 180 && y! >= -90 && y! <= 90, 'Coordenada fuera de rango: usa [longitud, latitud]');
const Linea = z.array(Posicion).min(2).max(10000);
const Anillo = z
  .array(Posicion)
  .min(4)
  .max(10000)
  .refine((a) => {
    const p = a[0]!;
    const u = a[a.length - 1]!;
    return p[0] === u[0] && p[1] === u[1];
  }, 'El anillo del polígono debe cerrarse (primer y último punto iguales)');
const Poligono = z.array(Anillo).min(1).max(50);

export const GeometriaSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('Point'), coordinates: Posicion }),
    z.object({ type: z.literal('LineString'), coordinates: Linea }),
    z.object({ type: z.literal('Polygon'), coordinates: Poligono }),
    z.object({ type: z.literal('MultiPoint'), coordinates: z.array(Posicion).min(1).max(1000) }),
    z.object({ type: z.literal('MultiLineString'), coordinates: z.array(Linea).min(1).max(200) }),
    z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(Poligono).min(1).max(100) }),
  ])
  .openapi({
    description: 'Geometría GeoJSON exacta (Point, LineString, Polygon o sus versiones Multi). Coordenadas [longitud, latitud].',
    example: { type: 'Point', coordinates: [-99.1332, 19.4326] },
  });

/* ───────────────────────────────────────── Respuestas ───────────────────────────────────────── */

export const ErrorSchema = z
  .object({
    success: z.literal(false),
    error: z.object({ codigo: z.string(), mensaje: z.string(), detalles: z.unknown().optional() }),
  })
  .openapi('Error');

export const jsonErr = (descripcion: string) => ({ content: { 'application/json': { schema: ErrorSchema } }, description: descripcion });

/** Respuesta correcta estándar: { success: true, data, ...meta } */
export const resp = (descripcion: string, data: z.ZodType = z.any()) => ({
  content: { 'application/json': { schema: z.object({ success: z.literal(true), data }).catchall(z.any()) } },
  description: descripcion,
});

export const ERRORES = {
  400: jsonErr('Datos inválidos'),
  401: jsonErr('No autenticado'),
  403: jsonErr('Sin permiso'),
  404: jsonErr('No encontrado'),
  409: jsonErr('Conflicto'),
  429: jsonErr('Demasiadas solicitudes'),
} as const;

export const cuerpo = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } }, required: true as const });

/** Esquemas de seguridad declarados en OpenAPI */
export const SEG_USUARIO = [{ bearerAuth: [] }];
export const SEG_FOLIO = [{ folioAuth: [] }];
/** El folio es opcional: {} = también se acepta la petición sin autenticación */
export const SEG_FOLIO_OPCIONAL: Record<string, string[]>[] = [{ folioAuth: [] }, {}];

export const BoolQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();
