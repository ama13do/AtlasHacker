// Modelo basado en la ficha FUTURO/001 del Tribunal Popular por Nuestro Futuro.
// Se llena desde la API con services/mappers.ts

import type { CoverName } from '@testimonies/data/covers'
import type { ApiTipoEvidencia } from '@testimonies/types/api'

// Slug de la categoría de la API (p. ej. 'megaproyectos'); las categorías vienen de /api/config
export type CategorySlug = string

export type EvidenceType = ApiTipoEvidencia

export interface Category {
  slug: CategorySlug
  label: string
  description: string | null
}

// Lo necesario para pines, historias y lista (GET /api/mapa)
export interface TestimonySummary {
  id: string
  folio: string // FUTURO/001-T7K3MQ9X
  date: string // AAAA-MM-DD
  place: string // Lugar / territorio
  coordinates: [number, number] // lng, lat (pin)
  approximate: boolean // Ubicación generalizada (~1 km)
  category: CategorySlug
  title: string
  reactions: number // Popularidad
  comments: number
  cover?: CoverName // Sticker de portada; si falta se elige por categoría
}

export interface EvidenceFile {
  id: string
  folio: string
  type: EvidenceType
  mime: string
  name: string
  url: string
  description: string | null
}

// Ficha completa (GET /api/testimonios/{id})
export interface TestimonyDetail extends TestimonySummary {
  author: { visibility: 'nombre' | 'anonimo'; name?: string }
  testimony: string // 1 · El testimonio
  territory?: string // 2 · El territorio dice
  community?: string // 3 · La comunidad dice
  document: { status: 'si' | 'no' | 'pendiente' } // 4 · El recibo / documento dice
  data?: { text: string; pendingVerification: boolean } // 5 · Los datos dicen (dato / fuente / año)
  tribunalQuestion?: string // 6 · La pregunta del tribunal
  evidence: EvidenceType[]
  files: EvidenceFile[]
}

// --- Creación de testimonio (formulario) ---

export type Visibility = TestimonyDetail['author']['visibility']
export type DocumentStatus = TestimonyDetail['document']['status']

export type Consent = 'publico-nombre' | 'publico-anonimo' | 'interno' | 'no-publicar'
export type MediaConsent = 'si' | 'no' | 'na'
export type SensitiveHandling = 'anonimizar' | 'interno' | 'revision'

export interface TestimonyDraft {
  // Datos generales
  topic: CategorySlug | null
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
  testimony: TestimonySummary
  evidenceFolio: string | null
  published: boolean
}
