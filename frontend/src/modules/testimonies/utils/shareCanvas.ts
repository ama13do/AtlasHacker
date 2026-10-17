// Piezas comunes de las imágenes para compartir (los tres diseños): tipos, carga de imágenes y ajuste de texto.
// Todo en Parkinsans. Las fotos de R2 se leen con CORS (el bucket lo permite).

export type ShareFormat = 'story' | 'post'
// platform: el de la plataforma (color de la categoría y stickers) · negative: negro con foto recortada ·
// brutalist: cartel de fotocopia con tipografía enorme
export type ShareDesign = 'platform' | 'negative' | 'brutalist'

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
  phraseUrl: string // sticker de frase, si no hay fotos
  coverUrl: string // sticker del testimonio
  folio: string
  campaignLogo?: { light: string; dark: string } | null // logo de la campaña del mapa (light = letras negras)
}

export const FONT = '"Parkinsans Variable", system-ui, sans-serif'
export const W = 1080

export type Img = ImageBitmap | HTMLImageElement

export function loadFonts() {
  return Promise.all([400, 500, 600, 700, 800].map((weight) => document.fonts.load(`${weight} 32px ${FONT}`)))
}

// Fotos de R2 (otro origen): sin caché, porque si la miniatura ya la cargó sin CORS el navegador reusaría esa respuesta
export async function loadRemote(url: string): Promise<Img | null> {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' })
    if (!res.ok) return null
    return await createImageBitmap(await res.blob())
  } catch {
    return null
  }
}

// Recursos propios (logos SVG y stickers): mismo origen, se cargan como <img>
export function loadLocal(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// Parte el texto en líneas de `width`; si no cabe en `max` líneas, la última termina en «…»
export function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
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

export function drawContain(ctx: CanvasRenderingContext2D, img: Img, cx: number, cy: number, maxW: number, maxH: number, rot = 0) {
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

// La imagen cubre el rectángulo (recortando lo que sobre), centrada
export function drawCover(ctx: CanvasRenderingContext2D, img: Img, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

// PNG para el diseño de la plataforma (colores planos); JPEG para los de fotocopia: con tanto grano, un PNG pesaría 2–3 MB
export function toBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg' = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), type, 0.9))
}
