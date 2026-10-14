import type { CoverName } from '@testimonies/data/covers'
import type { Dossier } from '@testimonies/types/testimony'

// Cada mapa es un expediente de la API (GET /api/config → expedientes). Aquí solo vive su presentación:
// título de portada, color y sticker. Un expediente nuevo aparece en la cuadrícula aunque no esté aquí.

export type MapAccent = 'green' | 'pink' | 'orange' | 'blue' | 'lime'

export interface MapInfo {
  code: string // FUTURO/001
  slug: string // futuro-001 (en la URL)
  title: string
  kicker: string // Antetítulo (qué se marca en el mapa)
  description: string
  matter: string | null // Materia del expediente
  accent: MapAccent
  sticker: CoverName
}

export const DEFAULT_MAP_CODE = 'FUTURO/001'

export const mapSlug = (code: string) =>
  code
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const DEFAULT_MAP_SLUG = mapSlug(DEFAULT_MAP_CODE)

const PRESENTATION: Record<string, Partial<MapInfo>> = {
  'FUTURO/001': {
    title: 'Juicios por Nuestro Futuro',
    kicker: 'Testimonios',
    description:
      'Testimonios de personas y comunidades sobre cómo les afecta el sistema energético nacional: apagones, cobros, megaproyectos y crisis climática. Cada historia marcada en el territorio es evidencia para el Tribunal Popular.',
    accent: 'green',
    sticker: 'rayo',
  },
}

const ACCENTS: MapAccent[] = ['pink', 'orange', 'blue', 'lime', 'green']
const STICKERS: CoverName[] = ['sol-rosa', 'sol-naranja', 'sol-azul', 'hoja', 'agua', 'corazon']

export function mapInfo(dossier: Dossier, index = 0): MapInfo {
  const p = PRESENTATION[dossier.code] ?? {}
  return {
    code: dossier.code,
    slug: mapSlug(dossier.code),
    title: p.title ?? dossier.title,
    kicker: p.kicker ?? 'Testimonios',
    description: p.description ?? dossier.description ?? dossier.matter ?? '',
    matter: dossier.matter,
    accent: p.accent ?? ACCENTS[index % ACCENTS.length],
    sticker: p.sticker ?? STICKERS[index % STICKERS.length],
  }
}

// Mientras carga /api/config (o si falla) el mapa principal sigue disponible
export const FALLBACK_DOSSIER: Dossier = {
  id: 'futuro-001',
  code: DEFAULT_MAP_CODE,
  title: 'Juicios por Nuestro Futuro',
  matter: 'Sistema Energético Nacional',
  description: null,
}

// futuro-001 → FUTURO/001 (con la lista de expedientes si ya está; si no, por convención)
export function codeFromSlug(slug: string, dossiers: Dossier[]): string {
  return dossiers.find((d) => mapSlug(d.code) === slug)?.code ?? slug.toUpperCase().replace(/-(\d+)$/, '/$1')
}

export const ACCENT_CLASSES: Record<MapAccent, { bg: string; hl: string; text: string }> = {
  green: { bg: 'bg-neon-green', hl: 'hl-green', text: 'text-black' },
  pink: { bg: 'bg-brand-pink', hl: 'hl-pink', text: 'text-black' },
  orange: { bg: 'bg-brand-orange', hl: 'hl-orange', text: 'text-black' },
  blue: { bg: 'bg-brand-blue', hl: 'hl-blue', text: 'text-white' },
  lime: { bg: 'bg-neon-lime', hl: 'hl-lime', text: 'text-black' },
}
