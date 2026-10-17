// Identidad de Hackers x Nuestro Futuro: dominios oficiales, logos, stickers y mascotas (src/assets/brand).
// Los logos son la marca escrita: no se reescribe el nombre a mano con tipografía.
import hackersNegro from '@/assets/brand/logo/hackers-negro.svg'
import hackersBlanco from '@/assets/brand/logo/hackers-blanco.svg'
import hxnfNegro from '@/assets/brand/logo/hxnf-negro.svg'
import hxnfBlanco from '@/assets/brand/logo/hxnf-blanco.svg'
import juiciosNegro from '@/assets/brand/logo/juicios-negro.webp'
import juiciosBlanco from '@/assets/brand/logo/juicios-blanco.webp'
import stickerHxnfVerde from '@/assets/brand/stickers/hxnf-verde.webp'
import stickerHxnfLima from '@/assets/brand/stickers/hxnf-lima.webp'
import stickerHxnfRosa from '@/assets/brand/stickers/hxnf-rosa.webp'
import stickerHxnfAzul from '@/assets/brand/stickers/hxnf-azul.webp'
import futuroVerde from '@/assets/brand/stickers/futuro-verde.webp'
import futuroLima from '@/assets/brand/stickers/futuro-lima.webp'
import futuroRosa from '@/assets/brand/stickers/futuro-rosa.webp'
import energiaJusta from '@/assets/brand/stickers/energia-justa.webp'
import somosCambio from '@/assets/brand/stickers/somos-cambio.webp'
import colectivo from '@/assets/brand/stickers/colectivo.webp'
import soluciones from '@/assets/brand/stickers/soluciones.webp'
import abaniquin from '@/assets/brand/mascotas/abaniquin.webp'
import hidraulin from '@/assets/brand/mascotas/hidraulin.webp'
import nubecin from '@/assets/brand/mascotas/nubecin.webp'
import panelin from '@/assets/brand/mascotas/panelin.webp'

// Dominios oficiales (nunca los de Vercel en textos o enlaces que ve la gente)
export const SITE_URL = 'https://atlashacker.hxnf.mx'
export const SITE_HOST = 'atlashacker.hxnf.mx'
export const HXNF_URL = 'https://hxnf.mx'

export const LOGOS = {
  hackers: { light: hackersNegro, dark: hackersBlanco }, // «hackers x nuestro futuro»
  hxnf: { light: hxnfNegro, dark: hxnfBlanco }, // acrónimo
  // Campaña «Juicios x Nuestro Futuro» (mapa FUTURO/001): light = letras negras, dark = letras blancas
  juicios: { light: juiciosNegro, dark: juiciosBlanco },
} as const

export type ThemedLogo = { light: string; dark: string }

export const STICKERS = {
  hxnf: { verde: stickerHxnfVerde, lima: stickerHxnfLima, rosa: stickerHxnfRosa, azul: stickerHxnfAzul },
  futuro: { verde: futuroVerde, lima: futuroLima, rosa: futuroRosa }, // «¿Futuro? lo estamos diseñando»
  frases: { energiaJusta, somosCambio, colectivo, soluciones },
} as const

// Mascotas: Panelín (energía solar), Abaniquín (eólica), Hidraulín (agua), Nubecín (clima). Solo en momentos
// ligeros (p. ej. al enviar un testimonio), nunca dentro de un testimonio
export const MASCOTS = { panelin, abaniquin, hidraulin, nubecin } as const
export type MascotName = keyof typeof MASCOTS

// Sticker de frase por categoría (historias e imagen para compartir sin fotos). Las mascotas no van en los
// testimonios: son relatos serios; Panelín solo celebra al enviar uno
export function phraseFor(category: string): string {
  if (category === 'inseguridad-energetica') return STICKERS.frases.energiaJusta
  if (category === 'afectaciones-cambio-climatico') return STICKERS.frases.colectivo
  if (category === 'megaproyectos') return STICKERS.frases.soluciones
  return STICKERS.frases.somosCambio
}
