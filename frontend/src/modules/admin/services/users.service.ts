import { adminGet, adminRequest } from '@admin/services/adminHttp'
import type { ApiUsuarioStaff, Rol } from '@admin/types/api'

const base = (id: string) => `/api/admin/usuarios/${encodeURIComponent(id)}`

// Usuarios del dashboard (administración). Las contraseñas temporales se muestran una sola vez
export const usersService = {
  async list(): Promise<ApiUsuarioStaff[]> {
    return (await adminGet<ApiUsuarioStaff[]>('/api/admin/usuarios')).data
  },

  // Sin contraseña: el back genera una temporal (deberá cambiarse al entrar)
  async create(input: { email: string; nombre: string; rol: Rol }): Promise<{ usuario: ApiUsuarioStaff; password_temporal: string | null }> {
    return (await adminRequest<{ usuario: ApiUsuarioStaff; password_temporal: string | null }>({ method: 'post', url: '/api/admin/usuarios', data: input })).data
  },

  // Cambiar rol o desactivar cierra sus sesiones
  async update(id: string, changes: { email?: string; nombre?: string; rol?: Rol; activo?: boolean }): Promise<ApiUsuarioStaff> {
    return (await adminRequest<ApiUsuarioStaff>({ method: 'patch', url: base(id), data: changes })).data
  },

  async resetPassword(id: string): Promise<string> {
    return (await adminRequest<{ password_temporal: string }>({ method: 'post', url: `${base(id)}/restablecer-password` })).data.password_temporal
  },

  async closeSessions(id: string) {
    await adminRequest({ method: 'post', url: `${base(id)}/cerrar-sesiones` })
  },

  // Definitivo (solo superadmin); la bitácora conserva quién era
  async remove(id: string) {
    await adminRequest({ method: 'delete', url: base(id) })
  },
}
