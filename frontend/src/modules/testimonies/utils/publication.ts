import type { TestimonyDraft } from '@testimonies/types/testimony'

// Se publica en el mapa solo con consentimiento público y sin información sensible
// marcada para uso interno o revisión previa
export function isPublishable(draft: Pick<TestimonyDraft, 'consent' | 'sensitive' | 'sensitiveHandling'>): boolean {
  const publicConsent = draft.consent === 'publico-nombre' || draft.consent === 'publico-anonimo'
  const held = draft.sensitive === true && draft.sensitiveHandling.some((h) => h === 'interno' || h === 'revision')
  return publicConsent && !held
}
