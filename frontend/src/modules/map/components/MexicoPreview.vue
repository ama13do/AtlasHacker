<script lang="ts">
import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import mexicoGeo from '@map/assets/mexico.json'
import { STATE_FEATURES } from '@map/utils/geo'

// Silueta de México en SVG (sin MapLibre) para portadas: como el mapa de hxnf.vercel.app/capitulos,
// relleno de papel, trazo verde grueso, contorno de tinta y sombra dura desplazada.
// Proyección equirectangular corregida por la latitud media; se calcula una sola vez por sesión.

const W = 1000
const PAD = 14
const [MIN_LON, MAX_LON, MIN_LAT, MAX_LAT] = [-118.5, -86.6, 14.4, 32.8]
const COS = Math.cos((((MIN_LAT + MAX_LAT) / 2) * Math.PI) / 180)
const SCALE = (W - PAD * 2) / ((MAX_LON - MIN_LON) * COS)
const H = Math.round((MAX_LAT - MIN_LAT) * SCALE + PAD * 2)

function project([lon, lat]: Position | [number, number]): [number, number] {
  return [PAD + (lon - MIN_LON) * COS * SCALE, PAD + (MAX_LAT - lat) * SCALE]
}

// `step` salta vértices: los estados solo se insinúan, no hace falta su detalle
function ringPath(ring: Position[], step = 1) {
  const pts = ring.filter((_, i) => i % step === 0 || i === ring.length - 1).map(project)
  return `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`
}

function geometryPath(geometry: Polygon | MultiPolygon, step = 1) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.map((rings) => rings.map((r) => ringPath(r, step)).join('')).join('')
}

const COUNTRY = (mexicoGeo as FeatureCollection<Polygon | MultiPolygon>).features.map((f) => geometryPath(f.geometry)).join('')
const STATES = STATE_FEATURES.map((f) => geometryPath(f.geometry, 4)).join('')
</script>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ points?: { coordinates: [number, number]; color: string }[]; max?: number }>(), {
  points: () => [],
  max: 250,
})

const dots = computed(() =>
  props.points.slice(0, props.max).map((p) => {
    const [x, y] = project(p.coordinates)
    return { x, y, color: p.color }
  }),
)
</script>

<template>
  <svg :viewBox="`-6 -6 ${W + 20} ${H + 20}`" class="h-auto w-full overflow-visible" aria-hidden="true">
    <path :d="COUNTRY" transform="translate(16 16)" class="fill-black stroke-black dark:fill-neon-lime dark:stroke-neon-lime" stroke-width="9" stroke-linejoin="round" />
    <path :d="COUNTRY" class="fill-white stroke-neon-green dark:fill-black" stroke-width="9" stroke-linejoin="round" />
    <path :d="STATES" class="fill-none stroke-black/25 dark:stroke-white/25" stroke-width="1.4" stroke-linejoin="round" />
    <path :d="COUNTRY" class="fill-none stroke-black dark:stroke-white" stroke-width="2.4" stroke-linejoin="round" />
    <g v-for="(d, i) in dots" :key="i">
      <circle :cx="d.x + 3" :cy="d.y + 3" r="9" class="fill-black" />
      <circle :cx="d.x" :cy="d.y" r="9" :fill="d.color" class="stroke-black" stroke-width="2.6" />
    </g>
  </svg>
</template>
