import type { FeatureCollection, Position } from 'geojson'
import mexicoGeo from '@map/assets/mexico.json'

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
