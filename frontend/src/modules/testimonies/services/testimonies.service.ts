import http, { type ApiResponse } from '@/core/http/client'
import { MEXICO_BOUNDS } from '@/modules/map'
import { fromCategory, fromDetail, fromMapFeature } from '@testimonies/services/mappers'
import type { ApiConfig, ApiMapa, ApiTestimonioDetalle } from '@testimonies/types/api'
import type { Category, CreateTestimonyResult, TestimonyDetail, TestimonySummary, TestimonyDraft } from '@testimonies/types/testimony'

// Tope de pines por petición (la API admite hasta 5000); si se supera, la API marca `truncado`
const MAP_LIMIT = 1000

export interface PublicConfig {
  categories: Category[]
  limits: { maxFiles: number; maxBytes: number; mimeTypes: string[] }
  captchaRequired: boolean
}

export const testimoniesService = {
  async getConfig(): Promise<PublicConfig> {
    const { data } = await http.get<ApiResponse<ApiConfig>>('/api/config')
    const c = data.data.configuracion
    return {
      categories: data.data.categorias.map(fromCategory),
      limits: { maxFiles: c.max_archivos_por_testimonio, maxBytes: c.max_bytes_totales_por_testimonio, mimeTypes: c.tipos_mime_permitidos },
      captchaRequired: c.captcha_requerido,
    }
  },

  // Pines de todo México (resumen de cada testimonio público)
  async getSummaries(): Promise<{ items: TestimonySummary[]; truncated: boolean }> {
    const [[west, south], [east, north]] = MEXICO_BOUNDS
    const { data } = await http.get<ApiResponse<ApiMapa>>('/api/mapa', {
      params: { bbox: [west, south, east, north].join(','), limite: MAP_LIMIT },
    })
    return { items: data.data.features.map(fromMapFeature), truncated: data.data.truncado }
  },

  async getDetail(id: string): Promise<TestimonyDetail> {
    const { data } = await http.get<ApiResponse<ApiTestimonioDetalle>>(`/api/testimonios/${encodeURIComponent(id)}`)
    return fromDetail(data.data)
  },

  // TODO etapa 2: POST /api/testimonios con captcha (X-Captcha-Token) y folio (X-Folio)
  async create(_draft: TestimonyDraft): Promise<CreateTestimonyResult> {
    throw new Error('El envío de testimonios a la API llega en la siguiente etapa.')
  },
}
