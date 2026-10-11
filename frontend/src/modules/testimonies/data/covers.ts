import agua from '@/assets/icons/agua.webp'
import corazon from '@/assets/icons/corazon.webp'
import hoja from '@/assets/icons/hoja.webp'
import rayo from '@/assets/icons/rayo.webp'
import solAzul from '@/assets/icons/sol-azul.webp'
import solNaranja from '@/assets/icons/sol-naranja.webp'
import solRojo from '@/assets/icons/sol-rojo.webp'
import solRosa from '@/assets/icons/sol-rosa.webp'
import solecito from '@/assets/icons/solecito.webp'
import type { Testimony, Topic } from '@testimonies/types/testimony'

// Stickers de marca (optimizados con `npm run icons:optimize`)
export const COVERS = {
  agua,
  corazon,
  hoja,
  rayo,
  solecito,
  'sol-azul': solAzul,
  'sol-naranja': solNaranja,
  'sol-rojo': solRojo,
  'sol-rosa': solRosa,
} as const

export type CoverName = keyof typeof COVERS

// Íconos disponibles por tema; cada testimonio recibe uno fijo del grupo
const TOPIC_COVERS: Record<Topic, CoverName[]> = {
  transicion: ['rayo', 'solecito', 'hoja', 'sol-azul'],
  contaminacion: ['agua', 'sol-naranja'],
  suceso: ['corazon', 'sol-rosa', 'sol-rojo'],
}

// Hash estable (FNV-1a) del id para que la portada no cambie entre visitas;
// reparte mejor que un hash simple cuando los ids solo difieren en un dígito
function hash(value: string) {
  let h = 0x811c9dc5
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 0x01000193) >>> 0
  return h
}

export function coverFor(testimony: Pick<Testimony, 'id' | 'topic' | 'cover'>): string {
  if (testimony.cover) return COVERS[testimony.cover]
  const group = TOPIC_COVERS[testimony.topic]
  return COVERS[group[hash(testimony.id) % group.length]]
}
