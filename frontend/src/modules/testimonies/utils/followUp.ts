import type { AuthorityAnswer, CommitmentArrived, FindingState } from '@testimonies/types/testimony'

// Textos del Excel (textos.estados_hallazgo y listas Q23 / «Respuesta de la autoridad»)
export const FINDING: Record<FindingState, { label: string; class: string }> = {
  E1: { label: 'E1 · Compromiso identificado', class: 'bg-white' },
  E2: { label: 'E2 · Sin evidencia de implementación', class: 'bg-brand-pink' },
  E3: { label: 'E3 · Omisión documentada (requiere revisión HxNF)', class: 'bg-brand-orange' },
  cerrado: { label: 'Cerrado · implementación acreditada', class: 'bg-neon-lime' },
}

export const ARRIVED_LABELS: Record<CommitmentArrived, string> = {
  si: 'Sí ha llegado',
  no: 'No ha llegado',
  no_lo_conocia: 'No lo conocía',
}

export const ANSWER_LABELS: Record<AuthorityAnswer, string> = {
  pendiente: 'Pendiente',
  acredita: 'Acredita implementación en el municipio',
  no_acredita: 'No acredita implementación',
  sin_respuesta: 'Sin respuesta en plazo',
}
