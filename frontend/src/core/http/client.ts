import axios, { AxiosError } from 'axios'
import { getDeviceId } from '@/core/http/deviceId'

// Sobre de la API: éxito { success: true, data, ...meta } · error { success: false, error: { codigo, mensaje, detalles? } }
export type ApiResponse<T> = { success: true; data: T } & Record<string, unknown>

interface ApiErrorBody {
  success: false
  error?: { codigo?: string; mensaje?: string; detalles?: unknown }
}

export interface ApiError {
  status: number | null
  code: string | null
  message: string
  details?: unknown
}

const http = axios.create({
  // En dev se usa el proxy de Vite (mismo origen); en producción, la URL de la API
  baseURL: import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

http.interceptors.request.use((config) => {
  // Dispositivo anónimo: reacciones y likes son uno por dispositivo
  config.headers.set('X-Device-Id', getDeviceId())
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const body = error.response?.data?.error
    const apiError: ApiError = {
      status: error.response?.status ?? null,
      code: body?.codigo ?? null,
      message: body?.mensaje ?? error.message,
      details: body?.detalles,
    }
    return Promise.reject(apiError)
  },
)

export default http
