// Modelo basado en la ficha FUTURO/001 del Tribunal Popular por Nuestro Futuro

export type Topic = 'transicion' | 'contaminacion' | 'suceso'

export type EvidenceType =
  | 'recibo'
  | 'documento'
  | 'foto'
  | 'video'
  | 'audio'
  | 'mapa'
  | 'estudio'
  | 'datos'
  | 'otro'

export interface Testimony {
  id: string
  folio: string // FUTURO/001-T0001
  date: string // ISO
  place: string // Lugar / territorio
  coordinates: [number, number] // lng, lat
  author: { visibility: 'nombre' | 'anonimo'; name?: string }
  topic: Topic
  title: string // Titular corto para la historia
  testimony: string // 1 · El testimonio
  territory: string // 2 · El territorio dice
  community: string // 3 · La comunidad dice
  document: { status: 'si' | 'no' | 'pendiente'; folio?: string; description?: string } // 4 · El recibo / documento dice
  data?: { text: string; source?: string; year?: number; pendingVerification: boolean } // 5 · Los datos dicen
  tribunalQuestion: string // 6 · La pregunta del tribunal
  evidence: EvidenceType[]
  supports: number // Popularidad
}

// --- Creación de testimonio (formulario) ---

export type Visibility = Testimony['author']['visibility']
export type DocumentStatus = Testimony['document']['status']

export type Consent = 'publico-nombre' | 'publico-anonimo' | 'interno' | 'no-publicar'
export type MediaConsent = 'si' | 'no' | 'na'
export type SensitiveHandling = 'anonimizar' | 'interno' | 'revision'

export interface TestimonyDraft {
  // Datos generales
  topic: Topic | null
  title: string
  place: string
  coordinates: [number, number] | null
  date: string // YYYY-MM-DD
  name: string
  visibility: Visibility
  facilitator: string
  // 1–3
  testimony: string
  territory: string
  community: string
  // 4
  documentStatus: DocumentStatus | null
  documentDescription: string
  evidence: EvidenceType[]
  evidenceOther: string
  files: File[]
  // 5–6
  dataText: string
  dataSource: string
  dataYear: string
  dataPendingVerification: boolean
  tribunalQuestion: string
  // Consentimiento e información sensible
  voluntary: boolean
  consent: Consent | null
  mediaConsent: MediaConsent | null
  sensitive: boolean | null
  sensitiveHandling: SensitiveHandling[]
}

export interface CreateTestimonyResult {
  testimony: Testimony
  evidenceFolio: string | null
  published: boolean
}
