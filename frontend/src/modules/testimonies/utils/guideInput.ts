// Respuestas que usa la guía (utils/guide.ts). Archivo aparte para no cargar los datos del Excel con el formulario
import { classifyFacts, protectionMode } from '@testimonies/data/facts'
import type { TestimonyDraft } from '@testimonies/types/testimony'

export type GuideInput = Pick<
  TestimonyDraft,
  'facts' | 'state' | 'municipality' | 'place' | 'since' | 'ongoing' | 'title' | 'testimony' | 'tribunalQuestion' | 'complaint' | 'threats' | 'visibility'
>

// Ajustes del revisor (panel de moderación): corrigen la guía sin tocar lo que escribió la persona
export interface GuideReview {
  subcategory: string | null
  right: string | null
  government: 'estatal' | 'municipal' | 'ambos' | null
  commitment: string | null
  hxnf: boolean
  figures: boolean
}

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
    visibility: d.visibility,
  }
}

// Hay guía cuando el testimonio tiene «¿Qué pasa?» (formulario de 4 pantallas)
export const hasGuide = (d: Pick<GuideInput, 'facts'>) => classifyFacts(d.facts) !== null

// Revisión de riesgo (7 a 14 días): amenazas, megaproyecto o central fósil. Al aprobarse se publica de inmediato
export const RISK_REVIEW_NOTICE =
  'Tu caso pasa por una revisión de riesgo de 7 a 14 días antes de publicarse. En cuanto se apruebe, aparece en el mapa.'

export function needsRiskReview(d: Pick<GuideInput, 'facts' | 'threats'>, subcategory?: string | null) {
  const c = classifyFacts(d.facts)
  const subs = [subcategory || c?.subcategory, ...(c?.secondary ?? [])]
  return protectionMode(d.facts, d.threats) || subs.some((s) => !!s && (s.startsWith('MP.') || s === 'CC.CENTRAL_FOSIL'))
}
