// Contratos crudos de la API pública (ver ../backend/src/services/publico.ts y Swagger en /docs).
// Solo los usan los servicios y los mappers; el resto de la app trabaja con types/testimony.ts

import type { Point } from 'geojson'

export type ApiTipoEvidencia =
  | 'recibo_factura'
  | 'documento_oficial'
  | 'foto'
  | 'video'
  | 'audio'
  | 'mapa'
  | 'estudio'
  | 'datos'
  | 'otro'

export interface ApiCategoria {
  id: string
  slug: string
  nombre: string
  descripcion: string | null
  color: string | null
  icono: string | null
}

export interface ApiExpediente {
  id: string
  codigo: string
  titulo: string
  materia: string | null
  descripcion: string | null
}

export interface ApiConfiguracionPublica {
  max_archivos_por_testimonio: number
  max_bytes_totales_por_testimonio: number
  tipos_mime_permitidos: string[]
  captcha_requerido: boolean
  comentarios_habilitados: boolean
  reacciones_habilitadas: boolean
  participantes_pueden_editar: boolean
  participantes_pueden_eliminar: boolean
  mapa_tiempo_real: boolean
  consentimiento_version_actual: string
}

// GET /api/config
export interface ApiConfig {
  categorias: ApiCategoria[]
  expedientes: ApiExpediente[]
  configuracion: ApiConfiguracionPublica
}

// GET /api/mapa (geometria=punto) → FeatureCollection con estas properties
export interface ApiMapaProps {
  id: string
  folio: string
  titulo: string | null
  categoria_slug: string
  categoria_nombre: string
  categoria_color: string | null
  tipo_geometria: string
  aproximada: boolean
  fecha: string // AAAA-MM-DD
  lugar_territorio: string | null
  reacciones_total: number
  comentarios_conteo: number
}

export interface ApiMapa {
  type: 'FeatureCollection'
  features: { type: 'Feature'; id: string; geometry: Point; properties: ApiMapaProps }[]
  truncado: boolean
  limite: number
}

export interface ApiEvidenciaPublica {
  id: string
  folio: string
  tipo: ApiTipoEvidencia
  mime: string
  nombre: string
  bytes: number
  descripcion: string | null
  url: string // firmada, válida 1 h
}

// GET /api/testimonios/{id}
export interface ApiTestimonioDetalle {
  id: string
  folio: string
  expediente_codigo: string
  categoria_slug: string
  categoria_nombre: string
  categoria_color: string | null
  titulo: string | null
  fecha: string
  lugar_territorio: string | null
  entidad: string | null
  municipio: string | null
  nombre_publico: string | null
  relato: string
  territorio_dice: string | null
  comunidad_dice: string | null
  tiene_evidencia: 'si' | 'no' | 'pendiente'
  evidencia_tipos: ApiTipoEvidencia[] | null
  dato_fuente_anio: string | null
  fuente_pendiente_verificacion: boolean
  pregunta_tribunal: string | null
  tipo_geometria: string
  aproximada: boolean
  ubicacion: unknown
  centroide: Point
  reacciones_conteo: Record<string, number> | null
  reacciones_total: number
  comentarios_conteo: number
  publicado_at: string | null
  created_at: string
  evidencias: ApiEvidenciaPublica[]
}
