// Contratos crudos de la API pública (ver ../backend/src/services/publico.ts y Swagger en /docs).
// Solo los usan los servicios y los mappers; el resto de la app trabaja con types/testimony.ts

import type { Point } from 'geojson'

export type ApiTipoEvidencia =
  // Manual C.7
  | 'recibo'
  | 'factura'
  | 'oficio'
  | 'contrato'
  | 'foto'
  | 'video'
  | 'audio'
  | 'mapa'
  | 'estudio'
  | 'registro_oficial'
  | 'testimonio_escrito'
  | 'testimonio_oral'
  | 'datos'
  | 'nota_prensa'
  | 'otro'
  // De la primera versión (solo en testimonios anteriores)
  | 'recibo_factura'
  | 'documento_oficial'

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

// GET /api/estadisticas
export interface ApiEstadisticasPublicas {
  testimonios: number
  ultimo_publicado_at: string | null
  por_categoria: { slug: string; nombre: string; color: string | null; total: number }[]
  por_entidad: { entidad: string; total: number }[]
}

// GET /api/colaboradores
export interface ApiColaborador {
  id: string
  nombre_publico: string | null
  testimonios_publicados: number
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
  fuentes?: ApiFuente[] | null
  algo_mas?: string | null
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

// 04 · Los datos dicen: una fuente (Manual C.6)
export interface ApiFuente {
  fuente: string
  anio?: number
  enlace?: string
}

// Manual C.4: transmisión en vivo o grabación de voz o imagen
export type ApiVozImagen = 'voz_imagen' | 'solo_voz' | 'ninguna'

// POST /api/testimonios (CrearTestimonioSchema en el back)
export interface ApiCrearTestimonio {
  categoria: string
  expediente?: string
  fecha?: string
  titulo?: string
  lugar_territorio?: string
  entidad?: string
  municipio?: string
  ubicacion: Point
  origen_ubicacion?: 'gps' | 'mapa' | 'manual'
  aparecer_como?: 'nombre' | 'anonimo'
  nombre?: string
  facilitador_nombre?: string
  relato: string
  territorio_dice?: string
  comunidad_dice?: string
  tiene_evidencia?: 'si' | 'no' | 'pendiente'
  evidencia_descripcion?: string
  evidencia_tipos?: ApiTipoEvidencia[]
  evidencia_otro?: string
  dato_fuente_anio?: string
  fuentes?: ApiFuente[]
  fuente_pendiente_verificacion?: boolean
  pregunta_tribunal?: string
  algo_mas?: string
  registro_voz?: string
  autorizacion: 'publico_con_nombre' | 'publico_anonimo' | 'solo_documentacion_interna' | 'no_autoriza'
  autoriza_multimedia?: 'si' | 'no' | 'na'
  autoriza_voz_imagen?: ApiVozImagen
  info_sensible?: boolean
  info_menores?: boolean
  sensible_accion?: 'anonimizar' | 'uso_interno' | 'revision_antes_publicar'
  consentimiento_aceptado: true
  contacto?: { correo?: string; telefono?: string }
  auditoria?: { precision_gps_m?: number; zona_horaria?: string; idioma?: string; pantalla?: string }
}

export interface ApiCrearTestimonioRespuesta {
  testimonio: { id: string; folio: string; estado: 'pendiente' | 'aprobado' | 'rechazado'; publicado: boolean }
  participante: { folio: string; aviso: string } | null
  mensaje: string
}

// POST /api/mis-testimonios/{id}/evidencias (paso 1: reservar)
export interface ApiReservaEvidencias {
  archivos: {
    evidencia_id: string
    folio: string
    subir: { metodo: 'PUT'; url: string; cabeceras: Record<string, string>; expira_en_segundos: number }
  }[]
  limites: { max_archivos: number; max_bytes_totales: number }
}

// POST /api/mis-testimonios/{id}/evidencias/{evidenciaId}/confirmar
export interface ApiEvidenciaConfirmada {
  id: string
  folio: string
  estado_subida: 'pendiente' | 'subida'
  bytes: number
  publica: boolean
}

export type ApiTipoReaccion = 'like' | 'apoyo' | 'alerta' | 'fuego'

// POST/DELETE …/reacciones
export interface ApiReaccionRespuesta {
  agregada?: boolean
  quitada?: boolean
  reacciones_conteo: Partial<Record<ApiTipoReaccion, number>> | null
  reacciones_total: number
}

// GET /api/testimonios/{id}/comentarios
export interface ApiComentario {
  id: string
  autor_nombre: string | null
  contenido: string
  likes_conteo: number
  created_at: string
  le_di_like: boolean
}

// POST /api/testimonios/{id}/comentarios
export interface ApiComentarioCreado extends Omit<ApiComentario, 'le_di_like'> {
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  visible: boolean
}

// --- Mi folio (todas con X-Folio) ---

// GET /api/mi-perfil (con ?datos=true agrega datos_personales)
export interface ApiMiPerfil {
  id: string
  folio_pista: string
  perfil_publico: boolean
  nombre_publico: string | null
  dejo_nombre: boolean
  dejo_correo: boolean
  dejo_telefono: boolean
  created_at: string
  testimonios: number
  aprobados: number
  datos_personales?: { nombre: string | null; correo: string | null; telefono: string | null }
}

export type ApiEstadoModeracion = 'pendiente' | 'aprobado' | 'rechazado'

// GET /api/mis-testimonios
export interface ApiMiTestimonioResumen {
  id: string
  folio: string
  titulo: string | null
  estado: ApiEstadoModeracion
  activo: boolean
  es_publico: boolean
  motivo_rechazo: string | null
  lugar_territorio: string | null
  fecha: string
  categoria_slug: string
  reacciones_total: number
  comentarios_conteo: number
  created_at: string
  updated_at: string
}

// GET /api/mis-testimonios/{id} (columnas de la ficha que usa el front)
export interface ApiMiTestimonio extends Omit<ApiMiTestimonioResumen, 'categoria_slug'> {
  fecha: string
  entidad: string | null
  municipio: string | null
  aparecer_como: 'nombre' | 'anonimo'
  nombre_publico: string | null
  facilitador_nombre: string | null
  relato: string
  territorio_dice: string | null
  comunidad_dice: string | null
  tiene_evidencia: 'si' | 'no' | 'pendiente'
  evidencia_descripcion: string | null
  evidencia_tipos: ApiTipoEvidencia[] | null
  evidencia_otro: string | null
  dato_fuente_anio: string | null
  fuentes: ApiFuente[] | null
  fuente_pendiente_verificacion: boolean
  pregunta_tribunal: string | null
  algo_mas: string | null
  registro_voz: string | null
  autorizacion: ApiCrearTestimonio['autorizacion']
  autoriza_multimedia: 'si' | 'no' | 'na'
  autoriza_voz_imagen: ApiVozImagen | null
  info_sensible: boolean
  info_menores: boolean
  sensible_accion: ApiCrearTestimonio['sensible_accion'] | null
  origen_ubicacion: 'gps' | 'mapa' | 'manual' | 'importada'
  ubicacion: unknown
  centroide: Point | null
  categoria: { slug: string; nombre: string } | null
}

// PATCH /api/mis-testimonios/{id}
export type ApiEditarMiTestimonio = Partial<
  Omit<ApiCrearTestimonio, 'consentimiento_aceptado' | 'contacto' | 'auditoria' | 'expediente' | 'nombre'>
> & { nombre_publico?: string }

// GET /api/mis-testimonios/{id}/evidencias
export interface ApiMiEvidencia {
  id: string
  folio: string
  tipo: ApiTipoEvidencia
  estado_subida: 'pendiente' | 'subida'
  nombre_original: string
  mime: string
  bytes: number
  descripcion: string | null
  publica: boolean
  activo: boolean
  created_at: string
}
