import { adminGet, adminRequest } from '@admin/services/adminHttp'
import type { StaffFilters } from '@admin/services/testimonies.service'
import type { ApiEventoBitacora, ApiGeografia, PaginaMeta } from '@admin/types/api'

export interface LogFilters {
  usuario_id?: string
  accion?: string
  entidad?: string
  entidad_id?: string
  folio?: string
  desde?: string
  hasta?: string
  pagina: number
  por_pagina: number
}

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))

export const EXPORT_LIMIT = 10_000

export const systemService = {
  // Bitácora (solo superadmin): quién hizo qué, cuándo, desde dónde, con antes y después
  async log(filters: LogFilters): Promise<{ rows: ApiEventoBitacora[]; meta: PaginaMeta }> {
    const { data, meta } = await adminGet<ApiEventoBitacora[]>('/api/admin/bitacora', clean(filters))
    const total = Number(meta.total ?? 0)
    return { rows: data, meta: { total, pagina: filters.pagina, por_pagina: filters.por_pagina, paginas: Math.ceil(total / filters.por_pagina) } }
  },

  // GeoJSON con ubicación exacta y la ficha (sin datos personales). Queda en la bitácora
  async exportGeoJson(filters: StaffFilters): Promise<{ type: 'FeatureCollection'; features: unknown[] }> {
    const { pagina: _p, por_pagina: _pp, ...rest } = filters
    return (await adminGet<{ type: 'FeatureCollection'; features: unknown[] }>('/api/admin/exportar/testimonios.geojson', clean(rest))).data
  },

  // Borra auditoría vencida, sesiones y límites expirados (solo superadmin)
  async purge(): Promise<{ auditoria: number; sesiones_y_limites: number }> {
    return (await adminRequest<{ auditoria: number; sesiones_y_limites: number }>({ method: 'post', url: '/api/admin/mantenimiento/purgar' })).data
  },

  async geography(celda = 0.25): Promise<ApiGeografia> {
    return (await adminGet<ApiGeografia>('/api/admin/estadisticas/geografia', { celda })).data
  },
}
