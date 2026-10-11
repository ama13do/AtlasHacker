<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection } from 'geojson'
import mexicoGeo from '../assets/mexico.json'
import { BRAND } from '@/core/config/theme'
import { MAP_STYLE, MAX_ZOOM, MEXICO_BOUNDS, MEXICO_CENTER, MIN_ZOOM } from '../config'
import { buildOutsideMask } from '../utils/mask'

// MapLibre resuelve su worker relativo a su propio módulo; Vite lo reubica al pre-empaquetar
setWorkerUrl(workerUrl)

const mexico = mexicoGeo as FeatureCollection

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
    dragRotate: false,
    touchPitch: false,
  })

  instance.touchZoomRotate.disableRotation()
  instance.addControl(new NavigationControl({ showCompass: false }), 'top-right')

  instance.on('load', () => {
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

    instance.fitBounds(MEXICO_BOUNDS, { padding: 20, animate: false })
  })

  map = instance
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
