import { adminGet, adminRequest } from '@admin/services/adminHttp'
import type { ApiConfiguracion } from '@admin/types/api'

// Configuración del sistema (solo admin). Cada cambio queda en la bitácora; el back la cachea ~15 s
export const settingsService = {
  async get(): Promise<ApiConfiguracion> {
    return (await adminGet<ApiConfiguracion>('/api/admin/configuracion')).data
  },

  // Solo las claves que cambian
  async update(changes: Partial<ApiConfiguracion>): Promise<ApiConfiguracion> {
    return (await adminRequest<ApiConfiguracion>({ method: 'patch', url: '/api/admin/configuracion', data: changes })).data
  },
}
