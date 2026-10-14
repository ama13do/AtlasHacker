<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { searchPlaces, type Place } from '@/modules/map'

// Buscador de lugares con autocompletado (combobox ARIA): escribe, flechas para moverse, Enter para elegir
const props = defineProps<{ near?: [number, number] | null; describedby?: string; inputId?: string }>()
const emit = defineEmits<{ select: [place: Place] }>()

const DEBOUNCE = 300
const MIN_CHARS = 3

const id = props.inputId ?? `place-search-${Math.random().toString(36).slice(2, 8)}`
const query = ref('')
const results = ref<Place[]>([])
const open = ref(false)
const active = ref(-1)
const loading = ref(false)
const failed = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | null = null
// Tras elegir un resultado no se vuelve a buscar su propio texto
let skipNext = false

watch(query, (value) => {
  clearTimeout(timer)
  controller?.abort()
  if (skipNext) {
    skipNext = false
    return
  }
  const q = value.trim()
  if (q.length < MIN_CHARS) {
    results.value = []
    open.value = false
    loading.value = false
    return
  }
  loading.value = true
  timer = setTimeout(() => run(q), DEBOUNCE)
})

async function run(q: string) {
  controller = new AbortController()
  failed.value = false
  try {
    results.value = await searchPlaces(q, controller.signal, props.near)
    active.value = results.value.length ? 0 : -1
    open.value = true
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    console.warn('Búsqueda de lugares', e)
    failed.value = true
    results.value = []
    open.value = true
  } finally {
    loading.value = false
  }
}

function choose(place: Place) {
  skipNext = true
  query.value = place.label
  open.value = false
  results.value = []
  emit('select', place)
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value || !results.value.length) {
    if (e.key === 'ArrowDown' && results.value.length) open.value = true
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = (active.value + 1) % results.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = (active.value - 1 + results.value.length) % results.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const place = results.value[active.value]
    if (place) choose(place)
  } else if (e.key === 'Escape') {
    e.stopPropagation()
    open.value = false
  }
}

// Se cierra al salir del campo (con margen para que el clic en un resultado llegue)
function onBlur() {
  setTimeout(() => (open.value = false), 150)
}

const activeId = computed(() => (open.value && active.value >= 0 ? `${id}-opt-${active.value}` : undefined))

const KIND_LABELS: Record<string, string> = {
  city: 'Ciudad',
  town: 'Pueblo',
  village: 'Localidad',
  locality: 'Localidad',
  district: 'Colonia',
  county: 'Municipio',
  state: 'Estado',
  street: 'Calle',
  house: 'Lugar',
}

onBeforeUnmount(() => {
  clearTimeout(timer)
  controller?.abort()
})
</script>

<template>
  <div class="relative">
    <svg class="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
    <input
      :id="id"
      v-model="query"
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      class="field-input pr-10 pl-11"
      placeholder="Busca tu comunidad, colonia o municipio"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="activeId"
      :aria-describedby="describedby"
      @keydown="onKeydown"
      @focus="results.length && (open = true)"
      @blur="onBlur"
    />
    <span v-if="loading" class="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-fg/25 border-t-fg" aria-hidden="true" />

    <ul
      v-show="open"
      :id="`${id}-list`"
      role="listbox"
      class="thin-scroll absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border-2 border-ink bg-card p-1.5 shadow-brut"
      aria-label="Lugares encontrados"
    >
      <li
        v-for="(place, i) in results"
        :id="`${id}-opt-${i}`"
        :key="place.id + i"
        role="option"
        :aria-selected="i === active"
        class="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2"
        :class="i === active ? 'bg-neon-lime text-black' : 'hover:bg-fg/5'"
        @mousedown.prevent="choose(place)"
        @mousemove="active = i"
      >
        <svg viewBox="0 0 24 24" class="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-bold">{{ place.name }}</span>
          <span v-if="place.detail" class="block truncate text-xs opacity-70">{{ place.detail }}</span>
        </span>
        <span class="shrink-0 rounded-full border border-current px-1.5 text-[10px] font-bold uppercase opacity-60">{{ KIND_LABELS[place.kind] ?? 'Lugar' }}</span>
      </li>
      <li v-if="!results.length && !failed" class="px-3 py-2 text-sm opacity-70" role="presentation">Sin resultados en México. Prueba con otro nombre o marca el punto en el mapa.</li>
      <li v-if="failed" class="px-3 py-2 text-sm text-danger" role="presentation">La búsqueda no está disponible ahora. Marca el punto en el mapa.</li>
    </ul>
  </div>
</template>
