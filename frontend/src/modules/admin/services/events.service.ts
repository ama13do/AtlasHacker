import { adminGet, adminRequest } from '@admin/services/adminHttp'
import type { ApiConteo, ApiEvento, ApiEventos } from '@admin/types/api'

export type EventInput = Partial<Pick<ApiEvento, 'nombre' | 'lugar' | 'inicio' | 'fin'>>

// Enlace /ir y eventos (lectura: admin y lector; crear y editar: admin; borrar: superadmin)
export const eventsService = {
  async summary(dias = 30): Promise<ApiEventos> {
    return (await adminGet<ApiEventos>('/api/admin/eventos', { dias })).data
  },
  async hours(id: string): Promise<({ hora: string } & ApiConteo)[]> {
    return (await adminGet<({ hora: string } & ApiConteo)[]>(`/api/admin/eventos/${encodeURIComponent(id)}/horas`)).data
  },
  async create(input: EventInput): Promise<ApiEvento> {
    return (await adminRequest<ApiEvento>({ method: 'post', url: '/api/admin/eventos', data: input })).data
  },
  async update(id: string, input: EventInput): Promise<ApiEvento> {
    return (await adminRequest<ApiEvento>({ method: 'patch', url: `/api/admin/eventos/${encodeURIComponent(id)}`, data: input })).data
  },
  async remove(id: string): Promise<void> {
    await adminRequest({ method: 'delete', url: `/api/admin/eventos/${encodeURIComponent(id)}` })
  },
}
