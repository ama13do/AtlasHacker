// Imagen para compartir un testimonio en Instagram Stories y redes sociales
// Formato exacto 9:16 (1080×1920 px), con márgenes de seguridad para la UI de Instagram (arriba y abajo),
// estética neo-brutalista de Hackers x Nuestro Futuro: color de categoría, foto grande de evidencia en marco polaroid
// con cinta washi-tape y sellos de archivo, título en bloque, extracto, pregunta del Tribunal y leyenda obligatoria:
// «Este testimonio salió del sitio web … (comparte tu experiencia)».

export interface ShareCard {
  title: string
  place: string
  date: string // ya formateada en español
  category: string
  color: string // fondo (color de la categoría)
  ink: string // texto sobre `color`
  excerpt: string
  question?: string
  photoUrl?: string | null // primera foto pública
  stickerUrl: string // respaldo sin foto
  siteUrl: string // dominio o URL para la leyenda
  folio?: string // folio oficial del expediente
}

const W = 1080
const H = 1920
const PAD = 72
const WIDE = '"Archivo Variable", "Parkinsans Variable", sans-serif'
const SANS = '"Parkinsans Variable", sans-serif'

async function loadImage(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' })
    if (!res.ok) return null
    return await createImageBitmap(await res.blob())
  } catch {
    return null
  }
}

// Parte el texto en líneas que caben en `width`; corta con «…» si pasa de `max` líneas
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= width) {
      line = test
      continue
    }
    if (line) lines.push(line)
    line = word
    if (lines.length === max) break
  }
  if (lines.length < max && line) lines.push(line)
  if (lines.length === max && words.join(' ').length > lines.join(' ').length) {
    let last = lines[max - 1]
    while (ctx.measureText(`${last}…`).width > width && last.length) last = last.slice(0, -1)
    lines[max - 1] = `${last.trimEnd()}…`
  }
  return lines
}

// Rectángulo redondeado con borde negro y sombra dura brutalista
function card(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  shadow = '#000',
  r = 32,
  shadowOffset = 12,
) {
  if (shadowOffset > 0) {
    ctx.fillStyle = shadow
    ctx.beginPath()
    ctx.roundRect(x + shadowOffset, y + shadowOffset, w, h, r)
    ctx.fill()
  }
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = '#000'
  ctx.stroke()
}

function cover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

export async function renderShareImage(c: ShareCard): Promise<Blob> {
  try {
    await Promise.all([
      document.fonts.load(`900 60px ${WIDE}`),
      document.fonts.load(`700 32px ${SANS}`),
      document.fonts.load(`400 32px ${SANS}`),
    ])
  } catch {
    // Si la carga de fuentes falla, el canvas usará la tipografía del sistema
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'top'

  // 1. Fondo completo de la categoría con textura semitono sutil
  ctx.fillStyle = c.color
  ctx.fillRect(0, 0, W, H)

  // Matriz de puntos de semitono
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  for (let y = 0; y < H; y += 24) {
    for (let x = (y / 24) % 2 ? 12 : 0; x < W; x += 24) {
      ctx.fillRect(x, y, 4, 4)
    }
  }

  // Marca de agua sutil en esquina
  ctx.save()
  ctx.translate(W - 120, 160)
  ctx.rotate(0.2)
  ctx.fillStyle = 'rgba(0,0,0,0.05)'
  ctx.font = `900 120px ${WIDE}`
  ctx.textAlign = 'right'
  ctx.fillText('HXNF', 0, 0)
  ctx.restore()
  ctx.textAlign = 'left'

  // Margen de seguridad superior (para UI de Instagram Stories: ~140px)
  const contentTop = 150

  // 2. Encabezado en píldora con folio
  const headerY = contentTop
  const pillW = 460
  const pillH = 68
  card(ctx, PAD, headerY, pillW, pillH, '#000', 'transparent', 34, 0)
  ctx.fillStyle = '#e0fa49'
  ctx.font = `900 28px ${WIDE}`
  ctx.fillText('TRIBUNAL POPULAR', PAD + 28, headerY + 20)

  // Badge de categoría
  ctx.font = `800 28px ${SANS}`
  ctx.fillStyle = c.ink
  ctx.fillText(`· ${c.category.toUpperCase()}`, PAD + pillW + 20, headerY + 20, W - PAD * 2 - pillW - 20)

  // 3. Área de Fotografía / Evidencia grande en formato Polaroid de Expediente
  const photoY = headerY + pillH + 40
  const photoH = c.photoUrl ? 730 : 500
  const photo = c.photoUrl ? await loadImage(c.photoUrl) : null

  if (photo) {
    // Tarjeta estilo Polaroid / Expediente con marco blanco
    const polaroidPad = 16
    const bottomStrip = 54
    card(ctx, PAD, photoY, W - PAD * 2, photoH, '#ffffff', '#000000', 36, 14)

    // Imagen con recorte interior
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(
      PAD + polaroidPad,
      photoY + polaroidPad,
      W - PAD * 2 - polaroidPad * 2,
      photoH - polaroidPad * 2 - bottomStrip,
      24,
    )
    ctx.clip()
    cover(
      ctx,
      photo,
      PAD + polaroidPad,
      photoY + polaroidPad,
      W - PAD * 2 - polaroidPad * 2,
      photoH - polaroidPad * 2 - bottomStrip,
    )

    // Gradiente sutil inferior sobre la foto
    const grad = ctx.createLinearGradient(0, photoY + photoH - 180, 0, photoY + photoH - bottomStrip)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.7)')
    ctx.fillStyle = grad
    ctx.fillRect(
      PAD + polaroidPad,
      photoY + photoH - 180,
      W - PAD * 2 - polaroidPad * 2,
      180 - bottomStrip,
    )

    // Ubicación sobre la foto
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 24px ${SANS}`
    ctx.fillText(`📍 ${c.place}`, PAD + polaroidPad + 20, photoY + photoH - bottomStrip - 44)
    ctx.restore()

    // Cinta washi tape realista en el centro superior
    ctx.save()
    ctx.translate(W / 2, photoY - 6)
    ctx.rotate(0.03)
    ctx.fillStyle = 'rgba(224, 250, 73, 0.9)'
    ctx.fillRect(-130, -18, 260, 40)
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 2.5
    ctx.strokeRect(-130, -18, 260, 40)
    ctx.fillStyle = '#000000'
    ctx.font = `900 17px ${WIDE}`
    ctx.textAlign = 'center'
    ctx.fillText('EVIDENCIA CIUDADANA #1', 0, -6)
    ctx.restore()
    ctx.textAlign = 'left'

    // Pie de la polaroid: Folio y Sello de verificación
    ctx.fillStyle = '#333333'
    ctx.font = `800 22px ${SANS}`
    ctx.fillText(c.folio ? `EXPEDIENTE: ${c.folio}` : 'EXPEDIENTE CIUDADANO', PAD + polaroidPad + 12, photoY + photoH - 42)

    // Badge verde neón de verificado
    card(ctx, W - PAD - polaroidPad - 170, photoY + photoH - 48, 160, 36, '#e0fa49', 'transparent', 18, 0)
    ctx.fillStyle = '#000000'
    ctx.font = `900 16px ${WIDE}`
    ctx.fillText('VERIFICADO', W - PAD - polaroidPad - 145, photoY + photoH - 38)
  } else {
    // Si no hay foto, póster editorial con sello del tribunal y sticker
    // Sello circular del tribunal
    ctx.save()
    ctx.translate(PAD + 140, photoY + 90)
    ctx.rotate(-0.16)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 4
    ctx.setLineDash([10, 6])
    ctx.beginPath()
    ctx.arc(0, 0, 70, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.font = `900 16px ${WIDE}`
    ctx.textAlign = 'center'
    ctx.fillText('CASO REGISTRADO', 0, -18)
    ctx.font = `700 13px ${SANS}`
    ctx.fillText('TRIBUNAL POPULAR', 0, 4)
    ctx.restore()
    ctx.textAlign = 'left'

    const sticker = await loadImage(c.stickerUrl)
    if (sticker) {
      ctx.save()
      ctx.translate(W / 2, photoY + photoH / 2)
      ctx.rotate(-0.05)
      ctx.drawImage(sticker, -210, -210, 420, 420)
      ctx.restore()
    }
  }

  // 4. Tarjeta principal: Título, Lugar, Fecha y Extracto del testimonio
  let textY = photoY + photoH + 36
  const maxCardWidth = W - PAD * 2 - 68

  ctx.font = `900 52px ${WIDE}`
  const titleLines = wrap(ctx, c.title, maxCardWidth, 3)

  ctx.font = `400 30px ${SANS}`
  const maxExcerptLines = c.question ? 4 : 6
  const excerptLines = wrap(ctx, c.excerpt, maxCardWidth, maxExcerptLines)

  const cardH = 48 + titleLines.length * 62 + 54 + excerptLines.length * 44 + 36
  card(ctx, PAD, textY, W - PAD * 2, cardH, '#ffffff', '#000000', 36, 14)

  // Dibujar título
  let lineY = textY + 40
  ctx.fillStyle = '#000000'
  ctx.font = `900 52px ${WIDE}`
  for (const line of titleLines) {
    ctx.fillText(line, PAD + 34, lineY, maxCardWidth)
    lineY += 62
  }

  // Lugar y fecha
  ctx.font = `800 26px ${SANS}`
  ctx.fillStyle = '#444444'
  ctx.fillText(`📍 ${c.place}   ·   ${c.date}`, PAD + 34, lineY + 6, maxCardWidth)
  lineY += 54

  // Extracto del testimonio
  ctx.font = `500 30px ${SANS}`
  ctx.fillStyle = '#111111'
  for (const line of excerptLines) {
    ctx.fillText(line, PAD + 34, lineY, maxCardWidth)
    lineY += 44
  }

  textY += cardH + 30

  // 5. Pregunta del Tribunal (si existe y cabe antes del footer)
  if (c.question && textY < H - 360) {
    ctx.font = `900 32px ${WIDE}`
    const qLines = wrap(ctx, `«${c.question}»`, maxCardWidth, 3)
    const qH = 38 + 36 + qLines.length * 46 + 18
    if (textY + qH < H - 230) {
      card(ctx, PAD, textY, W - PAD * 2, qH, '#e0fa49', '#000000', 28, 10)
      ctx.fillStyle = '#000000'
      ctx.font = `900 22px ${SANS}`
      ctx.fillText('⚡ EL TRIBUNAL PREGUNTA:', PAD + 32, textY + 24)
      ctx.font = `900 32px ${WIDE}`
      qLines.forEach((line, i) => ctx.fillText(line, PAD + 32, textY + 64 + i * 46, maxCardWidth))
    }
  }

  // 6. Pie de imagen fijo en la parte inferior con la leyenda obligatoria
  const footerH = 175
  const footerY = H - footerH

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, footerY, W, footerH)

  // Línea decorativa verde lima arriba del footer negro
  ctx.fillStyle = '#e0fa49'
  ctx.fillRect(0, footerY, W, 6)

  // Texto 1 de la leyenda
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 26px ${SANS}`
  ctx.fillText('Este testimonio salió de sitio web:', PAD, footerY + 34)

  // Texto 2 de la leyenda (destacado con llamada a la acción)
  ctx.fillStyle = '#e0fa49'
  ctx.font = `900 38px ${WIDE}`
  ctx.fillText(`${c.siteUrl}  ·  comparte tu experiencia`, PAD, footerY + 74, W - PAD * 2)

  ctx.font = `600 22px ${SANS}`
  ctx.fillStyle = '#aaaaaa'
  ctx.fillText('Entra al mapa interactivo para ver el expediente completo y comentar', PAD, footerY + 126, W - PAD * 2)

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png')
  })
}
