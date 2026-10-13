import type { AxiosRequestConfig } from 'axios'
import http, { type ApiError, type ApiResponse } from '@/core/http/client'
import { useAuthStore } from '@admin/stores/auth'

// Peticiones del dashboard: agrega el access token y, si la API responde 401, renueva la sesión
// una vez y reintenta. Si no se puede renovar, la sesión queda cerrada (el layout manda al login)
export async function adminRequest<T>(config: AxiosRequestConfig): Promise<{ data: T; meta: Record<string, unknown> }> {
  const auth = useAuthStore()

  const send = () =>
    http.request<ApiResponse<T>>({
      ...config,
      headers: { ...config.headers, ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
    })

  try {
    const { data } = await send()
    const { success: _s, data: payload, ...meta } = data
    return { data: payload, meta }
  } catch (error) {
    if ((error as Partial<ApiError>).status !== 401 || !(await auth.refresh())) throw error
    const { data } = await send()
    const { success: _s, data: payload, ...meta } = data
    return { data: payload, meta }
  }
}

export const adminGet = <T>(url: string, params?: Record<string, unknown>) => adminRequest<T>({ method: 'get', url, params })
