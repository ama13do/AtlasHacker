<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { MapView, type MapPoint } from '@/modules/map'
import { TOPIC_META } from '@testimonies/data/topics'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'
import StoriesBar from '@testimonies/components/StoriesBar.vue'
import StoryViewer from '@testimonies/components/StoryViewer.vue'
import TestimonyCard from '@testimonies/components/TestimonyCard.vue'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'

const MD_BREAKPOINT = 768

const route = useRoute()
const router = useRouter()
const store = useTestimoniesStore()
const { items, popular, selected, selectedId, storyIndex } = storeToRefs(store)

const mapView = ref<InstanceType<typeof MapView> | null>(null)

const points = computed<MapPoint[]>(() =>
  items.value.map((t) => ({ id: t.id, coordinates: t.coordinates, color: TOPIC_META[t.topic].color })),
)

function focusTestimony(id: string) {
  store.select(id)
  const testimony = items.value.find((t) => t.id === id)
  if (!testimony) return
  // Deja libre la zona que tapa la tarjeta: abajo en móvil, a la izquierda en escritorio
  const padding =
    window.innerWidth < MD_BREAKPOINT
      ? { top: 140, bottom: window.innerHeight * 0.55, left: 0, right: 0 }
      : { top: 0, bottom: 0, left: 420, right: 0 }
  mapView.value?.flyTo(testimony.coordinates, padding)
}

function viewOnMap(id: string) {
  store.closeStory()
  focusTestimony(id)
}

onMounted(async () => {
  if (!items.value.length) await store.load()

  // ?t=<id>: abrir un testimonio concreto (p. ej. tras crearlo) y limpiar la URL
  const id = route.query.t
  if (typeof id === 'string') {
    focusTestimony(id)
    router.replace({ query: {} })
  }
})
</script>

<template>
  <main class="relative h-dvh w-screen overflow-hidden bg-surface">
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
      <div class="pointer-events-auto flex items-center justify-between gap-3 px-4 pb-3">
        <h1 class="text-lg font-semibold tracking-tight">
          AtlasHacker<span class="text-neon-green light:text-fg">_</span>
        </h1>
        <div class="flex items-center gap-3">
          <p class="hidden text-xs text-fg/60 sm:block">Tribunal Popular · FUTURO/001</p>
          <ThemeToggle />
        </div>
      </div>
      <StoriesBar class="pointer-events-auto" :stories="popular" @open="store.openStory" />
    </header>

    <!-- Tarjeta del testimonio seleccionado -->
    <Transition
      enter-from-class="translate-y-full md:translate-y-0 md:-translate-x-[110%]"
      leave-to-class="translate-y-full md:translate-y-0 md:-translate-x-[110%]"
      enter-active-class="transition duration-300 ease-out"
      leave-active-class="transition duration-200 ease-in"
    >
      <TestimonyCard
        v-if="selected"
        :key="selected.id"
        :testimony="selected"
        class="absolute inset-x-0 bottom-0 z-20 md:inset-x-auto md:top-44 md:bottom-24 md:left-4 md:w-96"
        @close="store.select(null)"
      />
    </Transition>

    <!-- Subir testimonio -->
    <RouterLink
      :to="{ name: 'testimony-new' }"
      class="absolute right-4 bottom-20 z-10 flex md:bottom-12 items-center gap-2 rounded-full bg-neon-lime px-5 py-3 font-semibold text-black shadow-lg shadow-black/50 transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
      :class="{ 'max-md:hidden': selected }"
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      Subir testimonio
    </RouterLink>

    <StoryViewer
      v-if="storyIndex !== null"
      :stories="popular"
      :index="storyIndex"
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
