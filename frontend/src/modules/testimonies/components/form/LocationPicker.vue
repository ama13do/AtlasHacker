<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { isInsideMexico, MapView, type MapPoint } from '@/modules/map'
import { BRAND } from '@/core/config/theme'
import { useMainMapPicker } from '@testimonies/composables/useMainMapPicker'

import type { LocationSource } from '@testimonies/types/testimony'

defineProps<{ error?: string; describedby?: string }>()
// Además del punto: de dónde salió y, con GPS, su precisión en metros
const emit = defineEmits<{ located: [source: LocationSource, accuracy: number | null] }>()
const model = defineModel<[number, number] | null>({ required: true })

const mapView = ref<InstanceType<typeof MapView> | null>(null)

// En escritorio, dentro del inicio, el lugar se marca en el mapa grande (no hay mini-mapa)
const mainMap = useMainMapPicker()
const desktop = window.matchMedia('(min-width: 48rem)')
const isDesktop = ref(desktop.matches)
const onMedia = (e: MediaQueryListEvent) => (isDesktop.value = e.matches)
desktop.addEventListener('change', onMedia)
const useMainMap = computed(() => !!mainMap && isDesktop.value)

if (mainMap) {
  mainMap.onPick((coordinates) => setPoint(coordinates))
  watch(useMainMap, (on) => (mainMap.active.value = on), { immediate: true })
  watch(model, (point) => (mainMap.point.value = point), { immediate: true })
}

onBeforeUnmount(() => {
  desktop.removeEventListener('change', onMedia)
  if (!mainMap) return
  mainMap.active.value = false
  mainMap.point.value = null
  mainMap.onPick(null)
})
const locating = ref(false)
const message = ref<string | null>(null)

const points = computed<MapPoint[]>(() =>
  model.value ? [{ id: 'pick', coordinates: model.value, color: BRAND.neonLime }] : [],
)

function setPoint(coordinates: [number, number], source: LocationSource = 'mapa', accuracy: number | null = null) {
  if (!isInsideMexico(coordinates)) {
    message.value = 'Ese punto está fuera de México. Elige un lugar dentro del país.'
    return
  }
  message.value = null
  model.value = coordinates
  emit('located', source, accuracy)
}

function useMyLocation() {
  if (!('geolocation' in navigator)) {
    message.value = 'Tu navegador no permite obtener la ubicación. Toca el mapa para marcarla.'
    return
  }
  locating.value = true
  message.value = null
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      locating.value = false
      const point: [number, number] = [coords.longitude, coords.latitude]
      if (!isInsideMexico(point)) {
        message.value = 'Tu ubicación está fuera de México. Toca el mapa para marcar el lugar.'
        return
      }
      setPoint(point, 'gps', coords.accuracy)
      if (useMainMap.value) mainMap?.flyTo(point)
      else mapView.value?.flyTo(point)
    },
    () => {
      locating.value = false
      message.value = 'No pudimos obtener tu ubicación. Toca el mapa para marcarla.'
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}
</script>

<template>
  <div class="space-y-2">
    <!-- Escritorio: el mapa grande, a la derecha, está en modo «marcar» -->
    <div
      v-if="useMainMap"
      class="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm"
      :class="error ? 'border-brand-orange' : model ? 'border-fg/20' : 'border-dashed border-fg/30'"
    >
      <svg viewBox="0 0 24 24" class="size-5 shrink-0 text-accent-ink" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
      <span class="flex-1">{{ model ? 'Lugar marcado. Toca el mapa para moverlo.' : 'Toca el mapa de la derecha para marcar el lugar.' }}</span>
    </div>
    <div
      v-else
      class="relative h-64 overflow-hidden rounded-2xl border @xl:h-72 @3xl:h-88"
      :class="error ? 'border-brand-orange' : 'border-fg/20'"
    >
      <MapView
        ref="mapView"
        detail="states+cities"
        class="absolute inset-0"
        pickable
        :points="points"
        selected-id="pick"
        navigation-position="bottom-right"
        @pick="setPoint($event)"
      />
      <p
        v-if="!model"
        class="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-surface/80 px-3 py-1.5 text-xs text-fg"
      >
        Toca el mapa para marcar el lugar
      </p>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-fg/30 px-4 py-2 text-sm font-semibold transition hover:border-neon-lime hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-fg disabled:opacity-50"
        :disabled="locating"
        :aria-describedby="describedby"
        @click="useMyLocation"
      >
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
        {{ locating ? 'Obteniendo ubicación…' : 'Usar mi ubicación' }}
      </button>
      <p v-if="model" class="text-xs text-fg/60 tabular-nums">
        {{ model[1].toFixed(4) }}, {{ model[0].toFixed(4) }}
      </p>
    </div>

    <p v-if="message" role="status" class="text-sm text-danger">{{ message }}</p>
  </div>
</template>
