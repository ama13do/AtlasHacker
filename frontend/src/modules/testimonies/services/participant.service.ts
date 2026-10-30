import http, { type ApiResponse } from '@/core/http/client'
import {
  draftFromMine,
  fromMine,
  fromMyEvidence,
  fromPersonalData,
  fromProfile,
  toUpdatePayload,
} from '@testimonies/services/mappers'
import type { ApiMiEvidencia, ApiMiPerfil, ApiMiTestimonio, ApiMiTestimonioResumen } from '@testimonies/types/api'
import type { ModerationStatus, MyEvidence, MyTestimony, ParticipantProfile, PersonalData, TestimonyDraft } from '@testimonies/types/testimony'

// Zona "Mi folio": la persona se identifica con su folio en la cabecera X-Folio (401 si falta o no es válido)

const auth = (folio: string) => ({ headers: { 'X-Folio': folio } })
const mine = (id: string) => `/api/mis-testimonios/${encodeURIComponent(id)}`

export interface ProfileChanges {
  nombre?: string | null
  correo?: string | null
  telefono?: string | null
  perfil_publico?: boolean
  nombre_publico?: string | null
}

export const participantService = {
  async getProfile(folio: string): Promise<ParticipantProfile> {
    const { data } = await http.get<ApiResponse<ApiMiPerfil>>('/api/mi-perfil', auth(folio))
    return fromProfile(data.data)
  },

  // Descifra los datos personales; la API deja registro de la consulta
  async getPersonalData(folio: string): Promise<PersonalData> {
    const { data } = await http.get<ApiResponse<ApiMiPerfil>>('/api/mi-perfil', { ...auth(folio), params: { datos: 'true' } })
    return fromPersonalData(data.data)
  },

  // `null` borra el dato
  async updateProfile(folio: string, changes: ProfileChanges): Promise<ParticipantProfile> {
    const { data } = await http.patch<ApiResponse<ApiMiPerfil>>('/api/mi-perfil', changes, auth(folio))
    return fromProfile(data.data)
  },

  async listMine(folio: string): Promise<MyTestimony[]> {
    const { data } = await http.get<ApiResponse<ApiMiTestimonioResumen[]>>('/api/mis-testimonios', auth(folio))
    return data.data.map(fromMine)
  },

  // Ficha propia lista para el wizard de edición
  async getMineAsDraft(folio: string, id: string): Promise<{ folio: string; status: ModerationStatus; active: boolean; draft: TestimonyDraft }> {
    const { data } = await http.get<ApiResponse<ApiMiTestimonio>>(mine(id), auth(folio))
    return { folio: data.data.folio, status: data.data.estado, active: data.data.activo, draft: draftFromMine(data.data) }
  },

  // Tras editar, vuelve a revisión (según la configuración del dashboard)
  async updateMine(folio: string, id: string, draft: TestimonyDraft): Promise<void> {
    await http.patch(mine(id), toUpdatePayload(draft), auth(folio))
  },

  // Baja lógica: deja de verse en el mapa, no se borra
  async withdraw(folio: string, id: string): Promise<void> {
    await http.delete(mine(id), auth(folio))
  },

  async listEvidence(folio: string, id: string): Promise<MyEvidence[]> {
    const { data } = await http.get<ApiResponse<ApiMiEvidencia[]>>(`${mine(id)}/evidencias`, auth(folio))
    return data.data.map(fromMyEvidence)
  },

  async deleteEvidence(folio: string, id: string, evidenceId: string): Promise<void> {
    await http.delete(`${mine(id)}/evidencias/${encodeURIComponent(evidenceId)}`, auth(folio))
  },
}
