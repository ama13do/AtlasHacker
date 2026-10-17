import type { LngLatBoundsLike, LngLatLike } from 'maplibre-gl'

import type { Theme } from '@/core/theme/useTheme'

export const MAP_STYLES: Record<Theme, string> = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
}

// Rectángulo de México con margen; limita paneo y zoom
export const MEXICO_BOUNDS = [
  [-119.5, 12.0], // sur con holgura: con el sur arriba, el header superpuesto queda encima
  [-85.0, 33.5],
] satisfies LngLatBoundsLike as [[number, number], [number, number]]

// Límite de paneo: más holgado que el encuadre, para que en pantallas altas o estrechas
// se pueda ver México completo (un maxBounds justo obliga a acercar). Con el sur arriba
// el margen de pantalla cae hacia el sur, por eso llega más abajo
export const PAN_BOUNDS = [
  [-145, -35],
  [-55, 62],
] satisfies LngLatBoundsLike as [[number, number], [number, number]]

export const MEXICO_CENTER: LngLatLike = [-102.5, 23.6]
export const MIN_ZOOM = 3
export const MAX_ZOOM = 18

// --- Mapa base simplificado ---
// De los estilos de OpenFreeMap solo se conservan estas capas; el resto se oculta en `style.load`.
// Si OpenFreeMap renombra una capa, simplemente se ignora (se comprueba con getLayer)

export type MapDetail = 'states' | 'states+cities'

interface BaseLayers {
  base: string[] // fondo y agua
  stateBoundaries: string[] // límites estatales (admin_level 4)
  stateLabels: string[] // nombres de estado
  cityLabels: string[] // ciudades y pueblos (solo en `states+cities`)
  // Calles, ríos y localidades: solo en `states+cities` y al acercarse (para marcar un punto exacto)
  streets: string[]
  localLabels: string[]
}

export const BASE_LAYERS: Record<Theme, BaseLayers> = {
  dark: {
    base: ['background', 'water'],
    stateBoundaries: ['boundary_state'],
    stateLabels: ['place_state'],
    cityLabels: ['place_city_large', 'place_city', 'place_town'],
    streets: ['landuse_residential', 'waterway', 'highway_minor', 'highway_major_casing', 'highway_major_inner', 'highway_major_subtle', 'highway_motorway_casing', 'highway_motorway_inner', 'highway_motorway_subtle', 'highway_name_other', 'highway_name_motorway'],
    localLabels: ['place_village', 'place_suburb', 'place_other'],
  },
  light: {
    base: ['background', 'water'],
    // boundary_3 incluye niveles 3–6: se filtra a estados en MapView
    stateBoundaries: ['boundary_3'],
    stateLabels: ['label_state'],
    cityLabels: ['label_city_capital', 'label_city', 'label_town'],
    streets: ['landuse_residential', 'waterway', 'highway_minor', 'highway_major_casing', 'highway_major_inner', 'highway_major_subtle', 'highway_motorway_casing', 'highway_motorway_inner', 'highway_motorway_subtle', 'highway-name-minor', 'highway-name-major'],
    localLabels: ['label_village', 'label_other'],
  },
}

// Las ciudades aparecen al acercarse, para ubicarse sin saturar la vista general
export const CITY_LABELS_MIN_ZOOM = 7
export const STREETS_MIN_ZOOM = 9
