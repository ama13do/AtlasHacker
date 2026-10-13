// Contratos crudos de /api/auth y /api/admin (ver ../backend/src/routes/auth.ts y routes/admin/*)

export type Rol = 'admin' | 'moderador' | 'facilitador' | 'lector'

export interface ApiUsuario {
  id: string
  email: string
  nombre: string | null
  rol: Rol
  debe_cambiar_password: boolean
}

// POST /api/auth/login y /api/auth/refresh
export interface ApiSesion {
  access_token: string
  token_type: 'Bearer'
  expira_en_segundos: number
  usuario: ApiUsuario
}

// GET /api/admin/resumen
export interface ApiResumen {
  testimonios: {
    total: number
    pendientes: number
    aprobados: number
    rechazados: number
    inactivos: number
    publicos: number
    sensibles: number
    pendientes_antiguos: number
    ultimos_7_dias: number
    reacciones: number
  }
  por_categoria: { id: string; slug: string; nombre: string; color: string | null; total: number; publicos: number; pendientes: number }[]
  por_expediente: { id: string; codigo: string; materia: string | null; total: number; publicos: number }[]
  por_origen: { origen: string; total: number }[]
  participantes: { total: number; con_perfil_publico: number; con_correo: number; con_telefono: number; activos: number }
  comentarios: { total: number; pendientes: number; ocultos: number; likes: number }
  evidencias: { total: number; bytes: number; publicas: number }
  ultimos_30_dias: { fecha: string; recibidos: number; aprobados: number }[]
}

// --- Testimonios (moderación) ---

export type EstadoModeracion = 'pendiente' | 'aprobado' | 'rechazado'
export type Autorizacion = 'publico_con_nombre' | 'publico_anonimo' | 'solo_documentacion_interna' | 'no_autoriza'
export type AccionModeracion = 'aprobar' | 'rechazar' | 'desaprobar' | 'activar' | 'desactivar'
export type OrigenTestimonio = 'web' | 'facilitador' | 'importacion'

interface PuntoGeo {
  type: 'Point'
  coordinates: [number, number]
}

// GET /api/admin/testimonios (una fila)
export interface ApiTestimonioStaffFila {
  id: string
  folio: string
  titulo: string | null
  estado: EstadoModeracion
  activo: boolean
  es_publico: boolean
  origen: OrigenTestimonio
  fecha: string
  lugar_territorio: string | null
  entidad: string | null
  municipio: string | null
  autorizacion: Autorizacion
  info_sensible: boolean
  sensible_accion: 'anonimizar' | 'uso_interno' | 'revision_antes_publicar' | null
  aparecer_como: 'nombre' | 'anonimo'
  ubicacion_aproximada: boolean
  centroide: PuntoGeo | null
  participante_id: string
  facilitador_nombre: string | null
  categoria_slug: string
  expediente_codigo: string
  relato_resumen: string
  evidencias_conteo: number
  reacciones_total: number
  comentarios_conteo: number
  created_at: string
  updated_at: string
}

// Meta de la página: total, pagina, por_pagina, paginas
export interface PaginaMeta {
  total: number
  pagina: number
  por_pagina: number
  paginas: number
}

export interface ApiEvidenciaStaff {
  id: string
  folio: string
  tipo: string
  estado_subida: 'pendiente' | 'subida'
  nombre_original: string
  mime: string
  bytes: number
  descripcion: string | null
  publica: boolean
  activo: boolean
  created_at: string
}

// GET /api/admin/testimonios/{id}
export interface ApiTestimonioStaff extends Omit<ApiTestimonioStaffFila, 'categoria_slug' | 'expediente_codigo' | 'relato_resumen' | 'evidencias_conteo'> {
  nombre_publico: string | null
  origen_ubicacion: string
  tipo_geometria: string
  ubicacion: unknown
  ubicacion_publica: unknown
  relato: string
  territorio_dice: string | null
  comunidad_dice: string | null
  tiene_evidencia: 'si' | 'no' | 'pendiente'
  evidencia_descripcion: string | null
  evidencia_tipos: string[] | null
  evidencia_otro: string | null
  dato_fuente_anio: string | null
  fuente_pendiente_verificacion: boolean
  pregunta_tribunal: string | null
  autoriza_multimedia: 'si' | 'no' | 'na'
  consentimiento_version: string | null
  consentimiento_at: string | null
  moderado_at: string | null
  motivo_rechazo: string | null
  notas_internas: string | null
  publicado_at: string | null
  categoria: { id: string; slug: string; nombre: string; color: string | null } | null
  expediente: { id: string; codigo: string; titulo: string; materia: string | null } | null
  evidencias: ApiEvidenciaStaff[]
  tiene_auditoria: boolean
}

// PATCH /api/admin/testimonios/{id} (subconjunto que edita el dashboard)
export interface ApiEditarTestimonioStaff {
  categoria?: string
  titulo?: string
  lugar_territorio?: string
  entidad?: string
  municipio?: string
  relato?: string
  territorio_dice?: string
  comunidad_dice?: string
  dato_fuente_anio?: string
  pregunta_tribunal?: string
  notas_internas?: string | null
  ubicacion_aproximada?: boolean
}

// GET /api/admin/testimonios/{id}/auditoria (solo admin)
export interface ApiAuditoria {
  ip: string | null
  user_agent: string | null
  captcha_ok: boolean | null
  origen_ubicacion: string | null
  precision_gps_m: number | null
  zona_horaria: string | null
  idioma: string | null
  pantalla: string | null
  referer: string | null
  consentimiento_version: string | null
  retener_hasta: string | null
  created_at: string
}
