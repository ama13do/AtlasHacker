// Imagen para compartir un testimonio en redes, con la identidad de Hackers x Nuestro Futuro:
// logo oficial, sticker hxnf, «¿Futuro? lo estamos diseñando», color de la categoría y la leyenda
// «Este testimonio salió del sitio web atlashacker.hxnf.mx · comparte tu experiencia».
//   · story: 1080×1920 (historias de Instagram/WhatsApp; lo importante queda fuera de las zonas que tapa la app)
//   · post:  1080×1350 (publicación 4:5)
// Fotos: una → grande; varias → collage (una grande y hasta tres chiquitas). Sin fotos → la mascota de la categoría.
// Todo en Parkinsans. Las fotos de R2 se leen con CORS (el bucket lo permite).

import { LOGOS, STICKERS, SITE_HOST } from '@/core/config/brand'

export type ShareFormat = 'story' | 'post'

export interface ShareCard {
  title: string
  place: string
  date: string // ya formateada
  category: string
  color: string // fondo (color de la categoría)
  ink: string // texto sobre `color`
  excerpt: string
  question?: string
  photoUrls: string[] // fotos públicas, en orden
  mascotUrl: string // si no hay fotos
  coverUrl: string // sticker del testimonio
  folio: string
}

const FONT = '"Parkinsans Variable", system-ui, sans-serif'
const W = 1080

type Img = ImageBitmap | HTMLImageElement

// Fotos de R2 (otro origen): sin caché, porque si la miniatura ya la cargó sin CORS el navegador reusaría esa respuesta
async function loadRemote(url: string): Promise<Img | null> {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' })
    if (!res.ok) return null
    return await createImageBitmap(await res.blob())
  } catch {
    return null
  }
}

// Recursos propios (logos SVG y stickers): mismo origen, se cargan como <img>
function loadLocal(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''
  let used = 0
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= width) {
      line = test
      used++
      continue
    }
    if (line) lines.push(line)
    if (lines.length === max) break
    line = word
    used++
  }
  if (lines.length < max && line) lines.push(line)
  if (used < words.length || lines.length > max) {
    lines.length = Math.min(lines.length, max)
    let last = lines[lines.length - 1] ?? ''
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1)
    lines[lines.length - 1] = `${last.trimEnd()}…`
  }
  return lines
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

function drawContain(ctx: CanvasRenderingContext2D, img: Img, cx: number, cy: number, maxW: number, maxH: number, rot = 0) {
  const s = Math.min(maxW / img.width, maxH / img.height)
  const w = img.width * s
  const h = img.height * s
  ctx.save()
  ctx.translate(cx, cy)
  if (rot) ctx.rotate((rot * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()
  return { w, h }
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

export async function renderShareImage(c: ShareCard, format: ShareFormat = 'story'): Promise<Blob> {
  const story = format === 'story'
  const H = story ? 1920 : 1350
  const PAD = story ? 72 : 60
  const inner = W - PAD * 2

  await Promise.all([document.fonts.load(`800 64px ${FONT}`), document.fonts.load(`600 32px ${FONT}`), document.fonts.load(`400 32px ${FONT}`)])
  const [logo, hxnf, futuro, cover, ...photos] = await Promise.all([
    loadLocal(LOGOS.hackers.light),
    loadLocal(STICKERS.hxnf.lima),
    loadLocal(STICKERS.futuro.lima),
    loadLocal(c.coverUrl),
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

  // Cabecera: logo oficial en una placa blanca + sticker hxnf
  const top = story ? 150 : 52
  const logoH = story ? 86 : 64
  if (logo) {
    const lw = (logo.width / logo.height) * logoH
    card(ctx, PAD, top, lw + 56, logoH + 40, '#fff', 26, 8)
    ctx.drawImage(logo, PAD + 28, top + 20, lw, logoH)
  }
  if (hxnf) drawContain(ctx, hxnf, W - PAD - 130, top + (logoH + 40) / 2, 260, 110, 6)

  // Categoría y lugar
  let y = top + logoH + 40 + (story ? 44 : 30)
  const chipH = story ? 58 : 50
  pill(ctx, c.category.toUpperCase(), PAD, y, chipH, '#000', '#e0fa49', story ? 28 : 24)
  y += chipH + 16
  ctx.font = `700 ${story ? 32 : 28}px ${FONT}`
  ctx.fillStyle = c.ink
  ctx.fillText(`${c.place} · ${c.date}`, PAD, y, inner)
  y += story ? 64 : 50

  // Fotos: una grande al centro; las demás, chiquitas y giradas encima de las esquinas (collage)
  const footerTop = story ? H - 360 : H - 150
  const mediaH = story ? (c.question ? 600 : 680) : 440
  if (pics.length) {
    const extra = pics.slice(1, 4)
    const bigInset = extra.length ? (story ? 34 : 26) : 0
    photoCard(ctx, pics[0], PAD + bigInset, y, inner - bigInset * 2, mediaH - (extra.length ? (story ? 70 : 50) : 0), 34, -1)
    const sw = inner * (story ? 0.34 : 0.3)
    const sh = sw * 0.8
    const spots = [
      { x: PAD - 14, y: y + mediaH - sh, r: -6 },
      { x: W - PAD - sw + 14, y: y + mediaH - sh - 8, r: 5 },
      { x: W - PAD - sw + 22, y: y - 28, r: 7 },
    ]
    extra.forEach((p, i) => photoCard(ctx, p, spots[i].x, spots[i].y, sw, sh, 20, spots[i].r))
  } else {
    const mascot = await loadLocal(c.mascotUrl)
    if (mascot) drawContain(ctx, mascot, W / 2 - 110, y + mediaH / 2, inner * 0.62, mediaH * 0.92, -4)
    if (cover) drawContain(ctx, cover, W - PAD - 150, y + mediaH * 0.32, 260, 260, 10)
  }
  y += mediaH + (story ? 50 : 36)

  // Texto: título, extracto y (si hay) la pregunta del Tribunal en una sola tarjeta. Se ajusta el número de
  // líneas hasta que quepa antes de la leyenda
  const tSize = story ? 62 : 52
  const eSize = story ? 32 : 28
  const qSize = story ? 30 : 26
  const textW = inner - 72
  const available = footerTop - y - 40
  let titleMax = story ? 3 : 2
  let excerptMax = story ? 5 : 3
  let questionMax = story ? 3 : 2
  const measure = () => {
    ctx.font = `800 ${tSize}px ${FONT}`
    const t = wrap(ctx, c.title, textW, titleMax)
    ctx.font = `400 ${eSize}px ${FONT}`
    const e = c.excerpt && excerptMax > 0 ? wrap(ctx, c.excerpt, textW, excerptMax) : []
    ctx.font = `800 ${qSize}px ${FONT}`
    const q = c.question && questionMax > 0 ? wrap(ctx, `«${c.question}»`, textW - 40, questionMax) : []
    const h = 34 + t.length * (tSize + 6) + (e.length ? 14 + e.length * (eSize + 11) : 0) + (q.length ? 24 + 46 + q.length * (qSize + 8) + 20 : 0) + 30
    return { t, e, q, h }
  }
  let m = measure()
  while (m.h > available && (excerptMax > 1 || questionMax > 1 || titleMax > 2)) {
    if (excerptMax > 1) excerptMax--
    else if (questionMax > 1) questionMax--
    else titleMax--
    m = measure()
  }
  if (m.h > available && excerptMax > 0) {
    excerptMax = 0
    m = measure()
  }
  card(ctx, PAD, y, inner, m.h, '#fff')
  let ty = y + 34
  ctx.fillStyle = '#000'
  ctx.font = `800 ${tSize}px ${FONT}`
  for (const line of m.t) {
    ctx.fillText(line, PAD + 36, ty, textW)
    ty += tSize + 6
  }
  if (m.e.length) {
    ty += 14
    ctx.font = `400 ${eSize}px ${FONT}`
    ctx.fillStyle = '#1a1a1a'
    for (const line of m.e) {
      ctx.fillText(line, PAD + 36, ty, textW)
      ty += eSize + 11
    }
  }
  if (m.q.length) {
    ty += 24
    const qh = 46 + m.q.length * (qSize + 8) + 20
    ctx.fillStyle = '#e0fa49'
    ctx.beginPath()
    ctx.roundRect(PAD + 24, ty, inner - 48, qh, 22)
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = '#000'
    ctx.stroke()
    ctx.fillStyle = '#000'
    ctx.font = `800 ${story ? 22 : 19}px ${FONT}`
    ctx.fillText('EL TRIBUNAL PREGUNTA', PAD + 46, ty + 18)
    ctx.font = `800 ${qSize}px ${FONT}`
    m.q.forEach((line, i) => ctx.fillText(line, PAD + 46, ty + 46 + i * (qSize + 8), textW - 40))
  }

  // Leyenda: banda negra + sticker «¿Futuro? lo estamos diseñando»
  const bandH = story ? 190 : 120
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
  ctx.fillText('Este testimonio salió del sitio web', bx, footerTop + (story ? 36 : 20), bandTextW)
  ctx.fillStyle = '#e0fa49'
  ctx.font = `800 ${story ? 42 : 34}px ${FONT}`
  ctx.fillText(SITE_HOST, bx, footerTop + (story ? 80 : 50), bandTextW)
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${story ? 28 : 22}px ${FONT}`
  ctx.fillText('comparte tu experiencia', bx, footerTop + (story ? 134 : 90), bandTextW)
  if (futuro) drawContain(ctx, futuro, bandX + bandW - (story ? 165 : 160), footerTop + bandH / 2 - (story ? 8 : 4), story ? 300 : 270, story ? 130 : 110, -5)

  // Folio, discreto
  ctx.fillStyle = c.ink
  ctx.globalAlpha = 0.65
  ctx.font = `600 ${story ? 24 : 20}px ${FONT}`
  if (story) ctx.fillText(c.folio, PAD, footerTop + bandH + 22)
  ctx.globalAlpha = 1

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'))
}
