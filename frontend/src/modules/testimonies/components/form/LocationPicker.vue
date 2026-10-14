<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { isInsideMexico, MapView, reverseGeocode, type Place } from '@/modules/map'
import { useMainMapPicker } from '@testimonies/composables/useMainMapPicker'
import PlaceSearch from '@testimonies/components/form/PlaceSearch.vue'

import type { LocationSource } from '@testimonies/types/testimony'

defineProps<{ error?: string; describedby?: string; inputId?: string }>()
// Además del punto: de dónde salió y, con GPS, su precisión en metros. `place`: el lugar que corresponde
// al punto (de la búsqueda o de la geocodificación inversa) para completar lugar, municipio y estado
const emit = defineEmits<{ located: [source: LocationSource, accuracy: number | null]; place: [place: Place | null] }>()
const model = defineModel<[number, number] | null>({ required: true })

const mapView = ref<InstanceType<typeof MapView> | null>(null)

// Dentro de la vista del mapa el lugar se marca en el mapa grande (a un lado); fuera (editar desde Mi folio), en un mini-mapa
const mainMap = useMainMapPicker()

if (mainMap) {
  mainMap.onPick((coordinates) => setPoint(coordinates))
  mainMap.active.value = true
  watch(model, (point) => (mainMap.point.value = point), { immediate: true })
  // Al volver a este paso con un punto ya marcado: llevar el mapa hasta él
  if (model.value) mainMap.flyTo(model.value, 12)
}

onBeforeUnmount(() => {
  controller?.abort()
  if (!mainMap) return
  mainMap.active.value = false
  mainMap.point.value = null
  mainMap.onPick(null)
})

const locating = ref(false)
const message = ref<string | null>(null)
// Nombre del lugar marcado (para confirmar que es el correcto)
const placeName = ref<string | null>(null)
const resolving = ref(false)

let controller: AbortController | null = null

// Nombre del punto marcado a mano (clic, chincheta o GPS)
async function describe(point: [number, number]) {
  controller?.abort()
  controller = new AbortController()
  resolving.value = true
  try {
    const place = await reverseGeocode(point, controller.signal)
    placeName.value = place?.label ?? null
    emit('place', place)
  } catch (e) {
    if ((e as Error).name !== 'AbortError') console.warn('Geocodificación inversa', e)
  } finally {
    resolving.value = false
  }
}

function setPoint(coordinates: [number, number], source: LocationSource = 'mapa', accuracy: number | null = null, place?: Place) {
  if (!isInsideMexico(coordinates)) {
    message.value = 'Ese punto está fuera de México. Elige un lugar dentro del país.'
    return
  }
  message.value = null
  model.value = coordinates
  emit('located', source, accuracy)
  if (place) {
    controller?.abort()
    placeName.value = place.label
    emit('place', place)
  } else {
    describe(coordinates)
  }
}

// Zoom según qué tan grande es lo encontrado
const ZOOM: Record<string, number> = { state: 7, county: 10, city: 12, town: 13, village: 14, locality: 14, district: 14, street: 16, house: 17 }

function onSearch(place: Place) {
  setPoint(place.coordinates, 'mapa', null, place)
  if (mainMap) mainMap.flyTo(place.coordinates, ZOOM[place.kind] ?? 13)
  else if (place.bounds && place.kind !== 'house') mapView.value?.fitTo(place.bounds, 30)
  else mapView.value?.flyTo(place.coordinates, undefined, ZOOM[place.kind] ?? 14)
}

function useMyLocation() {
  if (!('geolocation' in navigator)) {
    message.value = 'Tu navegador no permite obtener la ubicación. Busca el lugar o márcalo en el mapa.'
    return
  }
  locating.value = true
  message.value = null
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      locating.value = false
      const point: [number, number] = [coords.longitude, coords.latitude]
      if (!isInsideMexico(point)) {
        message.value = 'Tu ubicación está fuera de México. Busca el lugar o márcalo en el mapa.'
        return
      }
      setPoint(point, 'gps', coords.accuracy)
      if (mainMap) mainMap.flyTo(point, 14)
      else mapView.value?.flyTo(point, undefined, 14)
    },
    () => {
      locating.value = false
      message.value = 'No pudimos obtener tu ubicación. Busca el lugar o márcalo en el mapa.'
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}
</script>

<template>
  <div class="space-y-3">
    <PlaceSearch :near="model" :describedby="describedby" :input-id="inputId" @select="onSearch" />

    <!-- Fuera de la vista del mapa: mini-mapa con la chincheta arrastrable -->
    <div
      v-if="!mainMap"
      class="relative h-64 overflow-hidden rounded-2xl border-2 @xl:h-72 @3xl:h-88"
      :class="error ? 'border-brand-orange' : 'border-ink'"
    >
      <MapView
        ref="mapView"
        detail="states+cities"
        class="absolute inset-0"
        pickable
        :pick-point="model"
        :cluster="false"
        navigation-position="bottom-right"
        @pick="setPoint($event)"
      />
      <p
        v-if="!model"
        class="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full border-2 border-black bg-neon-lime px-3 py-1 text-xs font-bold text-black"
      >
        Toca el mapa para marcar el lugar
      </p>
    </div>

    <!-- Lugar marcado -->
    <div
      class="flex items-start gap-3 rounded-2xl border-2 px-4 py-3 text-sm"
      :class="error ? 'border-brand-orange' : model ? 'border-ink bg-neon-lime/25' : 'border-dashed border-ink/50'"
      role="status"
    >
      <span class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-2 border-black bg-neon-lime text-black" aria-hidden="true">
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      </span>
      <span class="min-w-0 flex-1">
        <template v-if="model">
          <span class="block font-bold">{{ resolving ? 'Buscando el nombre del lugar…' : (placeName ?? 'Lugar marcado') }}</span>
          <span class="block text-xs opacity-70">
            {{ mainMap ? 'Arrastra la chincheta en el mapa para ajustarlo.' : 'Arrastra la chincheta para ajustarlo.' }}
            <span class="tabular-nums">{{ model[1].toFixed(4) }}, {{ model[0].toFixed(4) }}</span>
          </span>
        </template>
        <template v-else>
          <span class="block font-bold">Aún no hay lugar marcado</span>
          <span class="block text-xs opacity-70">
            {{ mainMap ? 'Búscalo arriba o toca el mapa a un lado del formulario.' : 'Búscalo arriba o toca el mapa.' }}
          </span>
        </template>
      </span>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <button type="button" class="btn-hxnf btn-paper btn-sm" :disabled="locating" :aria-describedby="describedby" @click="useMyLocation">
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
        {{ locating ? 'Obteniendo ubicación…' : 'Usar mi ubicación' }}
      </button>
      <p class="text-[11px] opacity-50">Búsqueda: © OpenStreetMap · Photon</p>
    </div>

    <p v-if="message" role="alert" class="text-sm font-semibold text-danger">{{ message }}</p>
  </div>
</template>
