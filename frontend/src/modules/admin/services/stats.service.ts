import { adminGet } from '@admin/services/adminHttp'
import type { ApiResumen } from '@admin/types/api'

export const statsService = {
  // Conteos generales del dashboard (roles: admin, moderador, lector)
  async summary(): Promise<ApiResumen> {
    return (await adminGet<ApiResumen>('/api/admin/resumen')).data
  },
}
