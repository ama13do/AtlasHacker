import http, { type ApiResponse } from '@/core/http/client'
import type { ApiSesion, ApiUsuario } from '@admin/types/api'

// La cookie de refresh (httpOnly, path=/api/auth) solo viaja con withCredentials
const withCookie = { withCredentials: true }

export const authService = {
  async login(email: string, password: string): Promise<ApiSesion> {
    const { data } = await http.post<ApiResponse<ApiSesion>>('/api/auth/login', { email, password }, withCookie)
    return data.data
  },

  // Rota el refresh token: cada uno se usa una sola vez
  async refresh(): Promise<ApiSesion> {
    const { data } = await http.post<ApiResponse<ApiSesion>>('/api/auth/refresh', undefined, withCookie)
    return data.data
  },

  async logout(token: string | null): Promise<void> {
    await http.post('/api/auth/logout', undefined, {
      ...withCookie,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
  },

  async me(token: string): Promise<ApiUsuario> {
    const { data } = await http.get<ApiResponse<ApiUsuario>>('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    return data.data
  },

  // Cierra todas las sesiones: hay que volver a entrar
  async changePassword(token: string, current: string, next: string): Promise<void> {
    await http.post(
      '/api/auth/cambiar-password',
      { password_actual: current, password_nueva: next },
      { ...withCookie, headers: { Authorization: `Bearer ${token}` } },
    )
  },
}
