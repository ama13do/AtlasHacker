import type { LngLatBoundsLike, LngLatLike } from 'maplibre-gl'

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark'

// Rectángulo de México con margen; limita paneo y zoom
export const MEXICO_BOUNDS: LngLatBoundsLike = [
  [-119.5, 13.5],
  [-85.0, 33.5],
]

export const MEXICO_CENTER: LngLatLike = [-102.5, 23.6]
export const MIN_ZOOM = 4
export const MAX_ZOOM = 18
