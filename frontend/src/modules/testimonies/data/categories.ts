import { BRAND } from '@/core/config/theme'
import type { CategorySlug, EvidenceType } from '@testimonies/types/testimony'

// Estilo de marca por categoría. Las categorías (nombre, descripción) vienen de la API;
// su color no es de la marca, así que aquí se asigna uno de los acentos por slug.
// Clases completas (no interpoladas) para que Tailwind las detecte
export interface CategoryStyle {
  color: string // Para MapLibre
  ink: string // Texto e ícono sobre `color`
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
  ink: BRAND.black,
  text: 'text-brand-orange',
  bg: 'bg-brand-orange',
  ring: 'ring-brand-orange',
  from: 'from-brand-orange/35',
  chip: 'light:bg-brand-orange light:text-black',
}

const BLUE: Omit<CategoryStyle, 'icon'> = {
  color: BRAND.blue,
  ink: BRAND.white,
  text: 'text-brand-blue',
  bg: 'bg-brand-blue',
  ring: 'ring-brand-blue',
  from: 'from-brand-blue/35',
  chip: 'light:bg-brand-blue light:text-black',
}

const PINK: Omit<CategoryStyle, 'icon'> = {
  color: BRAND.pink,
  ink: BRAND.black,
  text: 'text-brand-pink',
  bg: 'bg-brand-pink',
  ring: 'ring-brand-pink',
  from: 'from-brand-pink/35',
  chip: 'light:bg-brand-pink light:text-black',
}

const GREEN: Omit<CategoryStyle, 'icon'> = {
  color: BRAND.neonGreen,
  ink: BRAND.black,
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

// Mismos trazos que CategoryIcon.vue, como SVG en texto para los pines HTML del mapa
const ICON_PATHS: Record<CategoryStyle['icon'], string> = {
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor"/>',
  cloud: '<path d="M20 16.6A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><path d="M8 19v2M8 13v2M16 19v2M16 13v2M12 21v2M12 15v2"/>',
  factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1M12 18h1M7 18h1"/>',
  dot: '<circle cx="12" cy="12" r="5" fill="currentColor"/>',
}

export function categoryIconSvg(slug: CategorySlug): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[categoryStyle(slug).icon]}</svg>`
}

// Manual C.7 · Evidencias que acompañan el testimonio (en este orden se ofrecen)
export const EVIDENCE_OPTIONS: EvidenceType[] = [
  'recibo',
  'factura',
  'oficio',
  'contrato',
  'foto',
  'video',
  'audio',
  'mapa',
  'estudio',
  'registro_oficial',
  'testimonio_escrito',
  'testimonio_oral',
  'datos',
  'nota_prensa',
  'otro',
]

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  recibo: 'Recibo',
  factura: 'Factura',
  oficio: 'Oficio',
  contrato: 'Contrato',
  foto: 'Fotografía',
  video: 'Video',
  audio: 'Audio',
  mapa: 'Mapa',
  estudio: 'Estudio',
  registro_oficial: 'Registro oficial',
  testimonio_escrito: 'Testimonio escrito',
  testimonio_oral: 'Testimonio oral',
  datos: 'Datos estadísticos',
  nota_prensa: 'Nota de prensa',
  otro: 'Otro',
  // Primera versión
  recibo_factura: 'Recibo/factura',
  documento_oficial: 'Documento oficial',
}
