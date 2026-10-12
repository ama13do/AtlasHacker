import { BRAND } from '@/core/config/theme'
import type { CategorySlug, EvidenceType } from '@testimonies/types/testimony'

// Estilo de marca por categoría. Las categorías (nombre, descripción) vienen de la API;
// su color no es de la marca, así que aquí se asigna uno de los acentos por slug.
// Clases completas (no interpoladas) para que Tailwind las detecte
export interface CategoryStyle {
  color: string // Para MapLibre
  text: string
  bg: string
  ring: string
  from: string
  // En claro: relleno del color con ícono negro (el color sobre blanco se pierde)
  chip: string
  icon: 'zap' | 'cloud' | 'factory' | 'dot'
}

const ORANGE: Omit<CategoryStyle, 'icon'> = {
  color: BRAND.orange,
  text: 'text-brand-orange',
  bg: 'bg-brand-orange',
  ring: 'ring-brand-orange',
  from: 'from-brand-orange/35',
  chip: 'light:bg-brand-orange light:text-black',
}

const BLUE: Omit<CategoryStyle, 'icon'> = {
  color: BRAND.blue,
  text: 'text-brand-blue',
  bg: 'bg-brand-blue',
  ring: 'ring-brand-blue',
  from: 'from-brand-blue/35',
  chip: 'light:bg-brand-blue light:text-black',
}

const PINK: Omit<CategoryStyle, 'icon'> = {
  color: BRAND.pink,
  text: 'text-brand-pink',
  bg: 'bg-brand-pink',
  ring: 'ring-brand-pink',
  from: 'from-brand-pink/35',
  chip: 'light:bg-brand-pink light:text-black',
}

const GREEN: Omit<CategoryStyle, 'icon'> = {
  color: BRAND.neonGreen,
  text: 'text-neon-green',
  bg: 'bg-neon-green',
  ring: 'ring-neon-green',
  from: 'from-neon-green/35',
  chip: 'light:bg-neon-green light:text-black',
}

const CATEGORY_STYLES: Record<CategorySlug, CategoryStyle> = {
  'inseguridad-energetica': { ...ORANGE, icon: 'zap' },
  'afectaciones-cambio-climatico': { ...BLUE, icon: 'cloud' },
  megaproyectos: { ...PINK, icon: 'factory' },
}

// Categorías nuevas (creadas en el dashboard) reciben un color fijo según su slug
const FALLBACK_STYLES = [GREEN, ORANGE, BLUE, PINK]

function hash(value: string) {
  let h = 0
  for (const char of value) h = (h * 31 + char.charCodeAt(0)) >>> 0
  return h
}

export function categoryStyle(slug: CategorySlug): CategoryStyle {
  return CATEGORY_STYLES[slug] ?? { ...FALLBACK_STYLES[hash(slug) % FALLBACK_STYLES.length], icon: 'dot' }
}

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
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
