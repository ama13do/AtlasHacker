import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
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

// Picos de gente (p. ej. muchas personas que escanean la lona a la vez): si AWS responde «ocupado», las
// lecturas (GET) se reintentan solas un par de veces con espera creciente en lugar de mostrar error.
// Las respuestas de error de API Gateway no traen CORS: el navegador las ve como ERR_NETWORK
const BUSY = new Set([429, 502, 503, 504])
const MAX_RETRIES = 2
type RetryConfig = InternalAxiosRequestConfig & { retries?: number }

function shouldRetry(error: AxiosError<ApiErrorBody>, config: RetryConfig | undefined): config is RetryConfig {
  if (!config || config.method !== 'get' || (config.retries ?? 0) >= MAX_RETRIES) return false
  const status = error.response?.status
  if (status === undefined) return error.code === 'ERR_NETWORK'
  // Un 500 sin el sobre de la API viene de AWS (p. ej. límite de Lambdas), no de un error real del servidor
  return BUSY.has(status) || (status === 500 && !error.response?.data?.error)
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetryConfig | undefined
    if (shouldRetry(error, config)) {
      config.retries = (config.retries ?? 0) + 1
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** config.retries! + Math.random() * 400))
      return http.request(config)
    }
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
