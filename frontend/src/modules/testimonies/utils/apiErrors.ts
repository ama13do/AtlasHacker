import type { FormErrors } from '@testimonies/composables/useTestimonyForm'
import type { TestimonyDraft } from '@testimonies/types/testimony'

// Campo de la API → campo del borrador y paso del wizard donde se edita
const API_FIELDS: Record<string, { field: keyof TestimonyDraft; step: number }> = {
  // 1 · ¿Qué pasa? (la categoría sale de ahí)
  categoria: { field: 'facts', step: 0 },
  hechos: { field: 'facts', step: 0 },
  subcategoria: { field: 'facts', step: 0 },
  // 2 · ¿Dónde y desde cuándo?
  ubicacion: { field: 'coordinates', step: 1 },
  origen_ubicacion: { field: 'coordinates', step: 1 },
  precision_gps_m: { field: 'coordinates', step: 1 },
  entidad: { field: 'state', step: 1 },
  municipio: { field: 'municipality', step: 1 },
  lugar_territorio: { field: 'place', step: 1 },
  desde_cuando: { field: 'since', step: 1 },
  sigue_pasando: { field: 'ongoing', step: 1 },
  // 3 · Cuéntalo
  titulo: { field: 'title', step: 2 },
  relato: { field: 'testimony', step: 2 },
  pregunta_tribunal: { field: 'tribunalQuestion', step: 2 },
  enlaces_evidencia: { field: 'links', step: 2 },
  tiene_evidencia: { field: 'files', step: 2 },
  evidencia_tipos: { field: 'files', step: 2 },
  // 4 · Dos preguntas
  reclamo_previo: { field: 'complaint', step: 3 },
  amenazas: { field: 'threats', step: 3 },
  info_sensible: { field: 'threats', step: 3 },
  sensible_accion: { field: 'threats', step: 3 },
  aparecer_como: { field: 'visibility', step: 3 },
  autorizacion: { field: 'visibility', step: 3 },
  nombre: { field: 'name', step: 3 },
  nombre_publico: { field: 'name', step: 3 },
  facilitador_nombre: { field: 'facilitator', step: 3 },
  consentimiento_aceptado: { field: 'voluntary', step: 3 },
  contacto: { field: 'email', step: 3 },
}

// detalles de DATOS_INVALIDOS = z.flattenError → { formErrors: string[], fieldErrors: { campo: string[] } }
export function fieldErrorsFromApi(details: unknown): { errors: FormErrors; step: number } | null {
  const fieldErrors = (details as { fieldErrors?: Record<string, string[] | undefined> } | undefined)?.fieldErrors
  if (!fieldErrors) return null

  const errors: FormErrors = {}
  let step = Infinity
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const target = API_FIELDS[key]
    if (!target || !messages?.length) continue
    errors[target.field] ??= messages[0]
    step = Math.min(step, target.step)
  }
  return Number.isFinite(step) ? { errors, step } : null
}
