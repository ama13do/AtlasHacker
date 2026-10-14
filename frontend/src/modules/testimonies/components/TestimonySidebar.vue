<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ACCENT_CLASSES, type MapInfo } from '@testimonies/data/maps'
import { useTestimoniesStore, type LoadStatus } from '@testimonies/stores/testimonies'
import type { TestimonyDetail as Detail, TestimonySummary } from '@testimonies/types/testimony'
import CategoryFilters from '@testimonies/components/CategoryFilters.vue'
import FeedNotice from '@testimonies/components/FeedNotice.vue'
import TestimonyDetail from '@testimonies/components/TestimonyDetail.vue'
import TestimonyListItem from '@testimonies/components/TestimonyListItem.vue'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'

const props = defineProps<{
  map: MapInfo
  testimonies: TestimonySummary[]
  // Total del mapa sin filtros (para distinguir «vacío» de «sin resultados»)
  total: number
  status: LoadStatus
  selected: TestimonySummary | null
  detail: Detail | null
  detailStatus?: LoadStatus
  live?: boolean
  // Estado elegido en el mapa (filtra la lista)
  stateName?: string | null
  openComments?: boolean
}>()
const emit = defineEmits<{
  select: [id: string | null]
  retry: []
  retryDetail: []
  clearState: []
  help: []
  'comments-focused': []
}>()

const store = useTestimoniesStore()
const { query, categoryFilter, sortBy, hoveredId } = storeToRefs(store)

// Anterior / siguiente dentro de la lista visible
const position = computed(() => (props.selected ? props.testimonies.findIndex((t) => t.id === props.selected!.id) : -1))
const previous = computed(() => (position.value > 0 ? props.testimonies[position.value - 1] : null))
const next = computed(() => (position.value >= 0 && position.value < props.testimonies.length - 1 ? props.testimonies[position.value + 1] : null))

const scroller = ref<HTMLElement | null>(null)
const detailView = ref<InstanceType<typeof TestimonyDetail> | null>(null)
const list = ref<HTMLElement | null>(null)

// Al abrir un testimonio: arriba y foco en su título (a menos que se hayan pedido comentarios); al volver: foco en su fila de la lista
watch(
  () => props.selected?.id,
  async (id, previousId) => {
    if (props.openComments) return
    scroller.value?.scrollTo({ top: 0 })
    await nextTick()
    if (id) detailView.value?.focusTitle()
    else if (previousId) list.value?.querySelector<HTMLElement>(`[data-id="${previousId}"] button`)?.focus()
  },
)

watch(
  [() => props.openComments, () => props.detail],
  ([openNeeded, detailVal]) => {
    if (openNeeded && detailVal) {
      nextTick(() => {
        scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
      })
    }
  },
)

function focusComments() {
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
  detailView.value?.focusComments()
}

defineExpose({
  focusComments,
})
</script>

<template>
  <aside class="flex h-full flex-col bg-surface" aria-label="Testimonios">
    <header class="space-y-3 border-b-2 border-ink px-5 pt-4 pb-5">
      <div class="flex items-center gap-2">
        <RouterLink
          :to="{ name: 'home' }"
          class="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-card px-3 py-1 text-xs font-bold uppercase shadow-brut-sm transition hover:-translate-y-px hover:bg-neon-lime hover:text-black focus-visible:outline-3 focus-visible:outline-brand-blue"
        >
          <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Mapas
        </RouterLink>
        <button
          type="button"
          aria-label="¿Cómo funciona el mapa?"
          class="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap uppercase transition hover:bg-neon-lime hover:text-black focus-visible:outline-3 focus-visible:outline-brand-blue"
          @click="emit('help')"
        >
          <span class="grid size-4 place-items-center rounded-full bg-black text-[10px] text-neon-lime dark:bg-white dark:text-black" aria-hidden="true">?</span>
          Ayuda
        </button>
        <RouterLink
          :to="{ name: 'my-folio' }"
          class="rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap uppercase transition hover:bg-brand-pink hover:text-black focus-visible:outline-3 focus-visible:outline-brand-blue"
        >
          Mi folio
        </RouterLink>
        <ThemeToggle />
      </div>

      <div>
        <p class="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-wider uppercase">
          <span class="chip bg-black px-2 text-[11px] text-white dark:bg-white dark:text-black">{{ map.code }}</span>
          <span>Tribunal Popular</span>
          <span v-if="live" class="inline-flex items-center gap-1 text-neon-green dark:text-neon-green" title="Los testimonios nuevos aparecen sin recargar">
            <span class="size-2 animate-pulse rounded-full border border-black bg-neon-green" aria-hidden="true" />
            <span class="text-fg">En vivo</span>
          </span>
        </p>
        <h1 class="mt-3 text-2xl leading-[1.2] font-black uppercase">
          <span class="hl-box hl-wrap" :class="ACCENT_CLASSES[map.accent].hl" style="--hl-rot: -1deg">{{ map.title }}</span>
        </h1>
      </div>
    </header>

    <div ref="scroller" class="thin-scroll flex-1 overflow-y-auto">
      <!-- Detalle del testimonio seleccionado -->
      <div v-if="selected" class="px-5 py-4">
        <nav class="mb-4 flex items-center gap-2" aria-label="Navegar testimonios">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-card px-3 py-1 text-xs font-bold uppercase shadow-brut-sm transition hover:-translate-y-px hover:bg-neon-lime hover:text-black focus-visible:outline-3 focus-visible:outline-brand-blue"
            @click="emit('select', null)"
          >
            <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Cerrar
          </button>
          <span v-if="position >= 0" class="ml-auto text-xs font-bold opacity-60 tabular-nums">{{ position + 1 }} de {{ testimonies.length }}</span>
          <button type="button" class="icon-btn size-8" :class="{ 'ml-auto': position < 0 }" :disabled="!previous" aria-label="Testimonio anterior" @click="previous && emit('select', previous.id)">
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" class="icon-btn size-8" :disabled="!next" aria-label="Testimonio siguiente" @click="next && emit('select', next.id)">
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </nav>
        <TestimonyDetail
          ref="detailView"
          :key="selected.id"
          :testimony="selected"
          :detail="detail"
          :status="detailStatus"
          :open-comments="openComments"
          @retry="emit('retryDetail')"
          @comments-focused="emit('comments-focused')"
        />
      </div>

      <template v-else>
        <!-- Buscar y filtrar -->
        <div class="space-y-3 px-5 pt-4">
          <label class="relative block">
            <span class="sr-only">Buscar testimonios</span>
            <svg class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              v-model="query"
              type="search"
              placeholder="Buscar por título, lugar o folio"
              class="w-full rounded-full border-2 border-ink bg-card py-2.5 pr-4 pl-11 text-sm font-semibold placeholder:opacity-50 shadow-brut-sm transition-shadow focus:shadow-[3px_3px_0_0_var(--color-neon-green)] focus:outline-none"
            />
          </label>
          <CategoryFilters />
          <button
            v-if="stateName"
            type="button"
            class="chip bg-neon-lime px-3 py-1 text-black shadow-[2px_2px_0_0_#000]"
            :aria-label="`Quitar filtro: ${stateName}`"
            @click="emit('clearState')"
          >
            {{ stateName }} <span aria-hidden="true">×</span>
          </button>
        </div>

        <!-- Cargando -->
        <ul v-if="status === 'loading' || status === 'idle'" class="space-y-3 px-5 py-4" aria-label="Cargando testimonios">
          <li v-for="n in 5" :key="n" class="flex gap-3 rounded-[20px] border-2 border-ink/20 p-3" aria-hidden="true">
            <span class="size-10 shrink-0 animate-pulse rounded-full bg-fg/10" />
            <span class="flex-1 space-y-2 pt-1">
              <span class="block h-3 w-4/5 animate-pulse rounded-full bg-fg/10" />
              <span class="block h-3 w-1/2 animate-pulse rounded-full bg-fg/10" />
            </span>
          </li>
        </ul>

        <FeedNotice v-else-if="status === 'error'" kind="error" class="mt-6" @retry="emit('retry')" />
        <FeedNotice v-else-if="!total" kind="empty" class="mt-6" />

        <!-- Sin resultados con los filtros -->
        <div v-else-if="!testimonies.length" class="flex flex-col items-center gap-3 px-6 py-10 text-center" role="status">
          <p class="font-bold">
            Nada por aquí<template v-if="stateName"> en {{ stateName }}</template>
          </p>
          <p class="text-sm opacity-70">Prueba con otra búsqueda o categoría.</p>
          <div class="flex flex-wrap justify-center gap-2">
            <button v-if="query || categoryFilter.length" type="button" class="btn-hxnf btn-paper btn-sm" @click="store.clearFilters()">Quitar filtros</button>
            <button v-if="stateName" type="button" class="btn-hxnf btn-paper btn-sm" @click="emit('clearState')">Ver todo México</button>
          </div>
        </div>

        <!-- Lista -->
        <div v-else class="px-5 py-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-black uppercase">
              Testimonios
              <span class="font-wide">{{ testimonies.length }}</span><span v-if="testimonies.length !== total" class="text-xs font-bold opacity-60"> de {{ total }}</span>
            </h2>
            <div class="flex gap-1" role="group" aria-label="Ordenar">
              <button type="button" class="chip-toggle" :aria-pressed="sortBy === 'recientes'" @click="sortBy = 'recientes'">Recientes</button>
              <button type="button" class="chip-toggle" :aria-pressed="sortBy === 'reacciones'" @click="sortBy = 'reacciones'">Más reacciones</button>
            </div>
          </div>
          <p class="mb-3 text-xs opacity-60">Toca uno para abrirlo y verlo en el mapa.</p>
          <ul ref="list" class="space-y-3 pr-1.5 pb-2">
            <li v-for="t in testimonies" :key="t.id" :data-id="t.id">
              <TestimonyListItem :testimony="t" :active="hoveredId === t.id" @select="emit('select', $event)" @hover="hoveredId = $event" />
            </li>
          </ul>
        </div>
      </template>
    </div>

  </aside>
</template>
