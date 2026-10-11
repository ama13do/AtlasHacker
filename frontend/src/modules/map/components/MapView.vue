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
import { MAP_STYLE, MAX_ZOOM, MEXICO_BOUNDS, MEXICO_CENTER, MIN_ZOOM } from '@map/config'
import { buildOutsideMask } from '@map/utils/mask'
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
  }>(),
  { points: () => [], selectedId: null, navigationPosition: 'top-right', fitPadding: 20 },
)

const emit = defineEmits<{ select: [id: string] }>()

const mexico = mexicoGeo as FeatureCollection

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

onMounted(() => {
  if (!container.value) return

  const instance = new MapLibreMap({
    container: container.value,
    style: MAP_STYLE,
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
  instance.on('style.load', () => {
    instance.addSource('mexico-mask', { type: 'geojson', data: buildOutsideMask(mexico) })
    instance.addLayer({
      id: 'mexico-mask',
      type: 'fill',
      source: 'mexico-mask',
      paint: { 'fill-color': BRAND.black, 'fill-opacity': 0.6 },
    })

    instance.addSource('mexico', { type: 'geojson', data: mexico })
    instance.addLayer({
      id: 'mexico-outline',
      type: 'line',
      source: 'mexico',
      paint: { 'line-color': BRAND.neonGreen, 'line-width': 1.5 },
    })

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
        'circle-stroke-color': BRAND.white,
        'circle-stroke-width': bySelected(props.selectedId, 2.5, 0),
      },
    })

    instance.fitBounds(MEXICO_BOUNDS, { padding: props.fitPadding, animate: false })
  })

  instance.on('click', 'points', (e) => {
    const id = e.features?.[0]?.properties?.id
    if (typeof id === 'string') emit('select', id)
  })
  instance.on('mouseenter', 'points', () => (instance.getCanvas().style.cursor = 'pointer'))
  instance.on('mouseleave', 'points', () => (instance.getCanvas().style.cursor = ''))

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
    map.setPaintProperty('points', 'circle-stroke-width', bySelected(id, 2.5, 0))
  },
)

function flyTo(coordinates: [number, number], padding?: FlyToOptions['padding']) {
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
