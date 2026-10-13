import { adminGet, adminRequest } from '@admin/services/adminHttp'
import type {
  AccionModeracion,
  ApiAuditoria,
  ApiEditarTestimonioStaff,
  ApiEvidenciaStaff,
  ApiTestimonioStaff,
  ApiTestimonioStaffFila,
  PaginaMeta,
} from '@admin/types/api'

// Filtros del listado (GET /api/admin/testimonios); vacíos = sin filtro
export interface StaffFilters {
  estado?: string
  activo?: string // 'true' | 'false'
  categoria?: string
  info_sensible?: string
  origen?: string
  q?: string
  folio?: string
  desde?: string
  hasta?: string
  pagina?: number
  por_pagina?: number
}

const base = (id: string) => `/api/admin/testimonios/${encodeURIComponent(id)}`

export const adminTestimoniesService = {
  async list(filters: StaffFilters): Promise<{ rows: ApiTestimonioStaffFila[]; meta: PaginaMeta }> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''))
    const { data, meta } = await adminGet<ApiTestimonioStaffFila[]>('/api/admin/testimonios', params)
    return { rows: data, meta: meta as unknown as PaginaMeta }
  },

  async get(id: string): Promise<ApiTestimonioStaff> {
    return (await adminGet<ApiTestimonioStaff>(base(id))).data
  },

  // Aprobar (con opción de publicar la multimedia), rechazar (motivo obligatorio), desaprobar, activar, desactivar
  async moderate(id: string, action: AccionModeracion, body: { motivo?: string; publicar_evidencias?: boolean } = {}) {
    return (await adminRequest<ApiTestimonioStaff>({ method: 'post', url: `${base(id)}/${action}`, data: body })).data
  },

  async moderateBatch(ids: string[], action: AccionModeracion, motivo?: string) {
    return (
      await adminRequest<{ procesados: number; correctos: number; resultados: { id: string; ok: boolean; error?: string }[] }>({
        method: 'post',
        url: '/api/admin/testimonios/moderar-lote',
        data: { ids, accion: action, ...(motivo ? { motivo } : {}) },
      })
    ).data
  },

  async update(id: string, changes: ApiEditarTestimonioStaff) {
    return (await adminRequest<ApiTestimonioStaff>({ method: 'patch', url: base(id), data: changes })).data
  },

  // Irreversible: exige el folio exacto como confirmación (solo admin)
  async remove(id: string, folio: string) {
    await adminRequest({ method: 'delete', url: base(id), params: { confirmar: folio } })
  },

  // Solo admin; cada consulta queda en la bitácora
  async audit(id: string): Promise<ApiAuditoria> {
    return (await adminGet<ApiAuditoria>(`${base(id)}/auditoria`)).data
  },

  async evidence(id: string): Promise<ApiEvidenciaStaff[]> {
    return (await adminGet<ApiEvidenciaStaff[]>(`${base(id)}/evidencias`)).data
  },

  // URL firmada de 5 min (queda en la bitácora)
  async evidenceUrl(evidenceId: string): Promise<string> {
    return (await adminGet<{ url: string }>(`/api/admin/evidencias/${encodeURIComponent(evidenceId)}/url`)).data.url
  },

  async updateEvidence(id: string, evidenceId: string, changes: { publica?: boolean; activo?: boolean }) {
    return (
      await adminRequest<ApiEvidenciaStaff[]>({ method: 'patch', url: `${base(id)}/evidencias/${encodeURIComponent(evidenceId)}`, data: changes })
    ).data
  },

  async deleteEvidence(id: string, evidenceId: string) {
    await adminRequest({ method: 'delete', url: `${base(id)}/evidencias/${encodeURIComponent(evidenceId)}` })
  },
}
