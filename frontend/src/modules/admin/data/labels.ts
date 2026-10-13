import type { Autorizacion, OrigenTestimonio } from '@admin/types/api'

export const AUTORIZACION_LABELS: Record<Autorizacion, string> = {
  publico_con_nombre: 'Público con nombre',
  publico_anonimo: 'Público anónimo',
  solo_documentacion_interna: 'Solo documentación interna',
  no_autoriza: 'No autoriza publicación',
}

export const ORIGEN_LABELS: Record<OrigenTestimonio, string> = {
  web: 'Sitio web',
  facilitador: 'Facilitación (papel)',
  importacion: 'Importación',
}

export const SENSIBLE_LABELS: Record<string, string> = {
  anonimizar: 'Anonimizar',
  uso_interno: 'Uso interno',
  revision_antes_publicar: 'Revisión antes de publicar',
}

export const MULTIMEDIA_LABELS: Record<string, string> = { si: 'Sí', no: 'No', na: 'N/A' }

export const EVIDENCIA_LABELS: Record<string, string> = {
  recibo_factura: 'Recibo/factura',
  documento_oficial: 'Documento oficial',
  foto: 'Foto',
  video: 'Video',
  audio: 'Audio',
  mapa: 'Mapa',
  estudio: 'Estudio',
  datos: 'Datos',
  otro: 'Otro',
}

export const fmtDate = (iso: string | null | undefined, withTime = false) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '—'
