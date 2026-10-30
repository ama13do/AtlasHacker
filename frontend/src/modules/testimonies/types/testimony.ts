// Modelo basado en la ficha FUTURO/001 del Tribunal Popular por Nuestro Futuro.
// Se llena desde la API con services/mappers.ts

import type { CoverName } from '@testimonies/data/covers'
import type { Complaint, FactKey, Since, Threats } from '@testimonies/data/facts'
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

// Expediente: cada uno es un mapa (GET /api/config)
export interface Dossier {
  id: string
  code: string // FUTURO/001
  title: string
  matter: string | null
  description: string | null
}

// Contadores públicos (GET /api/estadisticas)
export interface PublicStats {
  testimonies: number
  lastPublishedAt: string | null
  byCategory: { slug: string; label: string; total: number }[]
  byState: { state: string; total: number }[]
}

// Personas con perfil público (GET /api/colaboradores)
export interface Collaborator {
  id: string
  name: string
  published: number
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
  dossier?: string // Expediente (FUTURO/001)
  author: { visibility: 'nombre' | 'anonimo'; name?: string }
  testimony: string // 1 · El testimonio
  territory?: string // 2 · El territorio dice
  community?: string // 3 · La comunidad dice
  document: { status: 'si' | 'no' | 'pendiente' } // 4 · El recibo / documento dice
  data?: { text: string; sources: Source[]; pendingVerification: boolean } // 04 · Los datos dicen
  tribunalQuestion?: string // 05 · La pregunta del Tribunal
  anythingElse?: string // C.11 · Algo más que el Tribunal deba conocer
  evidence: EvidenceType[]
  files: EvidenceFile[]
  links: string[] // links de evidencia públicos
  reactionCounts: Record<ReactionType, number>
}

// --- Creación de testimonio (formulario) ---

export type Visibility = TestimonyDetail['author']['visibility']
export type DocumentStatus = TestimonyDetail['document']['status']

export type Consent = 'publico-nombre' | 'publico-anonimo' | 'interno' | 'no-publicar'
export type MediaConsent = 'si' | 'no' | 'na'
export type SensitiveHandling = 'anonimizar' | 'interno' | 'revision'
export type LocationSource = 'gps' | 'mapa'
export type VoiceImage = 'voz_imagen' | 'solo_voz' | 'ninguna'

// 04 · Una fuente de los datos (en el formulario lleva id local para las keys)
export interface Source {
  source: string
  year?: number
  link?: string
}
export interface DraftSource {
  id: string
  source: string
  year: string
  link: string
}

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
  // 1 · ¿Qué pasa? (el primero es el principal) → categoría (topic), que se asigna sola
  facts: FactKey[]
  topic: CategorySlug | null
  // 2 · ¿Dónde y desde cuándo?
  coordinates: [number, number] | null
  state: string // Estado (se completa al marcar el lugar)
  municipality: string // Municipio (obligatorio; se completa con la geocodificación inversa)
  place: string // Comunidad o colonia (opcional)
  locationSource: LocationSource | null
  gpsAccuracy: number | null // metros
  since: Since | null // ¿Desde cuándo pasa?
  ongoing: boolean | null // ¿Sigue pasando?
  // 3 · Cuéntalo
  title: string
  testimony: string
  tribunalQuestion: string // Tu pregunta al Tribunal (opcional)
  links: string[] // Links como evidencia (publicaciones, notas, videos…)
  files: EvidenceAttachment[]
  // 4 · Dos preguntas
  complaint: Complaint | null // ¿Ya reclamaste?
  threats: Threats | null // ¿Te han amenazado? (solo con un proyecto en el territorio)
  visibility: Visibility
  name: string
  facilitator: string // Solo en la captura desde el panel
  // Autorización de un testimonio anterior que se edita (los nuevos se publican según «cómo apareces»)
  consent: Consent | null
  voluntary: boolean
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
  hasGuide: boolean // Enviado con el formulario de 4 pantallas: tiene guía
}

// Seguimiento de un compromiso de gobierno (guía): E1 identificado · E2 sin evidencia · E3 omisión documentada
export type FindingState = 'E1' | 'E2' | 'E3' | 'cerrado'
export type CommitmentArrived = 'si' | 'no' | 'no_lo_conocia'
export type AuthorityAnswer = 'pendiente' | 'acredita' | 'no_acredita' | 'sin_respuesta'
export interface FollowUp {
  commitmentId: string
  arrived: CommitmentArrived | null // null = sin responder
  requestFolio: string // Folio de la solicitud de información ('' = no la presentó)
  answer: AuthorityAnswer
  state: FindingState
  confirmed: boolean // Omisión (E3) confirmada por moderación
  confirmedBy: string | null
  confirmedAt: string | null
}
export type FollowUpChanges = Partial<{ llego: CommitmentArrived | null; folio_solicitud: string | null; respuesta: AuthorityAnswer }>

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
