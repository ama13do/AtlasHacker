import http, { type ApiResponse } from '@/core/http/client'
// Directo de la configuración: importar '@/modules/map' arrastraría MapLibre al bundle inicial
import { MEXICO_BOUNDS } from '@map/config'
import { fromCategory, fromCreateResponse, fromDetail, fromMapFeature, toCreatePayload } from '@testimonies/services/mappers'
import type {
  ApiColaborador,
  ApiConfig,
  ApiCrearTestimonioRespuesta,
  ApiEstadisticasPublicas,
  ApiMapa,
  ApiTestimonioDetalle,
} from '@testimonies/types/api'
import type {
  Category,
  Collaborator,
  CreateTestimonyResult,
  Dossier,
  PublicStats,
  TestimonyDetail,
  TestimonySummary,
  TestimonyDraft,
} from '@testimonies/types/testimony'

// Tope de pines por petición (la API admite hasta 5000); si se supera, la API marca `truncado`
const MAP_LIMIT = 1000

export interface PublicConfig {
  categories: Category[]
  dossiers: Dossier[] // Expedientes activos: cada uno es un mapa
  limits: { maxFiles: number; maxBytes: number; mimeTypes: string[] }
  captchaRequired: boolean
  commentsEnabled: boolean
  reactionsEnabled: boolean
  realtime: boolean
  canEdit: boolean // La persona puede editar sus testimonios (Mi folio)
  canWithdraw: boolean // …y darlos de baja
}

export const testimoniesService = {
  async getConfig(): Promise<PublicConfig> {
    const { data } = await http.get<ApiResponse<ApiConfig>>('/api/config')
    const c = data.data.configuracion
    return {
      categories: data.data.categorias.map(fromCategory),
      dossiers: (data.data.expedientes ?? []).map((e) => ({
        id: e.id,
        code: e.codigo,
        title: e.titulo,
        matter: e.materia,
        description: e.descripcion,
      })),
      limits: { maxFiles: c.max_archivos_por_testimonio, maxBytes: c.max_bytes_totales_por_testimonio, mimeTypes: c.tipos_mime_permitidos },
      captchaRequired: c.captcha_requerido,
      commentsEnabled: c.comentarios_habilitados,
      reactionsEnabled: c.reacciones_habilitadas,
      realtime: c.mapa_tiempo_real,
      canEdit: c.participantes_pueden_editar,
      canWithdraw: c.participantes_pueden_eliminar,
    }
  },

  // Pines de todo México de un expediente (resumen de cada testimonio público)
  async getSummaries(dossier?: string): Promise<{ items: TestimonySummary[]; truncated: boolean }> {
    const [[west, south], [east, north]] = MEXICO_BOUNDS
    const { data } = await http.get<ApiResponse<ApiMapa>>('/api/mapa', {
      params: { bbox: [west, south, east, north].join(','), limite: MAP_LIMIT, ...(dossier ? { expediente: dossier } : {}) },
    })
    return { items: data.data.features.map(fromMapFeature), truncated: data.data.truncado }
  },

  // Contadores públicos (la API los guarda en caché 30 s)
  async getStats(): Promise<PublicStats> {
    const { data } = await http.get<ApiResponse<ApiEstadisticasPublicas>>('/api/estadisticas')
    const d = data.data
    return {
      testimonies: d.testimonios,
      lastPublishedAt: d.ultimo_publicado_at,
      byCategory: d.por_categoria.map((c) => ({ slug: c.slug, label: c.nombre, total: c.total })),
      byState: d.por_entidad.map((e) => ({ state: e.entidad, total: e.total })),
    }
  },

  // Personas que eligieron mostrar su perfil
  async getCollaborators(): Promise<Collaborator[]> {
    const { data } = await http.get<ApiResponse<ApiColaborador[]>>('/api/colaboradores')
    return data.data
      .filter((c) => c.nombre_publico?.trim())
      .map((c) => ({ id: c.id, name: c.nombre_publico!.trim(), published: c.testimonios_publicados }))
  },

  async getDetail(id: string): Promise<TestimonyDetail> {
    const { data } = await http.get<ApiResponse<ApiTestimonioDetalle>>(`/api/testimonios/${encodeURIComponent(id)}`)
    return fromDetail(data.data)
  },

  // Sin folio, la API crea a la persona y devuelve su folio una única vez
  async create(
    draft: TestimonyDraft,
    auth: { captchaToken?: string | null; folio?: string | null } = {},
    dossier?: string,
  ): Promise<CreateTestimonyResult> {
    const headers: Record<string, string> = {}
    if (auth.captchaToken) headers['X-Captcha-Token'] = auth.captchaToken
    if (auth.folio) headers['X-Folio'] = auth.folio
    const payload = { ...toCreatePayload(draft), ...(dossier ? { expediente: dossier } : {}) }
    const { data } = await http.post<ApiResponse<ApiCrearTestimonioRespuesta>>('/api/testimonios', payload, { headers })
    return fromCreateResponse(data.data)
  },
}
