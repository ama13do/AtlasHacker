import type { FormErrors } from '@testimonies/composables/useTestimonyForm'
import type { TestimonyDraft } from '@testimonies/types/testimony'

// Campo de la API → campo del borrador y paso del wizard donde se edita
const API_FIELDS: Record<string, { field: keyof TestimonyDraft; step: number }> = {
  categoria: { field: 'topic', step: 0 },
  titulo: { field: 'title', step: 0 },
  fecha: { field: 'date', step: 0 },
  lugar_territorio: { field: 'place', step: 0 },
  ubicacion: { field: 'coordinates', step: 0 },
  nombre: { field: 'name', step: 0 },
  nombre_publico: { field: 'name', step: 0 },
  facilitador_nombre: { field: 'facilitator', step: 0 },
  relato: { field: 'testimony', step: 1 },
  territorio_dice: { field: 'territory', step: 2 },
  comunidad_dice: { field: 'community', step: 2 },
  tiene_evidencia: { field: 'documentStatus', step: 3 },
  evidencia_descripcion: { field: 'documentDescription', step: 3 },
  evidencia_tipos: { field: 'evidence', step: 3 },
  evidencia_otro: { field: 'evidenceOther', step: 3 },
  dato_fuente_anio: { field: 'dataText', step: 4 },
  pregunta_tribunal: { field: 'tribunalQuestion', step: 4 },
  autorizacion: { field: 'consent', step: 5 },
  autoriza_multimedia: { field: 'mediaConsent', step: 5 },
  info_sensible: { field: 'sensitive', step: 5 },
  sensible_accion: { field: 'sensitiveHandling', step: 5 },
  contacto: { field: 'email', step: 5 },
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
