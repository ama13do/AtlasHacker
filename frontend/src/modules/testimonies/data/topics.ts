import { BRAND } from '@/core/config/theme'
import type { EvidenceType, Topic } from '@testimonies/types/testimony'

// Clases completas (no interpoladas) para que Tailwind las detecte
export const TOPIC_META: Record<
  Topic,
  { label: string; color: string; text: string; bg: string; ring: string; from: string }
> = {
  transicion: {
    label: 'Transición energética',
    color: BRAND.neonGreen,
    text: 'text-neon-green',
    bg: 'bg-neon-green',
    ring: 'ring-neon-green',
    from: 'from-neon-green/35',
  },
  contaminacion: {
    label: 'Contaminación',
    color: BRAND.orange,
    text: 'text-brand-orange',
    bg: 'bg-brand-orange',
    ring: 'ring-brand-orange',
    from: 'from-brand-orange/35',
  },
  suceso: {
    label: 'Suceso',
    color: BRAND.blue,
    text: 'text-brand-blue',
    bg: 'bg-brand-blue',
    ring: 'ring-brand-blue',
    from: 'from-brand-blue/35',
  },
}

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  recibo: 'Recibo/factura',
  documento: 'Documento oficial',
  foto: 'Foto',
  video: 'Video',
  audio: 'Audio',
  mapa: 'Mapa',
  estudio: 'Estudio',
  datos: 'Datos',
  otro: 'Otro',
}
