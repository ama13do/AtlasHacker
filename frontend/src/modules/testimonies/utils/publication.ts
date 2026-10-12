import type { TestimonyDraft } from '@testimonies/types/testimony'

// Puede publicarse en el mapa (tras la moderación) solo con consentimiento público y sin información
// sensible marcada para uso interno o revisión previa. La decisión final es de la API
export function isPublishable(draft: Pick<TestimonyDraft, 'consent' | 'sensitive' | 'sensitiveHandling'>): boolean {
  const publicConsent = draft.consent === 'publico-nombre' || draft.consent === 'publico-anonimo'
  const held = draft.sensitive === true && (draft.sensitiveHandling === 'interno' || draft.sensitiveHandling === 'revision')
  return publicConsent && !held
}
