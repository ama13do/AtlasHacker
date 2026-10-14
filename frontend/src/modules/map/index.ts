// API pública del módulo: otros módulos solo importan desde aquí
export { default as MapView } from './components/MapView.vue'
export type { MapPoint } from './types/map'
export { isInsideMexico, MEXICO_STATES, stateAt, type MexicoState } from './utils/geo'
export { MEXICO_BOUNDS } from './config'
export { reverseGeocode, searchPlaces, type Place } from './services/geocoding'
