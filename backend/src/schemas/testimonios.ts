import { z } from '@hono/zod-openapi';
import {
  APARECER_COMO,
  AUTORIZACIONES,
  ESTADOS_MODERACION,
  MULTIMEDIA,
  ORIGENES_UBICACION,
  SENSIBLE_ACCIONES,
  TIENE_EVIDENCIA,
  TIPOS_EVIDENCIA,
  VOZ_IMAGEN,
} from '../db/schema.js';
import { GeometriaSchema, Uuid } from './comunes.js';

const texto = (max: number) => z.string().trim().max(max);

/** 04 · Los datos dicen: cada fuente con su año y enlace o referencia (Manual C.6) */
export const FuenteSchema = z.object({
  fuente: texto(300).min(1),
  anio: z.number().int().min(1900).max(2100).optional(),
  enlace: texto(500).optional().openapi({ description: 'URL o referencia (libro, oficio, etc.)' }),
});

export const ContactoSchema = z
  .object({
    correo: z.email().max(200).optional(),
    telefono: z
      .string()
      .trim()
      .regex(/^\+?[\d\s().-]{7,25}$/, 'Teléfono inválido')
      .optional(),
  })
  .openapi({ description: 'Opcional. Se guarda cifrado y solo sirve para que el equipo pueda ayudar a recuperar el folio.' });

/** Datos de auditoría que aporta el navegador (opcionales). La IP y el user-agent los toma el servidor. */
export const AuditoriaClienteSchema = z
  .object({
    huella_dispositivo: z.string().max(200).optional(),
    precision_gps_m: z.number().min(0).max(100000).optional(),
    zona_horaria: z.string().max(60).optional(),
    idioma: z.string().max(20).optional(),
    pantalla: z.string().max(30).optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi({ description: 'Opcional. Solo se guarda si la auditoría de envío está activa en la configuración.' });

/**
 * Campos de la ficha que describe el contenido del testimonio (editables). Los obligatorios al crear están
 * sin ".optional()"; en las ediciones todos pasan a opcionales.
 * Valores por defecto al crear: aparecer_como=anonimo, tiene_evidencia=no, autoriza_multimedia=na, info_sensible=false.
 */
const campos = {
  categoria: z.string().min(1).max(100).openapi({ description: 'Slug o UUID de la categoría', example: 'megaproyectos' }),
  fecha: z.iso.date().optional().openapi({ description: 'Fecha de la ficha (AAAA-MM-DD). Por defecto, hoy.' }),
  titulo: texto(200).optional(),
  lugar_territorio: texto(300).optional().openapi({ description: 'Ficha: «Lugar / territorio»' }),
  entidad: texto(100).optional(),
  municipio: texto(120).optional(),
  ubicacion: GeometriaSchema,
  origen_ubicacion: z.enum(ORIGENES_UBICACION).optional().openapi({ description: 'gps | mapa (default) | manual | importada' }),
  aparecer_como: z.enum(APARECER_COMO).optional().openapi({ description: 'Ficha: «¿Cómo desea aparecer?»' }),
  nombre_publico: texto(150).optional().openapi({ description: 'Nombre que se mostrará si aparecer_como = nombre' }),
  relato: texto(10000).min(10).openapi({ description: '1 · EL TESTIMONIO: ¿Qué está ocurriendo?' }),
  territorio_dice: texto(5000).optional().openapi({ description: '2 · EL TERRITORIO DICE' }),
  comunidad_dice: texto(5000).optional().openapi({ description: '3 · LA COMUNIDAD DICE' }),
  tiene_evidencia: z.enum(TIENE_EVIDENCIA).optional().openapi({ description: '4 · EL RECIBO / DOCUMENTO DICE: sí | no | pendiente' }),
  evidencia_descripcion: texto(5000).optional(),
  evidencia_tipos: z.array(z.enum(TIPOS_EVIDENCIA)).max(TIPOS_EVIDENCIA.length).optional().openapi({ description: 'EVIDENCIAS QUE ACOMPAÑAN' }),
  evidencia_otro: texto(200).optional(),
  enlaces_evidencia: z
    .array(z.url({ protocol: /^https?$/, error: 'Link no válido (debe empezar con http:// o https://)' }).max(2000))
    .max(20)
    .optional()
    .openapi({ description: 'Links como evidencia (publicaciones, notas, videos…): solo la URL' }),
  dato_fuente_anio: texto(5000).optional().openapi({ description: '04 · LOS DATOS DICEN: datos (texto libre)' }),
  fuentes: z.array(FuenteSchema).max(20).optional().openapi({ description: '04 · Fuentes de los datos (dato, fuente, año y enlace)' }),
  fuente_pendiente_verificacion: z.boolean().optional(),
  pregunta_tribunal: texto(5000).optional().openapi({ description: '05 · LA PREGUNTA DEL TRIBUNAL' }),
  algo_mas: texto(5000).optional().openapi({ description: 'C.11 · ¿Hay algo que no te preguntamos y que consideras importante?' }),
  registro_voz: texto(2000).optional().openapi({ description: 'C.11 · ¿Cómo te gustaría que quedara registrada tu voz? (interno)' }),
  autorizacion: z.enum(AUTORIZACIONES).openapi({ description: 'CONSENTIMIENTO: autorización de uso' }),
  autoriza_multimedia: z.enum(MULTIMEDIA).optional().openapi({ description: 'C.10 · ¿Las personas fotografiadas autorizaron el uso de su imagen? sí | no | na' }),
  autoriza_voz_imagen: z.enum(VOZ_IMAGEN).optional().openapi({ description: 'C.4 · Transmisión en vivo o grabación: voz_imagen | solo_voz | ninguna' }),
  info_menores: z.boolean().optional().openapi({ description: 'C.10 · ¿Hay información de niñas, niños o adolescentes? Si es true nunca se publica sin revisión' }),
  info_sensible: z.boolean().optional().openapi({ description: 'INFORMACIÓN SENSIBLE: ¿hay información que pueda poner a alguien en riesgo?' }),
  sensible_accion: z.enum(SENSIBLE_ACCIONES).optional().openapi({ description: 'Obligatorio si info_sensible = true' }),
};

type Validable = { aparecer_como?: string; nombre?: string; nombre_publico?: string; info_sensible?: boolean; sensible_accion?: string };

function validarReglas(v: Validable, ctx: z.RefinementCtx, esCreacion: boolean) {
  if (v.info_sensible && !v.sensible_accion) {
    ctx.addIssue({ code: 'custom', path: ['sensible_accion'], message: 'Indica qué hacer con la información sensible: anonimizar, uso_interno o revision_antes_publicar' });
  }
  if (esCreacion && v.aparecer_como === 'nombre' && !(v.nombre_publico ?? v.nombre)) {
    ctx.addIssue({ code: 'custom', path: ['nombre'], message: 'Si desea aparecer con nombre, indícalo en "nombre"' });
  }
}

export const CrearTestimonioSchema = z
  .object({
    ...campos,
    expediente: z.string().max(60).optional().openapi({ description: 'Código (FUTURO/001) o UUID. Si se omite, se usa el expediente activo.', example: 'FUTURO/001' }),
    nombre: texto(150).optional().openapi({ description: 'Nombre real (opcional). Se guarda CIFRADO. Si aparecer_como = nombre, también es el nombre público.' }),
    contacto: ContactoSchema.optional(),
    facilitador_nombre: texto(150).optional().openapi({ description: 'Ficha: «Facilitador/a»' }),
    consentimiento_aceptado: z.literal(true).openapi({ description: '«Declaro que participo voluntariamente y entiendo el uso de mi testimonio». Debe ser true.' }),
    auditoria: AuditoriaClienteSchema.optional(),
  })
  .superRefine((v, ctx) => validarReglas(v, ctx, true))
  .openapi('CrearTestimonio');
export type CrearTestimonioInput = z.infer<typeof CrearTestimonioSchema>;

/** Edición por la persona (con su folio): solo el contenido de la ficha */
export const EditarMiTestimonioSchema = z
  .object(campos)
  .partial()
  .superRefine((v, ctx) => validarReglas(v, ctx, false))
  .openapi('EditarMiTestimonio');
export type EditarMiTestimonioInput = z.infer<typeof EditarMiTestimonioSchema>;

/** Edición desde el dashboard: cualquier aspecto del testimonio */
export const EditarTestimonioStaffSchema = z
  .object({
    ...campos,
    expediente: z.string().max(60),
    facilitador_nombre: texto(150),
    ubicacion_aproximada: z.boolean().openapi({ description: 'true = el mapa público muestra la ubicación generalizada (~1 km) en vez de la exacta' }),
    estado: z.enum(ESTADOS_MODERACION),
    motivo_rechazo: texto(1000).nullable(),
    notas_internas: texto(5000).nullable(),
    activo: z.boolean().openapi({ description: 'Baja lógica: false lo oculta sin borrarlo' }),
  })
  .partial()
  .superRefine((v, ctx) => validarReglas(v, ctx, false))
  .openapi('EditarTestimonioStaff');
export type EditarTestimonioStaffInput = z.infer<typeof EditarTestimonioStaffSchema>;

/** Alta desde el dashboard (facilitador/a captura una ficha en papel) */
export const CrearTestimonioStaffSchema = z
  .object({
    ...campos,
    expediente: z.string().max(60).optional(),
    nombre: texto(150).optional(),
    contacto: ContactoSchema.optional(),
    facilitador_nombre: texto(150).optional(),
    participante_id: Uuid.optional().openapi({ description: 'Si la persona ya tiene folio, su id de participante. Si se omite se crea uno nuevo y se devuelve el folio para entregárselo.' }),
    consentimiento_aceptado: z.literal(true),
    auditoria: AuditoriaClienteSchema.optional(),
  })
  .superRefine((v, ctx) => validarReglas(v, ctx, true))
  .openapi('CrearTestimonioStaff');
export type CrearTestimonioStaffInput = z.infer<typeof CrearTestimonioStaffSchema>;

/* ───────────────────────────────────────── Consultas ───────────────────────────────────────── */

const bbox = z
  .string()
  .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/, 'bbox = minLng,minLat,maxLng,maxLat')
  .transform((s) => s.split(',').map(Number) as [number, number, number, number])
  .refine(([a, b, c, d]) => a >= -180 && c <= 180 && b >= -90 && d <= 90 && a < c && b < d, 'bbox fuera de rango');

export const FiltrosPublicosQuery = z.object({
  categoria: z.string().max(300).optional().openapi({ description: 'Slug(s) separados por coma' }),
  expediente: z.string().max(60).optional().openapi({ description: 'Código, p. ej. FUTURO/001' }),
  entidad: z.string().max(100).optional(),
  q: z.string().trim().max(200).optional().openapi({ description: 'Búsqueda de texto completo (español)' }),
  desde: z.iso.date().optional(),
  hasta: z.iso.date().optional(),
  bbox: bbox.optional().openapi({ description: 'Caja visible del mapa: minLng,minLat,maxLng,maxLat', example: '-100,18,-98,20' }),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radio: z.coerce.number().min(1).max(500000).optional().openapi({ description: 'Metros (requiere lat y lng; máx. 500 km)' }),
});
export type FiltrosPublicos = z.infer<typeof FiltrosPublicosQuery>;

export const MapaQuery = FiltrosPublicosQuery.extend({
  geometria: z.enum(['punto', 'simple', 'completa']).default('punto').openapi({ description: 'punto = solo el pin (rápido, default) | simple = geometría simplificada | completa' }),
  limite: z.coerce.number().int().min(1).max(5000).default(1000),
});

export const FiltrosStaffQuery = z.object({
  estado: z.enum(ESTADOS_MODERACION).optional(),
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  categoria: z.string().max(100).optional(),
  expediente: z.string().max(60).optional(),
  entidad: z.string().max(100).optional(),
  autorizacion: z.enum(AUTORIZACIONES).optional(),
  info_sensible: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  es_publico: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  origen: z.enum(['web', 'facilitador', 'importacion']).optional(),
  participante_id: Uuid.optional(),
  facilitador_id: Uuid.optional(),
  folio: z.string().max(60).optional().openapi({ description: 'Folio del testimonio (búsqueda exacta, sin distinguir mayúsculas)' }),
  q: z.string().trim().max(200).optional(),
  desde: z.iso.date().optional(),
  hasta: z.iso.date().optional(),
  orden: z.enum(['recientes', 'antiguos']).default('recientes'),
});
export type FiltrosStaff = z.infer<typeof FiltrosStaffQuery>;
