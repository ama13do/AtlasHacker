// Modelo basado en la ficha FUTURO/001 del Tribunal Popular por Nuestro Futuro.
// Se llena desde la API con services/mappers.ts

import type { CoverName } from '@testimonies/data/covers'
import type { ApiTipoEvidencia } from '@testimonies/types/api'

// Slug de la categoría de la API (p. ej. 'megaproyectos'); las categorías vienen de /api/config
export type CategorySlug = string

export type EvidenceType = ApiTipoEvidencia

export type ReactionType = 'like' | 'apoyo' | 'alerta' | 'fuego'
export const REACTION_TYPES: ReactionType[] = ['like', 'apoyo', 'alerta', 'fuego']

export interface Comment {
  id: string
  author: string | null // null = anónimo
  text: string
  likes: number
  createdAt: string // ISO
  likedByMe: boolean
}

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
  reactionCounts: Record<ReactionType, number>
}

// --- Creación de testimonio (formulario) ---

export type Visibility = TestimonyDetail['author']['visibility']
export type DocumentStatus = TestimonyDetail['document']['status']

export type Consent = 'publico-nombre' | 'publico-anonimo' | 'interno' | 'no-publicar'
export type MediaConsent = 'si' | 'no' | 'na'
export type SensitiveHandling = 'anonimizar' | 'interno' | 'revision'
export type LocationSource = 'gps' | 'mapa'

// Archivo elegido en el formulario, con el tipo de evidencia que se declara a la API
export interface EvidenceAttachment {
  id: string // Local, para keys
  file: File
  type: EvidenceType
}

// Estado de subida de un archivo (reservar → PUT a R2 → confirmar)
export interface UploadItem {
  id: string
  name: string
  size: number
  type: EvidenceType
  status: 'pendiente' | 'subiendo' | 'confirmando' | 'lista' | 'error'
  progress: number // 0..1
  error?: string
  folio?: string // FUTURO/001-E… al reservar
}

export interface TestimonyDraft {
  // Datos generales
  topic: CategorySlug | null
  title: string
  place: string
  coordinates: [number, number] | null
  locationSource: LocationSource | null
  gpsAccuracy: number | null // metros
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
  files: EvidenceAttachment[]
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
  sensitiveHandling: SensitiveHandling | null
  // Folio de participante y contacto (opcionales)
  folio: string
  email: string
  phone: string
}

// --- Mi folio ---

export type ModerationStatus = 'pendiente' | 'aprobado' | 'rechazado'

export interface MyTestimony {
  id: string
  folio: string
  title: string
  category: CategorySlug
  date: string
  place: string | null
  status: ModerationStatus
  active: boolean // false = dado de baja
  public: boolean // visible en el mapa
  rejectionReason: string | null
  reactions: number
  comments: number
  updatedAt: string
}

export interface ParticipantProfile {
  hint: string // Últimos caracteres del folio
  publicProfile: boolean
  publicName: string | null
  hasName: boolean
  hasEmail: boolean
  hasPhone: boolean
  testimonies: number
  published: number
  createdAt: string
}

export interface PersonalData {
  name: string | null
  email: string | null
  phone: string | null
}

export interface MyEvidence {
  id: string
  folio: string
  type: EvidenceType
  name: string
  mime: string
  size: number
  uploaded: boolean
  public: boolean
  active: boolean
}

export interface CreateTestimonyResult {
  id: string
  folio: string // Folio del testimonio (FUTURO/001-T…)
  status: 'pendiente' | 'aprobado' | 'rechazado'
  published: boolean
  message: string
  participantFolio: string | null // Solo la primera vez: se muestra una única vez
}
