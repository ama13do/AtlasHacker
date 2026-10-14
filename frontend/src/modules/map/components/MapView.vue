<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type ControlPosition,
  type ExpressionSpecification,
  type FitBoundsOptions,
  type FlyToOptions,
  type GeoJSONSource,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection, Point } from 'geojson'
import mexicoGeo from '@map/assets/mexico.json'
import { BRAND } from '@/core/config/theme'
import { useTheme, type Theme } from '@/core/theme/useTheme'
import { BASE_LAYERS, CITY_LABELS_MIN_ZOOM, MAP_STYLES, MAX_ZOOM, MEXICO_BOUNDS, MEXICO_CENTER, MIN_ZOOM, type MapDetail } from '@map/config'
import { buildOutsideMask } from '@map/utils/mask'
import { STATE_FEATURES, stateBounds, stateFeature } from '@map/utils/geo'
import type { MapPoint } from '@map/types/map'

// MapLibre resuelve su worker relativo a su propio módulo; Vite lo reubica al pre-empaquetar
setWorkerUrl(workerUrl)

const props = withDefaults(
  defineProps<{
    points?: MapPoint[]
    selectedId?: string | null
    navigationPosition?: ControlPosition
    // Margen del encuadre inicial, p. ej. para no quedar bajo un header superpuesto
    fitPadding?: FitBoundsOptions['padding']
    // Permite elegir una ubicación con un clic (emite `pick`)
    pickable?: boolean
    // Detalle del mapa base: solo estados, o estados + ciudades al acercarse
    detail?: MapDetail
    // Permite elegir un estado con un clic (emite `selectState`); `selectedState` = código ISO (MX-JAL)
    selectableStates?: boolean
    selectedState?: string | null
  }>(),
  {
    points: () => [],
    selectedId: null,
    navigationPosition: 'top-right',
    fitPadding: 20,
    pickable: false,
    detail: 'states',
    selectableStates: false,
    selectedState: null,
  },
)

const emit = defineEmits<{
  select: [id: string]
  pick: [coordinates: [number, number]]
  selectState: [code: string | null]
}>()

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

// Datos de las capas del estado seleccionado: máscara alrededor y su contorno
function selectedStateData(code: string | null) {
  const feature = code ? stateFeature(code) : undefined
  return {
    mask: feature ? buildOutsideMask({ type: 'FeatureCollection', features: [feature] }) : EMPTY,
    outline: feature ? { type: 'FeatureCollection' as const, features: [feature] } : EMPTY,
  }
}

const mexico = mexicoGeo as FeatureCollection
const { theme } = useTheme()

// Colores de las capas propias según el tema del mapa base
const LAYER_COLORS: Record<
  Theme,
  { mask: string; maskOpacity: number; outline: string; ink: string; states: string; statesOpacity: number; halo: string }
> = {
  dark: { mask: BRAND.black, maskOpacity: 0.6, outline: BRAND.neonGreen, ink: BRAND.white, states: BRAND.neonGreen, statesOpacity: 0.35, halo: BRAND.black },
  light: { mask: BRAND.white, maskOpacity: 0.7, outline: BRAND.black, ink: BRAND.black, states: BRAND.black, statesOpacity: 0.25, halo: BRAND.white },
}

// Deja del estilo base solo fondo, agua, límites y nombres de estado (y ciudades al acercarse si se pide)
function simplifyBaseStyle(instance: MapLibreMap, detail: MapDetail) {
  const t = theme.value
  const layers = BASE_LAYERS[t]
  const colors = LAYER_COLORS[t]
  const keep = new Set([
    ...layers.base,
    ...layers.stateBoundaries,
    ...layers.stateLabels,
    ...(detail === 'states+cities' ? layers.cityLabels : []),
  ])

  for (const layer of instance.getStyle().layers) {
    if (!keep.has(layer.id)) instance.setLayoutProperty(layer.id, 'visibility', 'none')
  }

  const exists = (id: string) => !!instance.getLayer(id)

  // Contorno de cada estado
  for (const id of layers.stateBoundaries.filter(exists)) {
    instance.setFilter(id, ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]])
    instance.setPaintProperty(id, 'line-color', colors.states)
    instance.setPaintProperty(id, 'line-opacity', colors.statesOpacity)
    instance.setPaintProperty(id, 'line-width', ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.2])
    instance.setPaintProperty(id, 'line-dasharray', [1, 0]) // continua
    instance.setLayerZoomRange(id, 0, 24)
  }

  // Nombres (estados siempre; ciudades desde CITY_LABELS_MIN_ZOOM): tenues, en español si existe
  const labels = [...layers.stateLabels, ...(detail === 'states+cities' ? layers.cityLabels : [])].filter(exists)
  for (const id of labels) {
    instance.setLayoutProperty(id, 'text-field', ['coalesce', ['get', 'name:es'], ['get', 'name']])
    instance.setPaintProperty(id, 'text-color', colors.ink)
    instance.setPaintProperty(id, 'text-opacity', layers.stateLabels.includes(id) ? 0.55 : 0.7)
    instance.setPaintProperty(id, 'text-halo-color', colors.halo)
    instance.setPaintProperty(id, 'text-halo-width', 1.2)
  }
  for (const id of layers.stateLabels.filter(exists)) instance.setLayerZoomRange(id, 3.5, 24)
  if (detail === 'states+cities') {
    for (const id of layers.cityLabels.filter(exists)) instance.setLayerZoomRange(id, CITY_LABELS_MIN_ZOOM, 24)
  }
}

// Valor según si el punto es el seleccionado
function bySelected(id: string | null, selected: number, other: number): ExpressionSpecification {
  return ['case', ['==', ['get', 'id'], id ?? ''], selected, other]
}

function pointsToGeoJSON(points: MapPoint[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: { id: p.id, color: p.color },
      geometry: { type: 'Point', coordinates: p.coordinates },
    })),
  }
}

const container = ref<HTMLDivElement | null>(null)
// Instancia fuera de la reactividad de Vue para evitar proxies
let map: MapLibreMap | null = null
// Si se pidió un flyTo antes de cargar el estilo, no pisarlo con el encuadre inicial;
// tras el primer encuadre tampoco se re-encuadra (p. ej. al cambiar de tema)
let cameraRequested = false

onMounted(() => {
  if (!container.value) return

  const instance = new MapLibreMap({
    container: container.value,
    style: MAP_STYLES[theme.value],
    center: MEXICO_CENTER,
    zoom: 4.5,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    maxBounds: MEXICO_BOUNDS,
    // Atribución compacta (botón ⓘ) para no chocar con otros controles en móvil
    attributionControl: { compact: true },
    dragRotate: false,
    touchPitch: false,
  })

  instance.touchZoomRotate.disableRotation()
  instance.addControl(new NavigationControl({ showCompass: false }), props.navigationPosition)

  // style.load no espera a las teselas: las capas propias aparecen de inmediato
  // También se dispara tras setStyle (cambio de tema): las capas propias se vuelven a añadir
  instance.on('style.load', () => {
    const colors = LAYER_COLORS[theme.value]
    simplifyBaseStyle(instance, props.detail)

    instance.addSource('mexico-mask', { type: 'geojson', data: buildOutsideMask(mexico) })
    instance.addLayer({
      id: 'mexico-mask',
      type: 'fill',
      source: 'mexico-mask',
      paint: { 'fill-color': colors.mask, 'fill-opacity': colors.maskOpacity },
    })

    instance.addSource('mexico', { type: 'geojson', data: mexico })
    instance.addLayer({
      id: 'mexico-outline',
      type: 'line',
      source: 'mexico',
      paint: { 'line-color': colors.outline, 'line-width': 1.5 },
    })

    if (props.selectableStates) addStateLayers(instance, colors)

    instance.addSource('points', { type: 'geojson', data: pointsToGeoJSON(props.points) })
    instance.addLayer({
      id: 'points-halo',
      type: 'circle',
      source: 'points',
      paint: {
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.25,
        'circle-radius': bySelected(props.selectedId, 22, 12),
      },
    })
    instance.addLayer({
      id: 'points',
      type: 'circle',
      source: 'points',
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': bySelected(props.selectedId, 9, 6),
        'circle-stroke-color': colors.ink,
        'circle-stroke-width': bySelected(props.selectedId, 2.5, 1),
      },
    })

    if (!cameraRequested) {
      const bounds = (props.selectedState && stateBounds(props.selectedState)) || MEXICO_BOUNDS
      instance.fitBounds(bounds, { padding: props.fitPadding, animate: false })
    }
    cameraRequested = true
  })

  if (props.selectableStates) bindStateEvents(instance)

  instance.on('click', 'points', (e) => {
    if (props.pickable) return
    const id = e.features?.[0]?.properties?.id
    if (typeof id === 'string') emit('select', id)
  })
  instance.on('mouseenter', 'points', () => (instance.getCanvas().style.cursor = props.pickable ? 'crosshair' : 'pointer'))
  instance.on('mouseleave', 'points', () => (instance.getCanvas().style.cursor = props.pickable ? 'crosshair' : ''))

  // `pickable` puede cambiar en vivo (el mapa del inicio entra en modo «marcar» con el formulario)
  if (props.pickable) instance.getCanvas().style.cursor = 'crosshair'
  instance.on('click', (e) => {
    if (props.pickable) emit('pick', [e.lngLat.lng, e.lngLat.lat])
  })

  map = instance
})

watch(
  () => props.points,
  (points) => map?.getSource<GeoJSONSource>('points')?.setData(pointsToGeoJSON(points)),
  { deep: true },
)

watch(
  () => props.selectedId,
  (id) => {
    if (!map?.getLayer('points')) return
    map.setPaintProperty('points-halo', 'circle-radius', bySelected(id, 22, 12))
    map.setPaintProperty('points', 'circle-radius', bySelected(id, 9, 6))
    map.setPaintProperty('points', 'circle-stroke-width', bySelected(id, 2.5, 1))
  },
)

watch(
  () => props.pickable,
  (on) => map && (map.getCanvas().style.cursor = on ? 'crosshair' : ''),
)

watch(theme, (value) => map?.setStyle(MAP_STYLES[value], { diff: false }))

// --- Selección de estado ---

// Capas: relleno invisible para el clic (se aclara al pasar el cursor), municipios (líneas del mapa base,
// solo con un estado elegido), máscara alrededor del estado elegido y su contorno
function addStateLayers(instance: MapLibreMap, colors: (typeof LAYER_COLORS)[Theme]) {
  const selected = selectedStateData(props.selectedState)
  instance.addSource('states', { type: 'geojson', data: { type: 'FeatureCollection', features: STATE_FEATURES }, promoteId: 'code' })
  instance.addLayer({
    id: 'states-fill',
    type: 'fill',
    source: 'states',
    paint: { 'fill-color': colors.states, 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0] },
  })
  if (instance.getSource('openmaptiles')) {
    instance.addLayer({
      id: 'municipalities',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      // OpenFreeMap solo trae admin_level 6 (municipios) desde z9
      minzoom: 9,
      filter: ['all', ['==', ['get', 'admin_level'], 6], ['!=', ['get', 'maritime'], 1]],
      layout: { visibility: props.selectedState ? 'visible' : 'none' },
      paint: { 'line-color': colors.ink, 'line-opacity': 0.45, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.4] },
    })
  }
  instance.addSource('state-mask', { type: 'geojson', data: selected.mask })
  instance.addLayer({ id: 'state-mask', type: 'fill', source: 'state-mask', paint: { 'fill-color': colors.mask, 'fill-opacity': 0.55 } })
  instance.addSource('state-selected', { type: 'geojson', data: selected.outline })
  instance.addLayer({ id: 'state-outline', type: 'line', source: 'state-selected', paint: { 'line-color': colors.outline, 'line-width': 2.5 } })
}

function bindStateEvents(instance: MapLibreMap) {
  let hovered: string | null = null
  const setHover = (code: string | null) => {
    if (hovered) instance.setFeatureState({ source: 'states', id: hovered }, { hover: false })
    hovered = code
    if (code) instance.setFeatureState({ source: 'states', id: code }, { hover: true })
  }

  instance.on('mousemove', 'states-fill', (e) => {
    if (props.pickable) return setHover(null)
    const code = e.features?.[0]?.properties?.code as string | undefined
    // Con un estado elegido, solo él reacciona; el resto está bajo la máscara
    setHover(code && (!props.selectedState || code === props.selectedState) ? code : null)
    if (!instance.queryRenderedFeatures(e.point, { layers: ['points'] }).length) {
      instance.getCanvas().style.cursor = code ? 'pointer' : ''
    }
  })
  instance.on('mouseleave', 'states-fill', () => {
    setHover(null)
    instance.getCanvas().style.cursor = props.pickable ? 'crosshair' : ''
  })

  instance.on('click', (e) => {
    if (props.pickable || !instance.getLayer('states-fill')) return
    // Un pin gana sobre el estado que tiene debajo
    if (instance.queryRenderedFeatures(e.point, { layers: ['points'] }).length) return
    const code = instance.queryRenderedFeatures(e.point, { layers: ['states-fill'] })[0]?.properties?.code as string | undefined
    if (props.selectedState) {
      // Clic fuera del estado elegido (en la máscara o el mar): volver a todo México
      if (code !== props.selectedState) emit('selectState', null)
    } else if (code) {
      emit('selectState', code)
    }
  })
}

watch(
  () => props.selectedState,
  (code) => {
    if (!map?.getSource('state-mask')) return
    const selected = selectedStateData(code)
    map.getSource<GeoJSONSource>('state-mask')?.setData(selected.mask)
    map.getSource<GeoJSONSource>('state-selected')?.setData(selected.outline)
    if (map.getLayer('municipalities')) map.setLayoutProperty('municipalities', 'visibility', code ? 'visible' : 'none')
    cameraRequested = true
    map.fitBounds((code && stateBounds(code)) || MEXICO_BOUNDS, { padding: props.fitPadding, duration: 800 })
  },
)

function flyTo(coordinates: [number, number], padding?: FlyToOptions['padding']) {
  cameraRequested = true
  map?.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 7), padding, essential: true })
}

defineExpose({ flyTo })

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
