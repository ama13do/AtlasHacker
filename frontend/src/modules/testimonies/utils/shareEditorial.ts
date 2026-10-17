// Dos diseños editoriales para compartir un testimonio, además del de la plataforma. Solo blanco y negro:
//   · negative («Negativo»): fondo negro absoluto; titular blanco arriba a la izquierda en líneas cortas; la foto
//     del testimonio (o una torre de transmisión) recortada a tijera como collage de fotocopia en el centro-derecha,
//     saliéndose por la orilla; el relato abajo a la izquierda, con aire alrededor.
//   · brutalist («Brutalista»): cartel de fanzine: foto a sangre con contraste extremo y grano; titular enorme en
//     mayúsculas, en bloques desiguales encimados sobre la imagen; el relato en un bloque compacto y la firma abajo.
// Sin fotos, la torre (y el paisaje del cartel) se dibujan aquí mismo y pasan por el mismo efecto de fotocopia.
// El azar sale del folio: el mismo testimonio produce siempre la misma imagen.

import { LOGOS, SITE_HOST } from '@/core/config/brand'
import { FONT, W, drawCover, loadFonts, loadLocal, loadRemote, toBlob, wrap, type Img, type ShareCard, type ShareFormat } from './shareCanvas'

type Rnd = () => number
type Pt = [number, number]
type RGB = [number, number, number]

const INK = '#0b0b0b'
const PAPER = '#ecebe4' // blanco sucio
const INK_RGB: RGB = [11, 11, 11]
const PAPER_RGB: RGB = [236, 235, 228]
const NO_LIMIT = 99

// ── Azar con semilla (mulberry32) ────────────────────────────────────────────────────────────────────────────
function seeded(text: string): Rnd {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function layer(w: number, h: number) {
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(w))
  cv.height = Math.max(1, Math.round(h))
  return { cv, ctx: cv.getContext('2d', { willReadFrequently: true })! }
}

// Toma inclinada: lo que dibuje `draw` sale girado `deg` grados alrededor de (cx, cy)
function tilted<T>(ctx: CanvasRenderingContext2D, cx: number, cy: number, deg: number, draw: () => T): T {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.translate(-cx, -cy)
  const result = draw()
  ctx.restore()
  return result
}
const turn = ([x, y]: Pt, cx: number, cy: number, deg: number): Pt => {
  const a = (deg * Math.PI) / 180
  return [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]
}

function pathOf(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
}

// ── Textura y fotocopia ─────────────────────────────────────────────────────────────────────────────────────

// Manchas suaves (nubes, papel gastado): una cuadrícula al azar estirada con suavizado
function blotches(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rnd, cell: number, alpha: number, lo = 0, hi = 255) {
  const gw = Math.ceil(w / cell) + 2
  const gh = Math.ceil(h / cell) + 2
  const { cv, ctx: g } = layer(gw, gh)
  const img = g.createImageData(gw, gh)
  for (let i = 0; i < gw * gh; i++) {
    const v = lo + (hi - lo) * rnd()
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.globalAlpha = alpha
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cv, x - cell, y - cell, gw * cell, gh * cell)
  ctx.restore()
}

// Zonas sobreexpuestas: manchas de luz que la fotocopia «quema» a blanco
function burn(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: Rnd, n: number, strength = 0.55) {
  for (let i = 0; i < n; i++) {
    const cx = rnd() * w
    const cy = rnd() * h
    const r = (0.15 + rnd() * 0.3) * Math.max(w, h)
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, `rgba(255,255,255,${strength})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}

interface Copy {
  contrast: number // > 1: más duro
  bright?: number // -0.5 … 0.5
  hard: number // 0 = tonos continuos · 1 = solo blanco o negro
  grain: number // amplitud del grano
  paper?: RGB
  ink?: RGB
}

// Fotocopia de varias generaciones: gris, contraste extremo, grano grueso (bloques de 3 px) y fino, y un umbral
// suave que deja casi todo en blanco o negro con las orillas granuladas
function photocopy(cv: HTMLCanvasElement, rnd: Rnd, o: Copy) {
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  const { width: w, height: h } = cv
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const cw = Math.ceil(w / 3)
  const coarse = new Float32Array(cw * Math.ceil(h / 3))
  for (let i = 0; i < coarse.length; i++) coarse[i] = rnd() - 0.5
  const edge = Math.max(0.03, 0.5 * (1 - o.hard))
  const [pr, pg, pb] = o.paper ?? PAPER_RGB
  const [ir, ig, ib] = o.ink ?? INK_RGB
  const bright = o.bright ?? 0
  for (let y = 0; y < h; y++) {
    const row = ((y / 3) | 0) * cw
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let l = (0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!) / 255
      l = (l - 0.5) * o.contrast + 0.5 + bright
      l += coarse[row + ((x / 3) | 0)]! * o.grain + (rnd() - 0.5) * o.grain * 0.7
      let t = (l - 0.5 + edge) / (2 * edge)
      t = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
      d[i] = ir + (pr - ir) * t
      d[i + 1] = ig + (pg - ig) * t
      d[i + 2] = ib + (pb - ib) * t
    }
  }
  ctx.putImageData(img, 0, 0)
}

// Desgaste: franjas del escáner, rayones (largos casi verticales y cortos al azar) y polvo
function wear(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rnd, amount = 1) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  for (let i = 0; i < 2; i++) {
    ctx.globalAlpha = (0.05 + rnd() * 0.07) * amount
    ctx.fillStyle = rnd() < 0.5 ? INK : PAPER
    ctx.fillRect(x + rnd() * w, y, 2 + rnd() * 16, h)
  }
  ctx.lineCap = 'round'
  for (let i = 0; i < 16 * amount; i++) {
    const long = rnd() < 0.4
    const sx = x + rnd() * w
    const sy = y + rnd() * h
    const len = long ? h * (0.3 + rnd() * 0.6) : 20 + rnd() * 120
    const ang = long ? Math.PI / 2 + (rnd() - 0.5) * 0.12 : rnd() * Math.PI
    ctx.globalAlpha = 0.25 + rnd() * 0.5
    ctx.strokeStyle = rnd() < 0.6 ? PAPER : INK
    ctx.lineWidth = 0.8 + rnd() * 1.6
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.quadraticCurveTo(sx + (Math.cos(ang) * len) / 2 + (rnd() - 0.5) * 20, sy + (Math.sin(ang) * len) / 2, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len)
    ctx.stroke()
  }
  for (let i = 0; i < 180 * amount; i++) {
    ctx.globalAlpha = 0.4 + rnd() * 0.6
    ctx.fillStyle = rnd() < 0.75 ? INK : PAPER
    const r = rnd() < 0.9 ? 0.6 + rnd() * 1.6 : 2 + rnd() * 3
    ctx.beginPath()
    ctx.ellipse(x + rnd() * w, y + rnd() * h, r, r * (0.5 + rnd() * 0.8), rnd() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// Grano de fotocopia sobre toda la pieza (también sobre el texto, sin quitarle lectura)
function grainOver(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: Rnd, alpha: number) {
  const { cv, ctx: g } = layer(w / 2, h / 2)
  const img = g.createImageData(cv.width, cv.height)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rnd() < 0.5 ? 0 : 255
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = rnd() * 255
  }
  g.putImageData(img, 0, 0)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(cv, 0, 0, w, h)
  ctx.restore()
}

// Recorte a tijera: cada lado se parte en tramos rectos que se desvían un poco
function scissor(points: Pt[], rnd: Rnd, seg: number, amp: number): Pt[] {
  const out: Pt[] = []
  points.forEach(([ax, ay], i) => {
    const [bx, by] = points[(i + 1) % points.length]!
    const len = Math.hypot(bx - ax, by - ay) || 1
    const n = Math.max(1, Math.round(len / seg))
    const nx = -(by - ay) / len
    const ny = (bx - ax) / len
    for (let j = 0; j < n; j++) {
      const k = (j + (j ? (rnd() - 0.5) * 0.6 : 0)) / n
      const off = (rnd() - 0.5) * 2 * amp * (j ? 1 : 0.5)
      out.push([ax + (bx - ax) * k + nx * off, ay + (by - ay) * k + ny * off])
    }
  })
  return out
}

// Fragmento de collage: un pedazo (o un acercamiento) de una imagen ya fotocopiada, recortado, girado y encimado
function fragment(ctx: CanvasRenderingContext2D, src: CanvasImageSource, s: [number, number, number, number], d: [number, number, number, number], rot: number, rnd: Rnd) {
  const [sx, sy, sw, sh] = s
  const [dx, dy, dw, dh] = d
  ctx.save()
  ctx.translate(dx + dw / 2, dy + dh / 2)
  ctx.rotate((rot * Math.PI) / 180)
  pathOf(ctx, scissor([[-dw / 2, -dh / 2], [dw / 2, -dh / 2], [dw / 2, dh / 2], [-dw / 2, dh / 2]], rnd, 70, 6))
  ctx.save()
  ctx.clip()
  ctx.drawImage(src, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.stroke()
  ctx.restore()
}

// Una foto del testimonio pasada por la fotocopiadora
function copiedPhoto(img: Img, w: number, h: number, rnd: Rnd, copy: Copy) {
  const { cv, ctx } = layer(w, h)
  drawCover(ctx, img, 0, 0, w, h)
  burn(ctx, w, h, rnd, 2, 0.4)
  photocopy(cv, rnd, copy)
  wear(ctx, 0, 0, w, h, rnd, 0.6)
  return cv
}

// ── Torre de transmisión (celosía de doble circuito, vista desde abajo) ──────────────────────────────────────
// Coordenadas de la torre: u = horizontal (1 = media base), t = altura (0 = base, 1 = punta). La perspectiva
// encoge lo alto (está más lejos): y = base − h·g(t), con g(t) = t(1+k)/(1+kt)
interface View {
  x: number // centro de la base
  y: number // base
  h: number
  half: number // media base en px
  k: number // fuerza de la perspectiva
  lean: number // inclinación (px de x por px de altura)
}

const WAIST = 0.58
const ARMS = [
  { t: 0.62, len: 0.95 },
  { t: 0.76, len: 1.2 },
  { t: 0.9, len: 0.85 },
]
const lift = (k: number, t: number) => (t * (1 + k)) / (1 + k * t)
const halfWidth = (t: number) => (t <= WAIST ? 1 - 0.8 * (t / WAIST) : 0.2 - 0.08 * ((t - WAIST) / (1 - WAIST)))

// Coloca la torre para que la punta quede en `apex` y la cruceta de abajo a la altura `lowArmY`
function viewFor(apex: Pt, lowArmY: number, baseX: number, half: number, k: number): View {
  const h = Math.max(200, lowArmY - apex[1]) / (1 - lift(k, ARMS[0]!.t))
  return { x: baseX, y: apex[1] + h, h, half, k, lean: (apex[0] - baseX) / h }
}

function project(v: View, u: number, t: number): Pt {
  const f = 1 / (1 + v.k * t)
  const y = v.y - v.h * lift(v.k, t)
  return [v.x + u * v.half * f + v.lean * (v.y - y), y]
}

interface Tip {
  p: Pt
  side: -1 | 1
}

function drawTower(ctx: CanvasRenderingContext2D, v: View, lw: number): Tip[] {
  const P = (u: number, t: number) => project(v, u, t)
  const width = (t: number) => Math.max(0.8, (lw * 1) / (1 + v.k * t))
  const line = (a: Pt, b: Pt, w: number) => {
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.stroke()
  }
  const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]

  // Paneles: altos abajo y cada vez más bajos; la cabeza, en tramos parejos
  const levels = [0]
  let step = 0.085
  while (levels[levels.length - 1]! < WAIST - 0.02) {
    levels.push(Math.min(WAIST, levels[levels.length - 1]! + step))
    step *= 0.86
  }
  if (levels[levels.length - 1]! < WAIST) levels.push(WAIST)
  for (let t = WAIST + 0.06; t < 0.985; t += 0.06) levels.push(t)
  levels.push(1)

  ctx.save()
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineCap = 'round'

  // Dos caras: la de atrás (corrida y más delgada) se ve a través de la de enfrente y da el entramado denso
  const face = (shift: number, shrink: number, alpha: number, mul: number) => {
    const Q = (u: number, t: number) => P(u * shrink + shift * halfWidth(t), t)
    ctx.globalAlpha = alpha
    for (let i = 0; i < levels.length - 1; i++) {
      const a = levels[i]!
      const b = levels[i + 1]!
      const ha = halfWidth(a)
      const hb = halfWidth(b)
      line(Q(-ha, a), Q(ha, a), width(a) * 0.8 * mul)
      const bays = ha > 0.5 ? 2 : 1
      for (let j = 0; j < bays; j++) {
        const u0a = -ha + (2 * ha * j) / bays
        const u1a = -ha + (2 * ha * (j + 1)) / bays
        const u0b = -hb + (2 * hb * j) / bays
        const u1b = -hb + (2 * hb * (j + 1)) / bays
        line(Q(u0a, a), Q(u1b, b), width(a) * 0.7 * mul)
        line(Q(u1a, a), Q(u0b, b), width(a) * 0.7 * mul)
        if (bays > 1 && j === 0) line(Q(u1a, a), Q(u1b, b), width(a) * 0.6 * mul)
      }
      for (const s of [-1, 1]) line(Q(s * ha, a), Q(s * hb, b), width(a) * 2.4 * mul)
    }
  }
  face(0.2, 0.88, 0.75, 0.7)
  face(0, 1, 1, 1)
  ctx.globalAlpha = 1

  // Punta para el cable de guarda
  const peak = P(0, 1.07)
  line(P(-halfWidth(1), 1), peak, width(1) * 1.6)
  line(P(halfWidth(1), 1), peak, width(1) * 1.6)

  // Crucetas con su celosía, aisladores colgando y el punto de donde sale cada cable
  const tips: Tip[] = [
    { p: peak, side: -1 },
    { p: peak, side: 1 },
  ]
  for (const arm of ARMS) {
    const d = 0.035
    for (const s of [-1, 1] as const) {
      const root0 = P(s * halfWidth(arm.t), arm.t)
      const root1 = P(s * halfWidth(arm.t + d), arm.t + d)
      const tip = P(s * (halfWidth(arm.t + d) + arm.len), arm.t + d)
      const w = width(arm.t)
      line(root1, tip, w * 1.5)
      line(root0, tip, w * 1.5)
      const n = 7
      for (let i = 0; i < n; i++) {
        const k0 = i / n
        const k1 = (i + 1) / n
        line(lerp(root1, tip, k0), lerp(root0, tip, k1), w * 0.6)
        line(lerp(root1, tip, k0), lerp(root0, tip, k0), w * 0.5)
      }
      const ins = v.h * 0.05 / (1 + v.k * arm.t)
      line(tip, [tip[0], tip[1] + ins], w * 0.9)
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.ellipse(tip[0], tip[1] + ins * (0.22 + 0.13 * i), ins * 0.17, ins * 0.05, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      tips.push({ p: [tip[0], tip[1] + ins], side: s })
    }
  }
  ctx.restore()
  return tips
}

// Cables que salen de cada aislador hacia fuera del encuadre, con su comba
function drawCables(ctx: CanvasRenderingContext2D, tips: Tip[], w: number, h: number, rnd: Rnd, lw: number) {
  ctx.save()
  ctx.strokeStyle = INK
  ctx.lineCap = 'round'
  for (const { p, side } of tips) {
    const count = rnd() < 0.5 ? 2 : 1
    const endX = side < 0 ? -w * (0.25 + rnd() * 0.4) : w * (1.25 + rnd() * 0.4)
    const endY = p[1] + (rnd() - 0.35) * h * 0.3
    for (let i = 0; i < count; i++) {
      const sag = h * (0.06 + rnd() * 0.1)
      ctx.lineWidth = lw * (0.7 + rnd() * 0.6)
      ctx.beginPath()
      ctx.moveTo(p[0], p[1])
      ctx.quadraticCurveTo((p[0] + endX) / 2, Math.max(p[1], endY) + sag, endX, endY + i * 14)
      ctx.stroke()
    }
  }
  ctx.restore()
}

// Paisaje rural con industria al fondo: cielo quemado, lomas, campo con surcos, torres lejanas y una chimenea
function drawLandscape(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, rnd: Rnd) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#2e2e2e')
  sky.addColorStop(0.45, '#7c7c7c')
  sky.addColorStop(0.85, '#e6e6e6')
  sky.addColorStop(1, '#f6f6f6')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, horizon)
  blotches(ctx, 0, 0, w, horizon, rnd, 150, 0.42, 30, 255)
  blotches(ctx, 0, 0, w, horizon, rnd, 48, 0.2, 80, 255)

  // Chimenea con humo
  const cx = w * (0.72 + rnd() * 0.12)
  for (let i = 0; i < 9; i++) {
    const r = 30 + i * 16
    const sx = cx + 20 + i * 34 + (rnd() - 0.5) * 30
    const sy = horizon - h * 0.16 - i * 26
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r)
    g.addColorStop(0, 'rgba(70,70,70,0.55)')
    g.addColorStop(1, 'rgba(70,70,70,0)')
    ctx.fillStyle = g
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2)
  }
  ctx.fillStyle = '#1e1e1e'
  ctx.fillRect(cx, horizon - h * 0.16, 22, h * 0.16)
  ctx.fillRect(cx + 48, horizon - h * 0.11, 16, h * 0.11)

  // Torres lejanas y su línea
  const far: Tip[] = []
  for (const fx of [0.08, 0.3]) {
    const v: View = { x: w * fx, y: horizon + 4, h: h * 0.12, half: w * 0.025, k: 0.1, lean: 0 }
    far.push(...drawTower(ctx, v, 1.4).filter((t) => t.side > 0).slice(1))
  }
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.2
  for (const t of far) {
    ctx.beginPath()
    ctx.moveTo(t.p[0], t.p[1])
    ctx.quadraticCurveTo(t.p[0] + w * 0.12, t.p[1] + 26, t.p[0] + w * 0.24, t.p[1] + 2)
    ctx.stroke()
  }

  // Lomas y campo
  ctx.fillStyle = '#3a3a3a'
  ctx.beginPath()
  ctx.moveTo(0, horizon + 8)
  for (let x = 0; x <= w + 40; x += 40) ctx.lineTo(x, horizon - 10 - Math.abs(Math.sin(x / 190 + 1.3)) * 34 - rnd() * 8)
  ctx.lineTo(w, horizon + 8)
  ctx.fill()
  ctx.fillStyle = '#242424'
  ctx.fillRect(0, horizon + 6, w, h - horizon)
  ctx.strokeStyle = '#6c6c6c'
  ctx.lineWidth = 2
  const vx = w * (0.3 + rnd() * 0.4)
  for (let i = -14; i <= 14; i++) {
    ctx.beginPath()
    ctx.moveTo(vx + i * 5, horizon + 6)
    ctx.lineTo(vx + i * w * 0.2, h)
    ctx.stroke()
  }
  blotches(ctx, 0, horizon + 6, w, h - horizon, rnd, 60, 0.25, 0, 160)
}

// ── Texto ───────────────────────────────────────────────────────────────────────────────────────────────────

function setFont(ctx: CanvasRenderingContext2D, weight: number, size: number, tracking = 0) {
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.letterSpacing = `${tracking}px`
}

// Prueba de la letra más grande a la más chica hasta que el texto quepa en `max` líneas (y en `maxHeight`, si se da)
function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  sizes: readonly number[],
  width: (size: number) => number,
  max: number,
  tracking: number,
  height?: { line: number; max: number },
) {
  for (const size of sizes) {
    setFont(ctx, 800, size, -size * tracking)
    const lines = wrap(ctx, text, width(size), NO_LIMIT)
    if (lines.length <= max && (!height || lines.length * size * height.line <= height.max)) return { lines, size }
  }
  const size = sizes[sizes.length - 1]!
  setFont(ctx, 800, size, -size * tracking)
  return { lines: wrap(ctx, text, width(size), max), size }
}

// Leyenda: de dónde salió el testimonio y la invitación a leerlo completo
export const LEGEND = { before: 'Este testimonio salió de', after: 'Léelo completo y comparte el tuyo' }
const LEGEND_H = (size: number) => size * 2.84
function legend(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, main: string, soft: string, maxW: number) {
  ctx.textBaseline = 'top'
  ctx.fillStyle = soft
  setFont(ctx, 500, size * 0.7)
  ctx.fillText(LEGEND.before, x, y, maxW)
  ctx.fillStyle = main
  setFont(ctx, 800, size)
  ctx.fillText(SITE_HOST, x, y + size * 0.92, maxW)
  ctx.fillStyle = soft
  setFont(ctx, 500, size * 0.7)
  ctx.fillText(LEGEND.after, x, y + size * 2.14, maxW)
  const after = Math.min(maxW, ctx.measureText(LEGEND.after).width)
  setFont(ctx, 800, size)
  return Math.max(ctx.measureText(SITE_HOST).width, after)
}

// ── Negativo ────────────────────────────────────────────────────────────────────────────────────────────────

export async function renderNegative(c: ShareCard, format: ShareFormat): Promise<Blob> {
  const story = format === 'story'
  const H = story ? 1920 : 1350
  const PAD = story ? 72 : 60
  const rnd = seeded(`${c.folio}:negativo`)

  await loadFonts()
  const [logo, campaign, ...photos] = await Promise.all([
    loadLocal(LOGOS.hackers.dark),
    c.campaignLogo ? loadLocal(c.campaignLogo.dark) : Promise.resolve(null),
    ...c.photoUrls.slice(0, 3).map(loadRemote),
  ])
  const pics = photos.filter((p): p is Img => !!p)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)

  // Cabecera: logo de la campaña; debajo, antetítulo y titular (arriba a la izquierda, en líneas cortas y apretadas)
  const mastH = campaign ? (story ? 96 : 70) : 0
  const mastY = story ? 150 : 50
  const top = mastY + (campaign ? mastH + (story ? 34 : 22) : story ? 10 : 10)
  const headY = top + (story ? 54 : 44)
  const head = fit(ctx, c.title, story ? [116, 108, 100, 92, 84, 76, 70, 64, 58] : [92, 84, 78, 72, 66, 60, 56, 52], () => W * 0.72, story ? 5 : 4, 0.025)
  const lead = head.size * 0.98
  const headBottom = headY + head.lines.length * lead
  setFont(ctx, 800, head.size, -head.size * 0.025)
  const headRight = PAD + Math.max(...head.lines.map((l) => ctx.measureText(l).width))

  // Abajo a la izquierda: relato, pregunta del Tribunal, leyenda y logo. El relato se recorta solo si la imagen
  // se quedaría sin espacio; la pregunta va completa
  const logoH = story ? 42 : 34
  const logoY = (story ? H - 214 : H - 50) - logoH
  const legendSize = story ? 32 : 26
  const legendY = logoY - (story ? 24 : 18) - LEGEND_H(legendSize)
  const textW = W * (story ? 0.57 : 0.55)
  const eSize = story ? 28 : 22
  const eLead = eSize * 1.4
  const metaSize = story ? 23 : 18
  const qSize = story ? 27 : 21
  const qLead = qSize * 1.28
  const qIndent = story ? 22 : 18
  const gap = story ? 42 : 30
  // La imagen también sube junto al titular y baja junto al relato: el bloque central puede quedar bajo
  const minFig = story ? 170 : 130
  setFont(ctx, 600, metaSize, 1)
  const meta = wrap(ctx, `${c.place} · ${c.date}`, textW, 2)
  const metaH = meta.length * metaSize * 1.3 + metaSize * 0.4
  setFont(ctx, 700, qSize)
  const question = c.question ? wrap(ctx, `«${c.question}»`, textW - qIndent, 4) : []
  const questionH = question.length ? (story ? 26 : 18) + metaSize * 1.6 + question.length * qLead : 0
  let maxLines = story ? 12 : 6
  let rel: string[] = []
  let textTop = 0
  for (;;) {
    setFont(ctx, 400, eSize)
    rel = c.excerpt ? wrap(ctx, c.excerpt, textW, maxLines) : []
    textTop = legendY - (story ? 40 : 26) - metaH - rel.length * eLead - questionH
    if (textTop - gap - (headBottom + gap) >= minFig || maxLines <= 2) break
    maxLines--
  }
  const mainTop = headBottom + gap
  const mainBottom = textTop - gap

  // Lugar · fecha y relato
  let y = textTop
  ctx.fillStyle = '#9a9a9a'
  setFont(ctx, 600, metaSize, 1)
  let textRight = PAD
  for (const line of meta) {
    ctx.fillText(line, PAD, y)
    textRight = Math.max(textRight, PAD + ctx.measureText(line).width)
    y += metaSize * 1.3
  }
  y += metaSize * 0.4
  ctx.fillStyle = '#f1f1f1'
  setFont(ctx, 400, eSize)
  for (const line of rel) {
    ctx.fillText(line, PAD, y)
    textRight = Math.max(textRight, PAD + ctx.measureText(line).width)
    y += eLead
  }
  if (question.length) {
    y += story ? 26 : 18
    ctx.fillStyle = '#9a9a9a'
    setFont(ctx, 700, metaSize, 2)
    ctx.fillText('EL TRIBUNAL PREGUNTA', PAD, y)
    y += metaSize * 1.6
    ctx.fillStyle = '#fff'
    ctx.fillRect(PAD, y, story ? 5 : 4, question.length * qLead - (qLead - qSize))
    setFont(ctx, 700, qSize)
    for (const line of question) {
      ctx.fillText(line, PAD + qIndent, y)
      textRight = Math.max(textRight, PAD + qIndent + ctx.measureText(line).width)
      y += qLead
    }
  }
  textRight = Math.max(textRight, PAD + legend(ctx, PAD, legendY, legendSize, '#fff', '#a8a8a8', textW))
  if (logo) {
    const lw = (logo.width / logo.height) * logoH
    ctx.drawImage(logo, PAD, logoY, lw, logoH)
  }

  // Cabecera, antetítulo y titular
  if (campaign) ctx.drawImage(campaign, PAD, mastY, (campaign.width / campaign.height) * mastH, mastH)
  ctx.fillStyle = '#8c8c8c'
  setFont(ctx, 700, story ? 22 : 19, 3)
  ctx.fillText(`TESTIMONIO · ${c.category.toUpperCase()}`, PAD, top, W - PAD * 2)
  ctx.fillStyle = '#fff'
  setFont(ctx, 800, head.size, -head.size * 0.025)
  head.lines.forEach((line, i) => ctx.fillText(line, PAD, headY + i * lead))
  setFont(ctx, 400, 32)

  // Silueta del recorte: bloque central que sube por la derecha junto al titular (si hay hueco) y baja por la
  // derecha del relato hasta salirse del encuadre
  const fx0 = W * 0.16
  const right = W + 60
  const rise = headRight + gap < W * 0.8
  const riseTop = mastY + 10
  const tailX = Math.max(textRight + gap, W * 0.56)
  const outline: Pt[] = rise
    ? [[fx0, mainTop], [headRight + gap, mainTop], [headRight + gap, riseTop], [right, riseTop]]
    : [[fx0, mainTop], [right, mainTop]]
  outline.push([right, H + 60], [tailX, H + 60], [tailX, mainBottom], [fx0, mainBottom])
  const cut = scissor(outline, rnd, story ? 110 : 90, story ? 14 : 11)

  // La «fotografía»: la foto del testimonio o una torre de transmisión, en una hoja del tamaño del lienzo
  const { cv: photo, ctx: p } = layer(W, H)
  let detail: [number, number, number, number]
  if (pics[0]) {
    p.fillStyle = '#fff'
    p.fillRect(0, 0, W, H)
    drawCover(p, pics[0], fx0, rise ? riseTop : mainTop, right - fx0, H + 60 - (rise ? riseTop : mainTop))
    burn(p, W, H, rnd, 2, 0.35)
    detail = [fx0 + (right - fx0) * 0.3, mainTop, (right - fx0) * 0.35, (mainBottom - mainTop) * 0.6]
  } else {
    const sky = p.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#9a9a9a')
    sky.addColorStop(0.55, '#d6d6d6')
    sky.addColorStop(1, '#f2f2f2')
    p.fillStyle = sky
    p.fillRect(0, 0, W, H)
    blotches(p, 0, 0, W, H, rnd, 110, 0.42, 40, 255)
    blotches(p, 0, 0, W, H, rnd, 34, 0.16, 90, 255)
    // Arboleda oscura al pie de la imagen
    const ground = H - (story ? 150 : 90)
    p.fillStyle = '#1c1c1c'
    p.beginPath()
    p.moveTo(0, H)
    for (let x = 0; x <= W + 30; x += 30) p.lineTo(x, ground - Math.abs(Math.sin(x / 70)) * 26 - rnd() * 22)
    p.lineTo(W, H)
    p.fill()
    const apex: Pt = [rise ? Math.min(W * 0.86, (headRight + gap + W) / 2) : W * 0.58, (rise ? riseTop : mainTop) + H * 0.035]
    const view = viewFor(apex, mainTop + (mainBottom - mainTop) * 0.8, W * 0.62, W * 0.52, 1.1)
    const TILT = 4
    tilted(p, view.x, H, TILT, () => drawCables(p, drawTower(p, view, story ? 7 : 6), W, H, rnd, story ? 2.4 : 2))
    burn(p, W, H, rnd, 2, 0.5)
    // Acercamiento a la celosía del cuerpo de la torre
    const body = turn(project(view, 0, 0.45), view.x, H, TILT)
    detail = [body[0] - 150, body[1] - 140, 300, 280]
  }
  // Con fotos reales, un poco menos duro: son evidencia y tiene que reconocerse lo que muestran
  photocopy(photo, rnd, pics.length ? { contrast: 1.3, hard: 0.28, grain: 0.26, paper: [240, 237, 229] } : { contrast: 1.6, hard: 0.45, grain: 0.3, paper: [240, 237, 229] })
  wear(p, 0, 0, W, H, rnd, 1)

  ctx.save()
  pathOf(ctx, cut)
  ctx.clip()
  ctx.drawImage(photo, 0, 0)
  ctx.restore()

  // Fragmentos encimados: otras fotos del testimonio o un acercamiento a la misma imagen
  const mainH = mainBottom - mainTop
  const extra = pics.slice(1).map((img) => copiedPhoto(img, 600, 600, rnd, { contrast: 1.4, hard: 0.32, grain: 0.26, paper: [228, 225, 216] }))
  const fw = W * (story ? 0.27 : 0.24)
  const fh = Math.min(fw * 1.1, mainH * 0.62)
  const spots: { d: [number, number, number, number]; rot: number }[] = [
    { d: [fx0 - W * 0.08, mainTop + mainH * 0.18, fw, fh], rot: -4 },
    { d: [tailX - 18, Math.min(H - fh * 0.8 - 20, mainBottom + gap * 0.6), fw * 0.8, fh * 0.75], rot: 3 },
  ]
  spots.forEach(({ d, rot }, i) => {
    const src = extra[i]
    if (src) fragment(ctx, src, [0, 0, src.width, src.height], d, rot, rnd)
    else if (i === 0 || !story) fragment(ctx, photo, detail, d, rot, rnd)
  })

  return toBlob(canvas, 'image/jpeg')
}

// ── Brutalista ──────────────────────────────────────────────────────────────────────────────────────────────

const CONDENSED = 0.8 // Parkinsans comprimida a lo ancho: letra «condensada» de cartel

export async function renderBrutalist(c: ShareCard, format: ShareFormat): Promise<Blob> {
  const story = format === 'story'
  const H = story ? 1920 : 1350
  const PAD = 48
  const rnd = seeded(`${c.folio}:brutalista`)

  await loadFonts()
  const [logo, campaign, ...photos] = await Promise.all([
    loadLocal(LOGOS.hackers.dark),
    c.campaignLogo ? loadLocal(c.campaignLogo.light) : Promise.resolve(null),
    ...c.photoUrls.slice(0, 2).map(loadRemote),
  ])
  const pics = photos.filter((p): p is Img => !!p)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.textBaseline = 'top'

  // Medidas primero: el titular arriba, la firma abajo y el bloque del relato encima de la firma
  const top = story ? 160 : 48
  const headY = top + (story ? 64 : 54)
  const OFFSETS = [0, 0.05, 0.015, 0.08, 0.03]
  const padX = (size: number) => size * 0.14
  const head = fit(ctx, c.title.toLocaleUpperCase('es-MX'), story ? [196, 178, 162, 148, 136, 124, 112, 102, 94] : [160, 146, 134, 122, 112, 102, 94, 86], (size) => (W - PAD * 2 - W * 0.08 - padX(size) * 2) / CONDENSED, story ? 5 : 4, 0.02, { line: 0.97, max: H * (story ? 0.28 : 0.31) })
  setFont(ctx, 800, head.size, -head.size * 0.02)
  ctx.textBaseline = 'alphabetic' // con 'top' la altura de las mayúsculas sale casi en cero
  const cap = ctx.measureText('H').actualBoundingBoxAscent
  ctx.textBaseline = 'top'
  const padTop = head.size * 0.2
  const stripH = cap + padTop + head.size * 0.13
  const stripStep = stripH - head.size * 0.05
  const headBottom = headY + head.lines.length * stripStep + head.size * 0.05

  const bandTop = story ? H - 300 : H - 132
  const boxW = Math.round(W * (story ? 0.8 : 0.74))
  const boxPad = story ? 30 : 24
  const inW = boxW - boxPad * 2
  const eSize = story ? 27 : 21
  const eLead = eSize * 1.36
  const qSize = story ? 27 : 21
  const qLead = qSize * 1.25
  const kickSize = story ? 21 : 18
  const whereLead = story ? 31 : 25
  setFont(ctx, 700, story ? 23 : 19)
  const where = wrap(ctx, `${c.place} · ${c.date}`, inW, 2)
  setFont(ctx, 800, qSize)
  const question = c.question ? wrap(ctx, `«${c.question}»`, inW, story ? 4 : 3) : []
  const questionH = question.length ? 22 + kickSize + 16 + 12 + question.length * qLead : 0
  // El relato ocupa lo que quede entre el titular (con aire para la imagen) y la firma
  const boxMax = bandTop - (story ? 44 : 30) - (headBottom + (story ? 150 : 80))
  const boxHeight = (lines: number) => boxPad * 2 + kickSize + 14 + where.length * whereLead + (lines ? 14 + lines * eLead : 0) + questionH
  let rel: string[] = []
  for (let lines = story ? 11 : 6; lines >= 1; lines--) {
    setFont(ctx, 500, eSize)
    rel = c.excerpt ? wrap(ctx, c.excerpt, inW, lines) : []
    if (boxHeight(rel.length) <= boxMax) break
  }
  const boxH = boxHeight(rel.length)
  const boxX = W - PAD - boxW
  const boxY = bandTop - (story ? 44 : 30) - boxH

  // Imagen a sangre: la foto del testimonio o la torre con su paisaje, fotocopiada
  let front: Pt[][] = []
  if (pics[0]) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, H)
    drawCover(ctx, pics[0], 0, 0, W, H)
    burn(ctx, W, H, rnd, 2, 0.4)
  } else {
    drawLandscape(ctx, W, H, H * 0.74, rnd)
    const apex: Pt = [W * 0.44, headBottom - H * 0.03]
    const lowArm = Math.max(apex[1] + H * 0.18, boxY - H * 0.01)
    const view = viewFor(apex, lowArm, W * 0.36, W * (story ? 0.9 : 0.8), 1.3)
    tilted(ctx, view.x, H, -6, () => drawCables(ctx, drawTower(ctx, view, story ? 9 : 8), W, H, rnd, story ? 3 : 2.6))
    burn(ctx, W, H, rnd, 3, 0.5)
    // Dos cables de una torre más cercana cruzan por delante del titular
    const y0 = top + H * 0.02
    front = [
      [[-40, y0], [W * 0.5, y0 + H * 0.13], [W + 40, y0 + H * 0.06]],
      [[-40, y0 + 34], [W * 0.5, y0 + H * 0.13 + 44], [W + 40, y0 + H * 0.06 + 30]],
    ]
  }
  photocopy(canvas, rnd, pics.length ? { contrast: 1.5, hard: 0.38, grain: 0.3 } : { contrast: 1.8, hard: 0.5, grain: 0.32 })
  wear(ctx, 0, 0, W, H, rnd, 1.2)

  if (pics[1]) {
    const fw = W * 0.34
    const src = copiedPhoto(pics[1], 600, 480, rnd, { contrast: 1.6, hard: 0.42, grain: 0.3 })
    fragment(ctx, src, [0, 0, src.width, src.height], [PAD - 10, Math.max(headBottom + 20, boxY - fw * 0.8 - 24), fw, fw * 0.8], -3, rnd)
  }

  // Logo de la campaña: sello en un pedazo de papel, arriba a la derecha (encimado sobre la foto)
  let stampW = 0
  if (campaign) {
    const sh = story ? 92 : 74
    const sw = (campaign.width / campaign.height) * sh
    stampW = sw + 28
    ctx.save()
    ctx.translate(W - PAD - stampW / 2, top + sh / 2 - 30)
    ctx.rotate((2.5 * Math.PI) / 180)
    ctx.fillStyle = PAPER
    ctx.fillRect(-stampW / 2, -sh / 2 - 14, stampW, sh + 28)
    ctx.lineWidth = 3
    ctx.strokeStyle = INK
    ctx.strokeRect(-stampW / 2, -sh / 2 - 14, stampW, sh + 28)
    ctx.drawImage(campaign, -sw / 2, -sh / 2, sw, sh)
    ctx.restore()
  }

  // Antetítulo en una tira negra
  setFont(ctx, 800, story ? 24 : 20, 3)
  const kicker = `TESTIMONIO · ${c.category.toUpperCase()}`
  const kw = Math.min(ctx.measureText(kicker).width, W - PAD * 2 - 32 - (stampW ? stampW + 20 : 0))
  ctx.fillStyle = INK
  ctx.fillRect(PAD, top, kw + 32, story ? 46 : 40)
  ctx.fillStyle = PAPER
  ctx.fillText(kicker, PAD + 16, top + (story ? 11 : 10), kw)

  // Titular: cada línea en su tira (papel o tinta, alternadas), corridas y apenas giradas, encimadas
  setFont(ctx, 800, head.size, -head.size * 0.02)
  ctx.textBaseline = 'alphabetic'
  head.lines.forEach((line, i) => {
    const tw = ctx.measureText(line).width * CONDENSED
    const sw = Math.min(tw + padX(head.size) * 2, W - 24)
    let x = PAD + W * OFFSETS[i % OFFSETS.length]!
    if (x + sw > W - 12) x = Math.max(12, W - 12 - sw)
    const y = headY + i * stripStep
    const dark = i % 2 === 1
    ctx.save()
    ctx.translate(x + sw / 2, y + stripH / 2)
    ctx.rotate(((rnd() - 0.5) * 1.8 * Math.PI) / 180)
    ctx.fillStyle = dark ? INK : PAPER
    ctx.fillRect(-sw / 2, -stripH / 2, sw, stripH)
    ctx.fillStyle = dark ? PAPER : INK
    ctx.scale(CONDENSED, 1)
    ctx.fillText(line, (-sw / 2 + padX(head.size)) / CONDENSED, -stripH / 2 + padTop + cap, (sw - padX(head.size) * 2) / CONDENSED)
    ctx.restore()
  })
  ctx.textBaseline = 'top'

  ctx.save()
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  for (const [a, m, b] of front) {
    ctx.beginPath()
    ctx.moveTo(a![0], a![1])
    ctx.quadraticCurveTo(m![0], m![1], b![0], b![1])
    ctx.stroke()
  }
  ctx.restore()

  // Bloque del relato: papel pegado con cinta
  ctx.save()
  ctx.translate(boxX + boxW / 2, boxY + boxH / 2)
  ctx.rotate((-0.7 * Math.PI) / 180)
  ctx.translate(-boxW / 2, -boxH / 2)
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, boxW, boxH)
  ctx.fillStyle = INK
  let y = boxPad
  setFont(ctx, 800, kickSize, 2)
  ctx.fillText('RELATO', boxPad, y)
  y += kickSize + 14
  setFont(ctx, 700, story ? 23 : 19)
  for (const line of where) {
    ctx.fillText(line, boxPad, y)
    y += whereLead
  }
  if (rel.length) {
    y += 14
    setFont(ctx, 500, eSize)
    for (const line of rel) {
      ctx.fillText(line, boxPad, y)
      y += eLead
    }
  }
  // Pregunta del Tribunal: etiqueta en tira negra y la pregunta en negritas
  if (question.length) {
    y += 22
    setFont(ctx, 800, kickSize, 2)
    const label = 'EL TRIBUNAL PREGUNTA'
    ctx.fillRect(boxPad, y, ctx.measureText(label).width + 20, kickSize + 16)
    ctx.fillStyle = PAPER
    ctx.fillText(label, boxPad + 10, y + 8)
    ctx.fillStyle = INK
    y += kickSize + 16 + 12
    setFont(ctx, 800, qSize)
    for (const line of question) {
      ctx.fillText(line, boxPad, y)
      y += qLead
    }
  }
  ctx.fillStyle = 'rgba(205,205,198,0.82)'
  for (const [tx, rot] of [[-20, -8], [boxW - 110, 7]] as const) {
    ctx.save()
    ctx.translate(tx + 65, -6)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.fillRect(-65, -16, 130, 32)
    ctx.restore()
  }
  ctx.restore()

  // Firma: banda negra abajo con la leyenda y el logo
  ctx.fillStyle = INK
  ctx.fillRect(0, bandTop, W, H - bandTop)
  const legendSize = story ? 34 : 28
  const legendY = bandTop + (story ? 34 : (H - bandTop - LEGEND_H(legendSize)) / 2)
  legend(ctx, PAD, legendY, legendSize, PAPER, '#b9b9b3', W * 0.56)
  if (logo) {
    const lh = story ? 70 : 56
    const lw = (logo.width / logo.height) * lh
    ctx.drawImage(logo, W - PAD - lw, legendY + (LEGEND_H(legendSize) - lh) / 2, lw, lh)
  }

  grainOver(ctx, W, H, rnd, 0.07)
  wear(ctx, 0, 0, W, H, rnd, 0.45)
  return toBlob(canvas, 'image/jpeg')
}
