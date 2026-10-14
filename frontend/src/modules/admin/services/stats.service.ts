import { adminGet } from '@admin/services/adminHttp'
import http from '@/core/http/client'
import type { ApiResumen, ApiSerie } from '@admin/types/api'

export const statsService = {
  // Conteos generales del dashboard (roles: admin, moderador, lector)
  async summary(): Promise<ApiResumen> {
    return (await adminGet<ApiResumen>('/api/admin/resumen')).data
  },

  // Serie de tiempo (recibidos / aprobados / rechazados) por día, semana o mes; opcionalmente de una categoría
  async series(desde: string, hasta: string, agrupar: 'dia' | 'semana' | 'mes', categoria?: string): Promise<ApiSerie[]> {
    return (await adminGet<ApiSerie[]>('/api/admin/estadisticas/serie', { desde, hasta, agrupar, ...(categoria ? { categoria } : {}) })).data
  },

  // Estado de la API (público): para el indicador del panel
  async health(): Promise<{ online: boolean; ms: number }> {
    const start = performance.now()
    try {
      const { data } = await http.get<{ data: { estado: string } }>('/health', { timeout: 8000 })
      return { online: data.data.estado === 'online', ms: Math.round(performance.now() - start) }
    } catch {
      return { online: false, ms: Math.round(performance.now() - start) }
    }
  },
}
