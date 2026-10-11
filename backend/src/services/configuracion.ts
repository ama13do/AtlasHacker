import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import { configuracion } from '../db/schema.js';

export const MODOS_PUBLICACION = ['revisar_todo', 'auto_si_no_sensible', 'auto_todo'] as const;
export type ModoPublicacion = (typeof MODOS_PUBLICACION)[number];

const MIME_POR_DEFECTO = [
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm',
  'video/mp4', 'video/webm', 'video/quicktime',
];

/** Cada clave con su valor por defecto; lo guardado en la tabla "configuracion" lo sobrescribe. */
export const ConfiguracionSchema = z.object({
  modo_publicacion: z.enum(MODOS_PUBLICACION).default('revisar_todo'),
  max_archivos_por_testimonio: z.number().int().min(0).max(50).default(5),
  max_bytes_totales_por_testimonio: z.number().int().min(0).max(500 * 1024 * 1024).default(20 * 1024 * 1024),
  tipos_mime_permitidos: z.array(z.string().regex(/^[\w.+-]+\/[\w.+-]+$/)).min(1).default(MIME_POR_DEFECTO),
  captcha_requerido: z.boolean().default(true),
  auditoria_envio_activa: z.boolean().default(true),
  auditoria_retencion_dias: z.number().int().min(1).max(3650).default(365),
  comentarios_habilitados: z.boolean().default(true),
  comentarios_requieren_moderacion: z.boolean().default(false),
  reacciones_habilitadas: z.boolean().default(true),
  participantes_pueden_editar: z.boolean().default(true),
  participantes_pueden_eliminar: z.boolean().default(true),
  edicion_requiere_revision: z.boolean().default(true),
  mapa_tiempo_real: z.boolean().default(true),
  consentimiento_version_actual: z.string().min(1).max(40).default('v1'),
});
export type Configuracion = z.infer<typeof ConfiguracionSchema>;
export const ConfiguracionParcialSchema = ConfiguracionSchema.partial();

const TTL_MS = 15_000;
let cache: { valor: Configuracion; hasta: number } | null = null;

export async function obtenerConfiguracion(): Promise<Configuracion> {
  if (cache && cache.hasta > Date.now()) return cache.valor;
  const filas = await getDb().select().from(configuracion);
  const valor = ConfiguracionSchema.parse(Object.fromEntries(filas.map((f) => [f.clave, f.valor])));
  cache = { valor, hasta: Date.now() + TTL_MS };
  return valor;
}

export async function actualizarConfiguracion(cambios: Partial<Configuracion>, usuarioId: string) {
  const entradas = Object.entries(cambios).filter(([, v]) => v !== undefined);
  if (entradas.length === 0) return obtenerConfiguracion();
  await getDb().transaction(async (tx) => {
    for (const [clave, valor] of entradas) {
      await tx
        .insert(configuracion)
        .values({ clave, valor, updated_by: usuarioId })
        .onConflictDoUpdate({ target: configuracion.clave, set: { valor, updated_by: usuarioId, updated_at: sql`now()` } });
    }
  });
  cache = null;
  return obtenerConfiguracion();
}

export const invalidarConfiguracion = () => {
  cache = null;
};

/** Subconjunto que el frontend público necesita para armar sus formularios */
export function configuracionPublica(c: Configuracion) {
  return {
    max_archivos_por_testimonio: c.max_archivos_por_testimonio,
    max_bytes_totales_por_testimonio: c.max_bytes_totales_por_testimonio,
    tipos_mime_permitidos: c.tipos_mime_permitidos,
    captcha_requerido: c.captcha_requerido,
    comentarios_habilitados: c.comentarios_habilitados,
    reacciones_habilitadas: c.reacciones_habilitadas,
    participantes_pueden_editar: c.participantes_pueden_editar,
    participantes_pueden_eliminar: c.participantes_pueden_eliminar,
    mapa_tiempo_real: c.mapa_tiempo_real,
    consentimiento_version_actual: c.consentimiento_version_actual,
  };
}

