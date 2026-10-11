import type { Feature, FeatureCollection, Polygon, Position } from 'geojson'

const WORLD_RING: Position[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
]

// Polígono que cubre el mundo con huecos en la forma del área dada,
// para oscurecer todo lo que queda fuera de ella
export function buildOutsideMask(area: FeatureCollection): Feature<Polygon> {
  const holes: Position[][] = []

  for (const { geometry } of area.features) {
    if (geometry.type === 'Polygon') {
      holes.push(geometry.coordinates[0])
    } else if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.coordinates) holes.push(polygon[0])
    }
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...holes] },
  }
}
