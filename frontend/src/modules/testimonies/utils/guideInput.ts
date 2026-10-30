// Respuestas que usa la guía (utils/guide.ts). Archivo aparte para no cargar los datos del Excel con el formulario
import { classifyFacts } from '@testimonies/data/facts'
import type { TestimonyDraft } from '@testimonies/types/testimony'

export type GuideInput = Pick<
  TestimonyDraft,
  'facts' | 'state' | 'municipality' | 'place' | 'since' | 'ongoing' | 'title' | 'testimony' | 'tribunalQuestion' | 'complaint' | 'threats'
>

// Copia de lo necesario: el borrador se limpia al enviar
export function guideInputOf(d: GuideInput): GuideInput {
  return {
    facts: [...d.facts],
    state: d.state,
    municipality: d.municipality,
    place: d.place,
    since: d.since,
    ongoing: d.ongoing,
    title: d.title,
    testimony: d.testimony,
    tribunalQuestion: d.tribunalQuestion,
    complaint: d.complaint,
    threats: d.threats,
  }
}

// Hay guía cuando el testimonio tiene «¿Qué pasa?» (formulario de 4 pantallas)
export const hasGuide = (d: Pick<GuideInput, 'facts'>) => classifyFacts(d.facts) !== null
