<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { MapView, type MapPoint } from '@/modules/map'
import { categoryStyle } from '@testimonies/data/categories'
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
const { items, status, popular, recent, selected, selectedId, selectedDetail, details, detailStatus, storyIndex } =
  storeToRefs(store)

const loading = computed(() => status.value === 'idle' || status.value === 'loading')
// Aviso flotante en móvil (en escritorio va en la barra lateral)
const notice = computed(() =>
  status.value === 'error' ? 'error' : status.value === 'ready' && !items.value.length ? 'empty' : null,
)
const currentStory = computed(() => (storyIndex.value !== null ? popular.value[storyIndex.value] : undefined))
const storyDetail = computed(() => (currentStory.value ? (details.value[currentStory.value.id] ?? null) : null))

const mapView = ref<InstanceType<typeof MapView> | null>(null)

const points = computed<MapPoint[]>(() =>
  items.value.map((t) => ({ id: t.id, coordinates: t.coordinates, color: categoryStyle(t.category).color })),
)

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

// Esc cierra el testimonio abierto (el visor de historias maneja su propio Esc)
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && selectedId.value && storyIndex.value === null) store.select(null)
}

function viewOnMap(id: string) {
  store.closeStory()
  focusTestimony(id)
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  if (status.value !== 'ready') await store.load()

  // ?t=<id>: abrir un testimonio concreto (p. ej. tras crearlo) y limpiar la URL
  const id = route.query.t
  if (typeof id === 'string') {
    focusTestimony(id)
    router.replace({ query: {} })
  }
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <main class="relative h-dvh w-screen overflow-hidden bg-surface md:flex">
    <!-- Barra lateral (escritorio): lista o detalle del testimonio -->
    <TestimonySidebar
      class="hidden w-[26rem] shrink-0 border-r border-fg/10 md:flex"
      :testimonies="recent"
      :status="status"
      :selected="selected"
      :detail="selectedDetail"
      :detail-status="selectedId ? detailStatus[selectedId] : undefined"
      @select="onSidebarSelect"
      @retry="store.load"
      @retry-detail="selectedId && store.loadDetail(selectedId)"
    />

    <!-- Región del mapa -->
    <div class="relative h-full flex-1">
      <MapView
        ref="mapView"
        class="absolute inset-0"
        :points="points"
        :selected-id="selectedId"
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
            <ThemeToggle />
          </div>
        </div>
        <StoriesBar class="pointer-events-auto" :stories="popular" :loading="loading" @open="store.openStory" />
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
      :stories="popular"
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
