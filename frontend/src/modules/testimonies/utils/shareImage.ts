// Imagen para compartir un testimonio en redes, con la identidad de Hackers x Nuestro Futuro:
// logo oficial, sticker hxnf, «¿Futuro? lo estamos diseñando», color de la categoría y la leyenda
// «Este testimonio salió de atlashacker.hxnf.mx · Léelo completo y comparte el tuyo» (LEGEND, en shareEditorial.ts).
//   · story: 1080×1920 (historias de Instagram/WhatsApp; lo importante queda fuera de las zonas que tapa la app)
//   · post:  1080×1350 (publicación 4:5)
// Lo importante es el testimonio: primero se acomoda el texto (lo más completo posible, con la letra más grande
// que quepa) y las fotos ocupan el espacio que sobra. Fotos: una → grande; varias → collage (una grande y hasta
// tres chiquitas). Sin fotos → ícono de la categoría y un sticker de frase (nunca mascotas: es un relato serio).
// Todo en Parkinsans. Los otros dos diseños (negativo y brutalista) están en shareEditorial.ts.

import { LOGOS, STICKERS, SITE_HOST } from '@/core/config/brand'
import { FONT, W, drawContain, loadFonts, loadLocal, loadRemote, toBlob, wrap, type Img, type ShareCard, type ShareDesign, type ShareFormat } from './shareCanvas'
import { LEGEND, renderBrutalist, renderNegative } from './shareEditorial'

export type { ShareCard, ShareDesign, ShareFormat } from './shareCanvas'

export function renderShareImage(c: ShareCard, format: ShareFormat = 'story', design: ShareDesign = 'platform'): Promise<Blob> {
  if (design === 'negative') return renderNegative(c, format)
  if (design === 'brutalist') return renderBrutalist(c, format)
  return renderPlatform(c, format)
}

// Tarjeta de la marca: borde de tinta y sombra dura desplazada
function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, r = 32, shadow = 12) {
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.roundRect(x + shadow, y + shadow, w, h, r)
  ctx.fill()
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = '#000'
  ctx.stroke()
}

function photoCard(ctx: CanvasRenderingContext2D, img: Img, x: number, y: number, w: number, h: number, r = 28, rot = 0) {
  ctx.save()
  if (rot) {
    ctx.translate(x + w / 2, y + h / 2)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.translate(-(x + w / 2), -(y + h / 2))
  }
  card(ctx, x, y, w, h, '#fff', r, 10)
  ctx.beginPath()
  ctx.roundRect(x + 3, y + 3, w - 6, h - 6, r - 3)
  ctx.clip()
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
  ctx.restore()
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, h: number, bg: string, fg: string, size: number) {
  ctx.font = `800 ${size}px ${FONT}`
  const w = ctx.measureText(text).width + h * 0.9
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, h / 2)
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = '#000'
  ctx.stroke()
  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + h * 0.45, y + h / 2 + 1)
  ctx.textBaseline = 'top'
  return w
}

// Ajusta el texto a un alto disponible: prueba de la letra más grande a la más chica hasta que todo quepa;
// si ni con la más chica cabe, recorta el relato (con «…») a las líneas que entren
interface TextLayout {
  t: string[]
  e: string[]
  q: string[]
  tSize: number
  eSize: number
  qSize: number
  h: number
  full: boolean // el relato completo cupo
}

const qBox = (lines: number, qSize: number, story: boolean) => (story ? 50 : 44) + lines * (qSize + 9) + 22
const eLine = (eSize: number) => Math.round(eSize * 1.38)
const NO_LIMIT = 999

// Tamaños (título, relato) de mayor a menor: un relato corto se ve grande y uno largo cabe completo
const SIZES = {
  story: [[76, 54], [72, 50], [68, 46], [64, 42], [60, 40], [58, 38], [56, 36], [54, 34], [52, 32], [52, 30]],
  post: [[62, 42], [58, 38], [54, 35], [52, 33], [50, 31], [48, 29], [46, 27], [44, 25], [42, 24]],
} as const

function layoutText(ctx: CanvasRenderingContext2D, c: ShareCard, story: boolean, textW: number, available: number): TextLayout {
  const sizes = SIZES[story ? 'story' : 'post']
  const titleMax = story ? 4 : 3
  const questionMax = story ? 4 : 3
  const measure = (tSize: number, eSize: number, excerptMax: number): TextLayout => {
    const qSize = Math.min(eSize, story ? 38 : 32)
    ctx.font = `800 ${tSize}px ${FONT}`
    const t = wrap(ctx, c.title, textW, titleMax)
    ctx.font = `400 ${eSize}px ${FONT}`
    const e = c.excerpt && excerptMax > 0 ? wrap(ctx, c.excerpt, textW, excerptMax) : []
    ctx.font = `800 ${qSize}px ${FONT}`
    const q = c.question ? wrap(ctx, `«${c.question}»`, textW - 40, questionMax) : []
    const h = 38 + t.length * (tSize + 6) + (e.length ? 18 + e.length * eLine(eSize) : 0) + (q.length ? 26 + qBox(q.length, qSize, story) : 0) + 36
    return { t, e, q, tSize, eSize, qSize, h, full: e.length < excerptMax }
  }
  for (const [tSize, eSize] of sizes) {
    const m = measure(tSize, eSize, NO_LIMIT)
    if (m.h <= available) return m
  }
  // Ni con la letra más chica: tantas líneas del relato como quepan (termina en «…»)
  const [tSize, eSize] = sizes.at(-1)!
  let lines = Math.max(1, Math.floor(available / eLine(eSize)))
  let m = measure(tSize, eSize, lines)
  while (m.h > available && lines > 1) m = measure(tSize, eSize, --lines)
  return { ...m, full: false }
}

async function renderPlatform(c: ShareCard, format: ShareFormat): Promise<Blob> {
  const story = format === 'story'
  const H = story ? 1920 : 1350
  const PAD = story ? 64 : 52
  const inner = W - PAD * 2

  await loadFonts()
  const [logo, hxnf, futuro, cover, phrase, ...photos] = await Promise.all([
    loadLocal(LOGOS.hackers.light),
    loadLocal(c.campaignLogo?.light ?? STICKERS.hxnf.lima),
    loadLocal(STICKERS.futuro.lima),
    loadLocal(c.coverUrl),
    c.photoUrls.length ? Promise.resolve(null) : loadLocal(c.phraseUrl),
    ...c.photoUrls.slice(0, 4).map(loadRemote),
  ])
  const pics = photos.filter((p): p is Img => !!p)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'top'

  // Fondo: color de la categoría con semitono
  ctx.fillStyle = c.color
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(0,0,0,0.09)'
  for (let y = 0; y < H; y += 20) {
    for (let x = (y / 20) % 2 ? 10 : 0; x < W; x += 20) {
      ctx.beginPath()
      ctx.arc(x, y, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Cabecera: logo oficial en una placa blanca + sticker hxnf (en historia, debajo de la zona que tapa Instagram)
  const top = story ? 128 : 40
  const logoH = story ? 72 : 52
  if (logo) {
    const lw = (logo.width / logo.height) * logoH
    card(ctx, PAD, top, lw + 48, logoH + 32, '#fff', 24, 8)
    ctx.drawImage(logo, PAD + 24, top + 16, lw, logoH)
  }
  // Logo de la campaña (letras negras sobre el color de la categoría) o, si el mapa no tiene, el sticker hxnf
  if (hxnf && c.campaignLogo) {
    const lw = story ? 250 : 200
    drawContain(ctx, hxnf, W - PAD - lw / 2, top + (logoH + 32) / 2, lw, (logoH + 32) * 1.25, -3)
  } else if (hxnf) drawContain(ctx, hxnf, W - PAD - 110, top + (logoH + 32) / 2, 220, 92, 6)

  // Categoría · lugar · fecha
  let y = top + logoH + 32 + (story ? 34 : 24)
  const chipH = story ? 52 : 44
  const chipW = pill(ctx, c.category.toUpperCase(), PAD, y, chipH, '#000', '#e0fa49', story ? 25 : 21)
  ctx.font = `700 ${story ? 28 : 24}px ${FONT}`
  ctx.fillStyle = c.ink
  const where = `${c.place} · ${c.date}`
  if (ctx.measureText(where).width <= inner - chipW - 20) {
    ctx.textBaseline = 'middle'
    ctx.fillText(where, PAD + chipW + 18, y + chipH / 2 + 1)
    ctx.textBaseline = 'top'
    y += chipH + (story ? 30 : 22)
  } else {
    y += chipH + 12
    ctx.fillText(where, PAD, y, inner)
    y += story ? 54 : 44
  }

  // Espacio entre la cabecera y la leyenda: primero el texto, luego las fotos con lo que sobre
  const footerTop = story ? H - 330 : H - 132
  const gap = story ? 44 : 30
  // Fotos o stickers: un alto cómodo si el relato cabe completo; si no, se encogen para dejarle lugar
  const mediaPref = pics.length ? (story ? 600 : 380) : story ? 300 : 130
  const mediaMin = pics.length ? (story ? 380 : 250) : story ? 160 : 0
  const mediaMax = pics.length ? (story ? 760 : 480) : story ? 380 : 170
  const textW = inner - 72
  const room = footerTop - gap - y
  const forMedia = (h: number) => (h ? h + gap : 0)
  let m = layoutText(ctx, c, story, textW, room - forMedia(mediaPref))
  if (!m.full && mediaMin < mediaPref) m = layoutText(ctx, c, story, textW, room - forMedia(mediaMin))
  const spare = room - m.h - gap
  const mediaH = spare >= mediaMin ? Math.min(mediaMax, spare) : mediaMin
  // Si aún sobra, se reparte arriba y abajo para que no quede un hueco
  y += Math.max(0, spare - mediaH) / 2

  // Fotos: una grande al centro; las demás, chiquitas y giradas en las esquinas (collage), sin tapar la principal
  if (pics.length) {
    const extra = pics.slice(1, 4)
    const bigInset = extra.length ? (story ? 30 : 24) : 0
    const bigH = mediaH - (extra.length ? Math.round(mediaH * 0.08) : 0)
    photoCard(ctx, pics[0], PAD + bigInset, y, inner - bigInset * 2, bigH, 32, -1)
    const sw = Math.min(inner * (story ? 0.27 : 0.24), mediaH * 0.48)
    const sh = sw * 0.78
    const spots = [
      { x: PAD - 14, y: y + mediaH - sh, r: -6 },
      { x: W - PAD - sw + 14, y: y + mediaH - sh - 4, r: 5 },
      { x: W - PAD - sw + 18, y: y + mediaH * 0.06, r: 7 },
    ]
    extra.forEach((p, i) => photoCard(ctx, p, spots[i].x, spots[i].y, sw, sh, 18, spots[i].r))
  } else if (mediaH > 0) {
    // Sin fotos: ícono de la categoría y sticker de frase, como pegados en la hoja
    if (cover) drawContain(ctx, cover, PAD + mediaH * 0.5, y + mediaH / 2, mediaH * 0.95, mediaH * 0.95, -8)
    if (phrase) drawContain(ctx, phrase, W - PAD - inner * 0.3, y + mediaH / 2, inner * 0.56, mediaH * 0.92, 5)
  }
  if (mediaH > 0) y += mediaH + gap

  // Tarjeta del testimonio: título, el relato y la pregunta del Tribunal
  card(ctx, PAD, y, inner, m.h, '#fff')
  let ty = y + 38
  ctx.fillStyle = '#000'
  ctx.font = `800 ${m.tSize}px ${FONT}`
  for (const line of m.t) {
    ctx.fillText(line, PAD + 36, ty, textW)
    ty += m.tSize + 6
  }
  if (m.e.length) {
    ty += 18
    ctx.font = `400 ${m.eSize}px ${FONT}`
    ctx.fillStyle = '#1a1a1a'
    for (const line of m.e) {
      ctx.fillText(line, PAD + 36, ty, textW)
      ty += eLine(m.eSize)
    }
  }
  if (m.q.length) {
    ty += 26
    const qh = qBox(m.q.length, m.qSize, story)
    ctx.fillStyle = '#e0fa49'
    ctx.beginPath()
    ctx.roundRect(PAD + 22, ty, inner - 44, qh, 22)
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = '#000'
    ctx.stroke()
    ctx.fillStyle = '#000'
    ctx.font = `800 ${story ? 22 : 19}px ${FONT}`
    ctx.fillText('EL TRIBUNAL PREGUNTA', PAD + 44, ty + 18)
    ctx.font = `800 ${m.qSize}px ${FONT}`
    m.q.forEach((line, i) => ctx.fillText(line, PAD + 44, ty + (story ? 50 : 44) + i * (m.qSize + 9), textW - 40))
  }

  // Leyenda: banda negra + sticker «¿Futuro? lo estamos diseñando»
  const bandH = story ? 180 : 112
  const bandX = story ? PAD : 0
  const bandW = story ? inner : W
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.roundRect(bandX, footerTop, bandW, bandH, story ? 32 : 0)
  ctx.fill()
  const bx = bandX + (story ? 40 : PAD)
  const bandTextW = bandW - (story ? 40 : PAD) - (story ? 330 : 300)
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${story ? 30 : 24}px ${FONT}`
  ctx.fillText(LEGEND.before, bx, footerTop + (story ? 32 : 18), bandTextW)
  ctx.fillStyle = '#e0fa49'
  ctx.font = `800 ${story ? 42 : 34}px ${FONT}`
  ctx.fillText(SITE_HOST, bx, footerTop + (story ? 76 : 46), bandTextW)
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${story ? 28 : 22}px ${FONT}`
  ctx.fillText(LEGEND.after, bx, footerTop + (story ? 128 : 84), bandTextW)
  if (futuro) drawContain(ctx, futuro, bandX + bandW - (story ? 165 : 160), footerTop + bandH / 2 - (story ? 8 : 4), story ? 300 : 270, story ? 130 : 110, -5)

  // Folio, discreto
  if (story) {
    ctx.fillStyle = c.ink
    ctx.globalAlpha = 0.65
    ctx.font = `600 24px ${FONT}`
    ctx.fillText(c.folio, PAD, footerTop + bandH + 20)
    ctx.globalAlpha = 1
  }

  return toBlob(canvas)
}
