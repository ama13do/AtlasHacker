<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { MapView, type MapPoint } from '@/modules/map'
import { BRAND } from '@/core/config/theme'
import { categoryStyle } from '@testimonies/data/categories'
import { provideMainMapPicker } from '@testimonies/composables/useMainMapPicker'
import { useMapRealtime } from '@testimonies/composables/useMapRealtime'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'
import FeedNotice from '@testimonies/components/FeedNotice.vue'
import StoriesBar from '@testimonies/components/StoriesBar.vue'
import StoryViewer from '@testimonies/components/StoryViewer.vue'
import TestimonyCard from '@testimonies/components/TestimonyCard.vue'
import TestimonySidebar from '@testimonies/components/TestimonySidebar.vue'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'

const MD_BREAKPOINT = 768

const route = useRoute()
const router = useRouter()
const store = useTestimoniesStore()
const {
  items,
  filteredItems,
  status,
  popular,
  stories,
  recent,
  selected,
  selectedId,
  selectedDetail,
  details,
  detailStatus,
  storyIndex,
  selectedState,
  selectedStateName,
} = storeToRefs(store)

const loading = computed(() => status.value === 'idle' || status.value === 'loading')
// Aviso flotante en móvil (en escritorio va en la barra lateral)
const notice = computed(() =>
  status.value === 'error' ? 'error' : status.value === 'ready' && !items.value.length ? 'empty' : null,
)
const currentStory = computed(() => (storyIndex.value !== null ? stories.value[storyIndex.value] : undefined))
const storyDetail = computed(() => (currentStory.value ? (details.value[currentStory.value.id] ?? null) : null))

const mapView = ref<InstanceType<typeof MapView> | null>(null)

// Formulario abierto (ruta hija): en escritorio ocupa la barra lateral; en móvil, toda la pantalla
const formOpen = computed(() => route.name === 'testimony-new')
watch(
  formOpen,
  (open) => {
    if (!open) return
    store.select(null)
    store.closeStory()
  },
  { immediate: true },
)

// El paso de ubicación del formulario pone el mapa grande en modo «marcar»
const picker = provideMainMapPicker((coordinates) =>
  mapView.value?.flyTo(coordinates, { top: 150, bottom: 0, left: 0, right: 0 }),
)
const picking = picker.active
const pickedPoint = picker.point

const points = computed<MapPoint[]>(() => {
  if (picking.value) {
    return pickedPoint.value ? [{ id: 'pick', coordinates: pickedPoint.value, color: BRAND.neonLime }] : []
  }
  return filteredItems.value.map((t) => ({ id: t.id, coordinates: t.coordinates, color: categoryStyle(t.category).color }))
})

function focusTestimony(id: string) {
  store.select(id)
  const testimony = items.value.find((t) => t.id === id)
  if (!testimony) return
  // Deja libre lo que tapa el mapa: historias arriba y, en móvil, el bottom sheet
  const padding =
    window.innerWidth < MD_BREAKPOINT
      ? { top: 140, bottom: window.innerHeight * 0.55, left: 0, right: 0 }
      : { top: 150, bottom: 0, left: 0, right: 0 }
  mapView.value?.flyTo(testimony.coordinates, padding)
}

function onSidebarSelect(id: string | null) {
  if (id) focusTestimony(id)
  else store.select(null)
}

// Esc cierra el testimonio abierto y, después, el estado elegido (el visor de historias maneja su propio Esc)
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || storyIndex.value !== null || formOpen.value) return
  if (selectedId.value) store.select(null)
  else if (selectedState.value) setState(null)
}

// Estado elegido en el mapa ↔ ?estado=MX-JAL (para compartir y para el botón atrás)
function setState(code: string | null) {
  store.select(null)
  router.replace({ query: { ...route.query, estado: code ?? undefined } })
}
watch(
  () => route.query.estado,
  (code) => store.selectState(typeof code === 'string' ? code : null),
  { immediate: true },
)

// Pines en vivo (Supabase Realtime); avisa si se retira el testimonio abierto
const { live, removedNotice } = useMapRealtime()
let noticeTimer: ReturnType<typeof setTimeout> | undefined
watch(removedNotice, (message) => {
  clearTimeout(noticeTimer)
  if (message) noticeTimer = setTimeout(() => (removedNotice.value = null), 4000)
})

function viewOnMap(id: string) {
  store.closeStory()
  focusTestimony(id)
}

// ?t=<id>: abrir un testimonio concreto (p. ej. tras crearlo) y limpiar la URL.
// Se vigila porque el inicio sigue montado mientras el formulario está abierto
function openFromQuery() {
  const id = route.query.t
  if (typeof id !== 'string' || status.value !== 'ready') return
  focusTestimony(id)
  router.replace({ query: { ...route.query, t: undefined } })
}
watch(() => route.query.t, openFromQuery)

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  if (status.value !== 'ready') await store.load()
  openFromQuery()
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <main class="relative h-dvh w-screen overflow-hidden bg-surface md:flex">
    <!-- Barra lateral (escritorio): lista o detalle del testimonio -->
    <TestimonySidebar
      class="hidden w-[26rem] shrink-0 border-r border-fg/10"
      :class="{ 'md:flex': !formOpen }"
      :testimonies="recent"
      :state-name="selectedStateName"
      :status="status"
      :selected="selected"
      :detail="selectedDetail"
      :detail-status="selectedId ? detailStatus[selectedId] : undefined"
      :live="live"
      @select="onSidebarSelect"
      @retry="store.load"
      @retry-detail="selectedId && store.loadDetail(selectedId)"
      @clear-state="setState(null)"
    />

    <!-- Subir testimonio: en el lugar de la barra (escritorio) o a pantalla completa (móvil) -->
    <RouterView v-slot="{ Component }">
      <div
        v-if="Component"
        class="fixed inset-0 z-40 bg-surface md:static md:z-auto md:w-[26rem] md:shrink-0 md:border-r md:border-fg/10"
      >
        <component :is="Component" />
      </div>
    </RouterView>

    <!-- Región del mapa -->
    <div class="relative h-full flex-1">
      <MapView
        ref="mapView"
        class="absolute inset-0"
        :points="points"
        selectable-states
        :selected-state="selectedState"
        @select-state="setState"
        :selected-id="picking ? 'pick' : selectedId"
        :pickable="picking"
        @pick="picker.pick"
        navigation-position="bottom-left"
        :fit-padding="{ top: 150, bottom: 20, left: 20, right: 20 }"
        @select="focusTestimony"
      />

      <!-- Header + historias -->
      <header
        class="pointer-events-none absolute inset-x-0 top-0 z-10 bg-linear-to-b from-surface via-surface/80 to-transparent pt-[max(env(safe-area-inset-top),0.75rem)] pb-8"
      >
        <!-- En escritorio la marca y el tema están en la barra lateral -->
        <div class="pointer-events-auto flex items-center justify-between gap-3 px-4 pb-3 md:hidden">
          <h1 class="text-lg font-semibold tracking-tight">
            AtlasHacker<span class="text-neon-green light:text-fg">_</span>
          </h1>
          <div class="flex items-center gap-3">
            <p class="hidden text-xs text-fg/60 sm:block">Tribunal Popular · FUTURO/001</p>
            <RouterLink
              :to="{ name: 'my-folio' }"
              class="grid size-9 place-items-center rounded-full bg-fg/10 hover:bg-fg/20 focus-visible:outline-2 focus-visible:outline-fg"
              aria-label="Mi folio"
            >
              <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </RouterLink>
            <ThemeToggle />
          </div>
        </div>
        <StoriesBar class="pointer-events-auto" :stories="popular" :loading="loading" @open="store.openStory" />
        <!-- Estado elegido (móvil; en escritorio va en la barra lateral) -->
        <div v-if="selectedStateName" class="pointer-events-auto flex justify-center px-4 pt-2 md:hidden">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-fg px-3 py-1.5 text-sm font-semibold text-surface shadow-lg"
            :aria-label="`Quitar filtro: ${selectedStateName}`"
            @click="setState(null)"
          >
            {{ selectedStateName }} · {{ filteredItems.length }}
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </header>

      <!-- Testimonio seleccionado (móvil: bottom sheet) -->
      <Transition
        enter-from-class="translate-y-full"
        leave-to-class="translate-y-full"
        enter-active-class="transition duration-300 ease-out"
        leave-active-class="transition duration-200 ease-in"
      >
        <TestimonyCard
          v-if="selected"
          :key="selected.id"
          :testimony="selected"
          :detail="selectedDetail"
          :status="detailStatus[selected.id]"
          class="absolute inset-x-0 bottom-0 z-20 md:hidden"
          @close="store.select(null)"
          @retry="store.loadDetail(selected.id)"
        />
      </Transition>

      <!-- Paso de ubicación del formulario (escritorio) -->
      <p
        v-if="picking && !pickedPoint"
        class="pointer-events-none absolute top-36 left-1/2 z-20 -translate-x-1/2 rounded-full bg-fg px-4 py-2 text-sm font-semibold text-surface shadow-lg"
      >
        Toca el mapa para marcar el lugar
      </p>

      <!-- Aviso: el testimonio abierto dejó de ser público -->
      <p
        v-if="removedNotice"
        role="status"
        class="absolute top-36 left-1/2 z-30 -translate-x-1/2 rounded-full bg-fg px-4 py-2 text-sm font-semibold text-surface shadow-lg"
      >
        {{ removedNotice }}
      </p>

      <!-- Sin testimonios o error al cargar (móvil) -->
      <FeedNotice
        v-if="notice"
        :kind="notice"
        class="absolute inset-x-4 bottom-8 z-10 rounded-3xl border border-fg/15 bg-surface/95 shadow-2xl backdrop-blur md:hidden"
        @retry="store.load"
      />

      <!-- Subir testimonio (móvil; en escritorio está en la barra lateral) -->
      <RouterLink
        :to="{ name: 'testimony-new' }"
        class="absolute right-4 bottom-20 z-10 flex items-center gap-2 rounded-full bg-neon-lime px-5 py-3 font-semibold text-black shadow-lg shadow-black/50 transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg md:hidden"
        :class="{ hidden: selected || notice === 'empty' }"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Subir testimonio
      </RouterLink>
    </div>

    <StoryViewer
      v-if="storyIndex !== null"
      :stories="stories"
      :index="storyIndex"
      :detail="storyDetail"
      :detail-failed="!!currentStory && detailStatus[currentStory.id] === 'error'"
      @update:index="store.openStory"
      @close="store.closeStory"
      @view-on-map="viewOnMap"
    />
  </main>
</template>

<style scoped>
/* En móvil se usa pinch-zoom; los botones de zoom solo en escritorio */
@media (width < 48rem) {
  :deep(.maplibregl-ctrl-bottom-left .maplibregl-ctrl-group) {
    display: none;
  }
}
</style>
