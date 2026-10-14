import { adminGet, adminRequest } from '@admin/services/adminHttp'
import type { ApiComentarioStaff, EstadoModeracion, PaginaMeta } from '@admin/types/api'

export interface CommentFilters {
  estado?: EstadoModeracion
  activo?: 'true' | 'false'
  testimonio_id?: string
  pagina: number
  por_pagina: number
}

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))

export const adminCommentsService = {
  // La API no devuelve `paginas`: se calcula
  async list(filters: CommentFilters): Promise<{ rows: ApiComentarioStaff[]; meta: PaginaMeta }> {
    const { data, meta } = await adminGet<ApiComentarioStaff[]>('/api/admin/comentarios', clean(filters))
    const total = Number(meta.total ?? 0)
    return { rows: data, meta: { total, pagina: filters.pagina, por_pagina: filters.por_pagina, paginas: Math.ceil(total / filters.por_pagina) } }
  },

  // Aprobar/rechazar (estado), ocultar/mostrar (activo) o editar el texto; queda en la bitácora
  async update(id: string, changes: { estado?: EstadoModeracion; activo?: boolean; contenido?: string }) {
    await adminRequest({ method: 'patch', url: `/api/admin/comentarios/${encodeURIComponent(id)}`, data: changes })
  },

  // Permanente (solo admin)
  async remove(id: string) {
    await adminRequest({ method: 'delete', url: `/api/admin/comentarios/${encodeURIComponent(id)}` })
  },
}
