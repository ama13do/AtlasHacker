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
