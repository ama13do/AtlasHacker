import axios, { AxiosError } from 'axios'

export interface ApiError {
  status: number | null
  message: string
  data?: unknown
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

http.interceptors.request.use((config) => {
  // Punto para adjuntar el token cuando exista autenticación:
  // const token = ...
  // if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const apiError: ApiError = {
      status: error.response?.status ?? null,
      message: error.response?.data?.message ?? error.message,
      data: error.response?.data,
    }
    return Promise.reject(apiError)
  },
)

export default http
