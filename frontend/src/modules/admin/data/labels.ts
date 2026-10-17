import { EVIDENCE_LABELS } from '@testimonies/data/categories'
import type { Autorizacion, OrigenTestimonio, Rol } from '@admin/types/api'

export const ROLE_LABELS: Record<Rol, string> = {
  superadmin: 'Superadmin',
  admin: 'Administración',
  moderador: 'Moderación',
  facilitador: 'Facilitación',
  lector: 'Lectura',
}

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

export const MULTIMEDIA_LABELS: Record<string, string> = { si: 'Sí', no: 'No', na: 'No aplica' }
export const VOZ_IMAGEN_LABELS: Record<string, string> = { voz_imagen: 'Voz e imagen', solo_voz: 'Solo voz', ninguna: 'Ninguna' }

// Mismas etiquetas que la zona pública (Manual C.7 + las de la primera versión)
export const EVIDENCIA_LABELS: Record<string, string> = EVIDENCE_LABELS

export const fmtDate = (iso: string | null | undefined, withTime = false) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '—'
