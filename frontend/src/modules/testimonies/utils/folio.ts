// Folio de participante: P-XXXX-XXXX-XXXX-XXXX (Crockford base32).
// Misma normalización que el back (backend/src/lib/ids.ts → normalizarFolioParticipante)
export function normalizeParticipantFolio(raw: string | null | undefined): string | null {
  if (!raw) return null
  let s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (s.startsWith('P')) s = s.slice(1)
  s = s.replace(/[IL]/g, '1').replace(/O/g, '0')
  if (!/^[0-9A-HJKMNP-TV-Z]{16}$/.test(s)) return null
  return `P-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`
}

// Para mostrar sin exponer el folio completo: P-••••-••••-••••-XXXX
export function maskFolio(folio: string) {
  return `P-••••-••••-••••-${folio.slice(-4)}`
}
