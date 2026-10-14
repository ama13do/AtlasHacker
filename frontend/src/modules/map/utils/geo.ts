import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import mexicoGeo from '@map/assets/mexico.json'
import statesGeo from '@map/assets/mexico-states.json'

const mexico = mexicoGeo as FeatureCollection

// Ray casting sobre un anillo [lng, lat]
function inRing([x, y]: [number, number], ring: Position[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inPolygon(point: [number, number], rings: Position[][]) {
  return inRing(point, rings[0]) && !rings.slice(1).some((hole) => inRing(point, hole))
}

export function isInsideMexico(point: [number, number]): boolean {
  return mexico.features.some(({ geometry }) => {
    if (geometry.type === 'Polygon') return inPolygon(point, geometry.coordinates)
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((p) => inPolygon(point, p))
    return false
  })
}

// --- Estados ---


export interface MexicoState {
  code: string // ISO 3166-2, p. ej. MX-JAL
  name: string
}

export type StateFeature = Feature<Polygon | MultiPolygon, MexicoState>

export const STATE_FEATURES = (statesGeo as { features: StateFeature[] }).features
export const MEXICO_STATES: MexicoState[] = STATE_FEATURES.map((f) => f.properties)

function inGeometry(point: [number, number], geometry: Polygon | MultiPolygon) {
  return geometry.type === 'Polygon' ? inPolygon(point, geometry.coordinates) : geometry.coordinates.some((p) => inPolygon(point, p))
}

// Estado que contiene el punto (null si cae fuera, p. ej. en el mar)
export function stateAt(point: [number, number]): MexicoState | null {
  return STATE_FEATURES.find((f) => inGeometry(point, f.geometry))?.properties ?? null
}

export function stateFeature(code: string): StateFeature | undefined {
  return STATE_FEATURES.find((f) => f.properties.code === code)
}

// [[oeste, sur], [este, norte]] del estado
export function stateBounds(code: string): [[number, number], [number, number]] | null {
  const f = stateFeature(code)
  if (!f) return null
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity]
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  for (const polygon of polygons) {
    for (const [x, y] of polygon[0]) {
      w = Math.min(w, x)
      s = Math.min(s, y)
      e = Math.max(e, x)
      n = Math.max(n, y)
    }
  }
  return [
    [w, s],
    [e, n],
  ]
}
