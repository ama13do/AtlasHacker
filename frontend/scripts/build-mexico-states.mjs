#!/usr/bin/env node
/**
 * Genera src/modules/map/assets/mexico-states.json: los 32 estados de México como polígonos simplificados.
 * Fuente: Natural Earth 10m admin-1 (dominio público). Se descarga a una carpeta temporal y se borra al terminar.
 *
 *   npm run map:states
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson'
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/modules/map/assets/mexico-states.json')
const TOLERANCE = 0.005 // grados (~500 m): suficiente para clic, resalte y encuadre
const DECIMALS = 4

// Nombres oficiales en español donde Natural Earth difiere
const NAMES = {
  'MX-CMX': 'Ciudad de México',
  'MX-MEX': 'Estado de México',
  'MX-COA': 'Coahuila',
  'MX-MIC': 'Michoacán',
  'MX-VER': 'Veracruz',
  'MX-NLE': 'Nuevo León',
  'MX-QUE': 'Querétaro',
  'MX-SLP': 'San Luis Potosí',
  'MX-YUC': 'Yucatán',
}

// Douglas-Peucker sobre un anillo
function sqSegDist([x, y], [x1, y1], [x2, y2]) {
  let dx = x2 - x1
  let dy = y2 - y1
  if (dx || dy) {
    const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
    if (t > 1) [x1, y1] = [x2, y2]
    else if (t > 0) [x1, y1] = [x1 + dx * t, y1 + dy * t]
  }
  dx = x - x1
  dy = y - y1
  return dx * dx + dy * dy
}

function simplify(points, tol) {
  if (points.length <= 4) return points
  const sq = tol * tol
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()
    let max = 0
    let index = 0
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(points[i], points[first], points[last])
      if (d > max) [max, index] = [d, i]
    }
    if (max > sq) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }
  return points.filter((_, i) => keep[i])
}

const round = (n) => Math.round(n * 10 ** DECIMALS) / 10 ** DECIMALS

function simplifyRing(ring) {
  const out = simplify(ring, TOLERANCE).map(([x, y]) => [round(x), round(y)])
  return out.length >= 4 ? out : null // descarta islotes que colapsan
}

function simplifyGeometry(g) {
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const result = polygons
    .map((rings) => {
      const outer = simplifyRing(rings[0])
      return outer ? [outer, ...rings.slice(1).map(simplifyRing).filter(Boolean)] : null
    })
    .filter(Boolean)
  return result.length === 1 ? { type: 'Polygon', coordinates: result[0] } : { type: 'MultiPolygon', coordinates: result }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ne-admin1-'))
try {
  console.log('Descargando Natural Earth 10m admin-1…')
  const res = await fetch(SOURCE)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const file = path.join(tmp, 'admin1.geojson')
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  const world = JSON.parse(fs.readFileSync(file, 'utf8'))

  const features = world.features
    .filter((f) => (f.properties.adm0_a3 ?? f.properties.ADM0_A3) === 'MEX')
    .map((f) => {
      let code = f.properties.iso_3166_2 ?? f.properties.ISO_3166_2
      if (code === 'MX-DIF') code = 'MX-CMX' // antes «Distrito Federal»
      const p = f.properties
      const name = NAMES[code] ?? p.name_es ?? p.NAME_ES ?? p.name ?? p.NAME ?? p.gn_name ?? code
      return { type: 'Feature', properties: { code, name }, geometry: simplifyGeometry(f.geometry) }
    })
    // Natural Earth agrega territorios sin estado (código «MX-X01~», islas): no son entidades federativas
    .filter((f) => /^MX-[A-Z]{3}$/.test(f.properties.code))
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'es'))

  if (features.length !== 32) throw new Error(`Se esperaban 32 estados y salieron ${features.length}: ${features.map((f) => f.properties.code + "=" + f.properties.name).join(", ")}`)
  fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features }))
  console.log(`✓ ${features.length} estados → ${path.relative(process.cwd(), OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
