<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { MapView, type MapPoint } from '@/modules/map'
import { categoryIconSvg, categoryStyle } from '@testimonies/data/categories'
import { ACCENT_CLASSES, codeFromSlug, DEFAULT_MAP_CODE, FALLBACK_DOSSIER, mapInfo } from '@testimonies/data/maps'
import { provideMainMapPicker } from '@testimonies/composables/useMainMapPicker'
import { useMapRealtime } from '@testimonies/composables/useMapRealtime'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'
import CategoryFilters from '@testimonies/components/CategoryFilters.vue'
import MapHelp from '@testimonies/components/MapHelp.vue'
import MediaReel from '@testimonies/components/media/MediaReel.vue'
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
const categoriesStore = useCategoriesStore()
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
  hoveredId,
  categoryFilter,
  query,
} = storeToRefs(store)

// --- Entrada: tarjeta con el título mientras el mapa vuela hacia México ---
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const showIntro = ref(!reducedMotion)
setTimeout(() => (showIntro.value = false), 1700)

// --- Ayuda «¿Cómo funciona?» (y una invitación la primera vez) ---
const HELP_SEEN_KEY = 'atlashacker:map-help-seen'
const helpOpen = ref(false)
const helpHint = ref(false)
try {
  helpHint.value = !localStorage.getItem(HELP_SEEN_KEY)
} catch {
  helpHint.value = false
}
function openHelp() {
  helpOpen.value = true
  dismissHelpHint()
}
function dismissHelpHint() {
  helpHint.value = false
  try {
    localStorage.setItem(HELP_SEEN_KEY, '1')
  } catch {
    // Sin almacenamiento: se volverá a mostrar
  }
}

// --- Qué mapa (expediente) es: /mapas/futuro-001 → FUTURO/001 ---
const dossiers = computed(() => categoriesStore.config?.dossiers ?? [])
const code = computed(() => codeFromSlug(String(route.params.mapa ?? ''), dossiers.value))
const map = computed(() => {
  const index = dossiers.value.findIndex((d) => d.code === code.value)
  const dossier = dossiers.value[index] ?? (code.value === DEFAULT_MAP_CODE ? FALLBACK_DOSSIER : { ...FALLBACK_DOSSIER, code: code.value, title: code.value })
  return mapInfo(dossier, Math.max(index, 0))
})

watch(code, (value) => store.useDossier(value), { immediate: true })

// Un mapa que no existe (o ya no está activo): a la portada
watch(
  dossiers,
  (list) => {
    if (list.length && !list.some((d) => d.code === code.value)) router.replace({ name: 'home' })
  },
  { immediate: true },
)

const loading = computed(() => status.value === 'idle' || status.value === 'loading')
// Aviso flotante en móvil (en escritorio va en la barra lateral)
const notice = computed(() =>
  status.value === 'error' ? 'error' : status.value === 'ready' && !items.value.length ? 'empty' : null,
)
const currentStory = computed(() => (storyIndex.value !== null ? stories.value[storyIndex.value] : undefined))
const storyDetail = computed(() => (currentStory.value ? (details.value[currentStory.value.id] ?? null) : null))

const mapView = ref<InstanceType<typeof MapView> | null>(null)

// Lista en móvil (hoja inferior)
const mobileList = ref(false)

// --- Formulario (ruta hija): panel a un lado del mapa en escritorio; hoja inferior en móvil ---
const formOpen = computed(() => route.name === 'testimony-new')
watch(
  formOpen,
  (open) => {
    if (!open) return
    store.select(null)
    store.closeStory()
    mobileList.value = false
  },
  { immediate: true },
)

const isMobile = ref(window.innerWidth < MD_BREAKPOINT)
const onResize = () => (isMobile.value = window.innerWidth < MD_BREAKPOINT)

// Hoja del formulario en móvil: alta para escribir; baja mientras se marca el lugar (el mapa queda arriba)
const sheetExpanded = ref(true)

// El paso de ubicación pone el mapa en modo «marcar»: clic o arrastrar la chincheta
const picker = provideMainMapPicker((coordinates, zoom) => mapView.value?.flyTo(coordinates, pickPadding(), zoom))
const picking = picker.active
const pickedPoint = picker.point
watch(picking, (on) => (sheetExpanded.value = !on))

function pickPadding() {
  return isMobile.value ? { top: 80, bottom: window.innerHeight * 0.5, left: 0, right: 0 } : { top: 140, bottom: 40, left: 40, right: 40 }
}

// --- Pines ---
const points = computed<MapPoint[]>(() =>
  filteredItems.value.map((t) => {
    const style = categoryStyle(t.category)
    return { id: t.id, coordinates: t.coordinates, color: style.color, ink: style.ink, label: t.title, icon: categoryIconSvg(t.category) }
  }),
)

function focusTestimony(id: string) {
  const testimony = items.value.find((t) => t.id === id)
  if (!testimony) return

  // Si el testimonio pertenece a otro estado y hay un estado filtrado en la vista, se limpia el filtro
  if (selectedState.value) {
    const st = store.stateOf(testimony)
    if (st !== selectedState.value) {
      setState(null)
    }
  }

  // Si está oculto por filtros de categoría o búsqueda, se limpian para que se dibuje su pin
  if (categoryFilter.value.length && !categoryFilter.value.includes(testimony.category)) {
    store.clearFilters()
  }
  if (query.value) {
    store.clearFilters()
  }

  store.select(id)
  // Deja libre lo que tapa el mapa: historias arriba y, en móvil, la tarjeta inferior
  const padding = isMobile.value
    ? { top: 190, bottom: window.innerHeight * 0.6, left: 0, right: 0 }
    : { top: 150, bottom: 0, left: 0, right: 0 }
  mapView.value?.flyTo(testimony.coordinates, padding, 9)
}

function onSidebarSelect(id: string | null) {
  mobileList.value = false
  if (id) focusTestimony(id)
  else store.select(null)
}

// Esc cierra el testimonio abierto y, después, el estado elegido (el visor de historias maneja su propio Esc)
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || storyIndex.value !== null || formOpen.value) return
  if (mobileList.value) mobileList.value = false
  else if (selectedId.value) store.select(null)
  else if (selectedState.value) setState(null)
}

// Estado elegido en el mapa ↔ ?estado=MX-JAL (para compartir y para el botón atrás)
function setState(stateCode: string | null) {
  store.select(null)
  router.replace({ query: { ...route.query, estado: stateCode ?? undefined } })
}
watch(
  () => route.query.estado,
  (stateCode) => store.selectState(typeof stateCode === 'string' ? stateCode : null),
  { immediate: true },
)

// Pines en vivo (Supabase Realtime); avisa si se retira el testimonio abierto
const { live, removedNotice } = useMapRealtime()
let noticeTimer: ReturnType<typeof setTimeout> | undefined
watch(removedNotice, (message) => {
  clearTimeout(noticeTimer)
  if (message) noticeTimer = setTimeout(() => (removedNotice.value = null), 4000)
})

const pendingCommentsFocus = ref<string | null>(null)

function viewOnMap(id: string, openComments = false) {
  store.closeStory()
  mobileList.value = false
  if (openComments) {
    pendingCommentsFocus.value = id
  }
  focusTestimony(id)
}

// ?t=<id>: abrir un testimonio concreto (p. ej. tras crearlo) y limpiar la URL.
// Se vigila porque el mapa sigue montado mientras el formulario está abierto
function openFromQuery() {
  const id = route.query.t
  if (typeof id !== 'string' || status.value !== 'ready') return
  focusTestimony(id)
  router.replace({ query: { ...route.query, t: undefined } })
}
watch(() => route.query.t, openFromQuery)
watch(status, (s) => s === 'ready' && openFromQuery())

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
  openFromQuery()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <main class="relative flex h-dvh w-screen overflow-hidden bg-surface">
    <!-- Lista o detalle (escritorio). Con el formulario abierto se oculta salvo en pantallas muy anchas -->
    <TestimonySidebar
      ref="sidebarRef"
      class="tm-slide-in w-[25rem] shrink-0 border-r-2 border-ink"
      :class="formOpen ? 'hidden 2xl:flex' : 'hidden md:flex'"
      :map="map"
      :testimonies="recent"
      :total="items.length"
      :state-name="selectedStateName"
      :status="status"
      :selected="selected"
      :detail="selectedDetail"
      :detail-status="selectedId ? detailStatus[selectedId] : undefined"
      :live="live"
      :open-comments="pendingCommentsFocus === selected?.id"
      @select="onSidebarSelect"
      @retry="store.load"
      @retry-detail="selectedId && store.loadDetail(selectedId)"
      @clear-state="setState(null)"
      @help="openHelp"
      @comments-focused="pendingCommentsFocus = null"
    />

    <!-- Región del mapa -->
    <div class="relative h-full min-w-0 flex-1">
      <MapView
        ref="mapView"
        class="absolute inset-0"
        :points="points"
        selectable-states
        :selected-state="selectedState"
        :selected-id="picking ? null : selectedId"
        :pickable="picking"
        :pick-point="pickedPoint"
        detail="states+cities"
        navigation-position="bottom-right"
        :fit-padding="{ top: 150, bottom: 30, left: 30, right: 30 }"
        :hovered-id="hoveredId"
        intro
        @hover="hoveredId = $event"
        @select-state="setState"
        @pick="picker.pick"
        @select="focusTestimony"
      />

      <!-- Header (móvil) + historias -->
      <header
        class="pointer-events-none absolute inset-x-0 top-0 z-10 bg-linear-to-b from-surface via-surface/85 to-transparent pt-[max(env(safe-area-inset-top),0.75rem)] pb-6"
      >
        <div v-if="!formOpen" class="pointer-events-auto flex items-center gap-2 px-3 pb-2 md:hidden">
          <RouterLink :to="{ name: 'home' }" class="icon-btn size-9" aria-label="Volver a los mapas">
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
          </RouterLink>
          <p class="min-w-0 flex-1">
            <span class="hl-box text-sm font-black uppercase" :class="ACCENT_CLASSES[map.accent].hl" style="--hl-rot: -1deg">
              <span class="block max-w-[52vw] truncate">{{ map.title }}</span>
            </span>
          </p>
          <button type="button" class="icon-btn size-9 text-base font-black" aria-label="¿Cómo funciona el mapa?" @click="openHelp">?</button>
          <RouterLink :to="{ name: 'my-folio' }" class="icon-btn size-9" aria-label="Mi folio">
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </RouterLink>
          <ThemeToggle class="size-9" />
        </div>

        <StoriesBar v-if="!picking" class="pointer-events-auto" :stories="popular" :loading="loading" @open="store.openStory" />

        <!-- Filtros (móvil; en escritorio están en la barra lateral) -->
        <div v-if="!picking && !formOpen && !selected" class="pointer-events-auto mt-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:hidden">
          <CategoryFilters scroll />
        </div>

        <!-- Estado elegido (móvil; en escritorio va en la barra lateral) -->
        <div v-if="selectedStateName && !picking" class="pointer-events-auto flex justify-center px-4 pt-2 md:hidden">
          <button
            type="button"
            class="chip bg-neon-lime px-3 py-1.5 text-sm text-black shadow-[2px_2px_0_0_#000]"
            :aria-label="`Quitar filtro: ${selectedStateName}`"
            @click="setState(null)"
          >
            {{ selectedStateName }} · {{ filteredItems.length }}
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </header>

      <!-- Entrada: título del mapa mientras la cámara llega a México -->
      <Transition leave-active-class="transition duration-500 ease-in" leave-to-class="opacity-0 scale-110">
        <div v-if="showIntro" class="pointer-events-none absolute inset-0 z-30 grid place-items-center" aria-hidden="true">
          <p class="tm-intro text-center text-3xl leading-tight font-black uppercase md:text-5xl">
            <span class="hl-box hl-wrap" :class="ACCENT_CLASSES[map.accent].hl" style="--hl-rot: -2deg; --hl-delay: 0.05s">{{ map.title }}</span>
            <span class="mt-3 block text-sm font-bold tracking-widest opacity-70 md:text-base">{{ map.kicker }} · {{ map.code }}</span>
          </p>
        </div>
      </Transition>

      <!-- Testimonio abierto (escritorio): recordatorio arriba del mapa -->
      <Transition enter-from-class="-translate-y-4 opacity-0" enter-active-class="transition duration-300" leave-to-class="opacity-0" leave-active-class="transition duration-150">
        <div
          v-if="selected && !formOpen && !picking"
          class="absolute top-[9.5rem] left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-full border-2 border-black bg-white py-1 pr-1 pl-3 text-sm font-bold text-black shadow-[3px_3px_0_0_#000] md:flex"
        >
          <span class="size-2.5 animate-pulse rounded-full bg-black" aria-hidden="true" />
          <span class="max-w-[22rem] truncate">Abierto: {{ selected.title }}</span>
          <button type="button" class="grid size-7 place-items-center rounded-full bg-black text-white hover:bg-neon-lime hover:text-black" aria-label="Cerrar testimonio" @click="store.select(null)">
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </Transition>

      <!-- Carrete de evidencias del testimonio abierto (escritorio) -->
      <Transition enter-from-class="translate-y-full opacity-0" enter-active-class="transition duration-300 ease-out" leave-to-class="translate-y-full opacity-0" leave-active-class="transition duration-200">
        <section
          v-if="selected && selectedDetail?.files.length && !formOpen"
          class="absolute inset-x-6 bottom-24 z-20 hidden rounded-[22px] border-2 border-ink bg-card/95 px-4 pt-3 pb-2 shadow-brut-lg backdrop-blur md:block lg:right-24"
          aria-label="Evidencias del testimonio abierto"
        >
          <p class="mb-1 flex items-center gap-2 text-xs font-black uppercase">
            Evidencias · {{ selectedDetail.files.length }}
            <span class="font-semibold normal-case opacity-60">Toca una para verla en grande</span>
          </p>
          <MediaReel :files="selectedDetail.files" :title="selected.title" />
        </section>
      </Transition>

      <!-- Primera visita: invitación a la ayuda -->
      <div
        v-if="helpHint && !showIntro && !formOpen && !selected"
        class="absolute bottom-40 left-4 z-20 flex max-w-xs items-center gap-2 rounded-2xl border-2 border-black bg-white p-2 pl-3 text-sm font-bold text-black shadow-[3px_3px_0_0_#000] md:bottom-24"
      >
        <button type="button" class="text-left underline decoration-2 underline-offset-2" @click="openHelp">¿Primera vez aquí? Mira cómo funciona el mapa</button>
        <button type="button" class="grid size-7 shrink-0 place-items-center rounded-full bg-black text-white" aria-label="Cerrar sugerencia" @click="dismissHelpHint">
          <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <!-- Marcando el lugar del formulario -->
      <p
        v-if="picking"
        class="pointer-events-none absolute top-[max(env(safe-area-inset-top),1rem)] left-1/2 z-20 w-max max-w-[92%] -translate-x-1/2 rounded-full border-2 border-black bg-neon-lime px-4 py-2 text-center text-sm font-bold text-black shadow-[3px_3px_0_0_#000] md:top-6"
      >
        {{ pickedPoint ? 'Arrastra la chincheta para ajustar el lugar' : 'Toca el mapa o busca el lugar en el formulario' }}
      </p>

      <!-- Aviso: el testimonio abierto dejó de ser público -->
      <p
        v-if="removedNotice"
        role="status"
        class="absolute top-36 left-1/2 z-30 -translate-x-1/2 rounded-full border-2 border-black bg-brand-orange px-4 py-2 text-sm font-bold text-black shadow-[3px_3px_0_0_#000]"
      >
        {{ removedNotice }}
      </p>

      <!-- Testimonio seleccionado (móvil: tarjeta inferior) -->
      <Transition
        enter-from-class="translate-y-full"
        leave-to-class="translate-y-full"
        enter-active-class="transition duration-300 ease-out"
        leave-active-class="transition duration-200 ease-in"
      >
        <TestimonyCard
          v-if="selected && !formOpen"
          ref="mobileCardRef"
          :key="selected.id"
          :testimony="selected"
          :detail="selectedDetail"
          :status="detailStatus[selected.id]"
          :open-comments="pendingCommentsFocus === selected.id"
          class="absolute inset-x-0 bottom-0 z-20 md:hidden"
          @close="store.select(null)"
          @retry="store.loadDetail(selected.id)"
          @comments-focused="pendingCommentsFocus = null"
        />
      </Transition>

      <!-- Sin testimonios o error al cargar (móvil) -->
      <FeedNotice
        v-if="notice && !formOpen"
        :kind="notice"
        class="card-brut absolute inset-x-4 bottom-8 z-10 md:hidden"
        @retry="store.load"
      />

      <!-- Subir testimonio: al centro, abajo del mapa, siempre a la vista, grande y animado -->
      <RouterLink
        v-if="!formOpen"
        :to="{ name: 'testimony-new', params: { mapa: map.slug } }"
        class="group/cta btn-hxnf btn-lime absolute bottom-[calc(max(env(safe-area-inset-bottom),0.5rem)+2.6rem)] left-1/2 z-20 min-h-13 sm:min-h-14 -translate-x-1/2 px-8 sm:px-10 py-3.5 text-base sm:text-lg font-black tracking-wide uppercase whitespace-nowrap shadow-[6px_6px_0_0_#000] animate-cta-pulse motion-reduce:animate-none hover:scale-105 active:scale-95 transition-all md:bottom-6"
        :class="{ 'max-md:hidden': selected }"
      >
        <span class="relative flex size-3">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-75" />
          <span class="relative inline-flex size-3 rounded-full bg-black" />
        </span>
        <svg viewBox="0 0 24 24" class="size-6 transition-transform group-hover/cta:rotate-90" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>Subir testimonio</span>
      </RouterLink>

      <!-- Lista (móvil) -->
      <div
        v-if="!formOpen && !selected && notice !== 'empty'"
        class="absolute bottom-[calc(max(env(safe-area-inset-bottom),0.5rem)+6.6rem)] left-4 z-10 md:hidden"
      >
        <button type="button" class="btn-hxnf btn-paper btn-sm" @click="mobileList = true">
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          Lista · {{ filteredItems.length }}
        </button>
      </div>
    </div>

    <!-- Lista (móvil): hoja inferior -->
    <Transition
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
      enter-active-class="transition duration-300 ease-out"
      leave-active-class="transition duration-200 ease-in"
    >
      <div v-if="mobileList" class="fixed inset-x-0 bottom-0 z-40 h-[82dvh] overflow-hidden rounded-t-[28px] border-t-2 border-ink bg-surface md:hidden">
        <button
          type="button"
          class="absolute top-2 left-1/2 z-10 h-6 w-16 -translate-x-1/2"
          aria-label="Cerrar lista"
          @click="mobileList = false"
        >
          <span class="mx-auto block h-1.5 w-12 rounded-full bg-fg/40" aria-hidden="true" />
        </button>
        <TestimonySidebar
          class="flex pt-3"
          :map="map"
          :testimonies="recent"
          :total="items.length"
          :state-name="selectedStateName"
          :status="status"
          :selected="null"
          :detail="null"
          :live="live"
          @select="onSidebarSelect"
          @retry="store.load"
          @clear-state="setState(null)"
        />
      </div>
    </Transition>
    <div v-if="mobileList" class="fixed inset-0 z-30 bg-black/40 md:hidden" aria-hidden="true" @click="mobileList = false" />

    <!-- Subir testimonio: panel a un lado del mapa (escritorio) u hoja inferior (móvil) -->
    <RouterView v-slot="{ Component }">
      <Transition
        enter-from-class="translate-y-full md:translate-y-0 md:translate-x-full"
        leave-to-class="translate-y-full md:translate-y-0 md:translate-x-full"
        enter-active-class="transition duration-300 ease-out"
        leave-active-class="transition duration-200 ease-in"
      >
        <section
          v-if="Component"
          class="fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden rounded-t-[28px] border-t-2 border-ink bg-surface shadow-[0_-5px_0_0_var(--shadow-c)] transition-[height] duration-300 md:static md:z-auto md:h-full! md:w-[30rem] md:shrink-0 md:rounded-none md:border-t-0 md:border-l-2 md:shadow-none xl:w-[34rem]"
          :class="sheetExpanded ? 'h-[92dvh]' : 'h-[50dvh]'"
          aria-label="Subir testimonio"
        >
          <button
            type="button"
            class="flex h-6 shrink-0 items-center justify-center md:hidden"
            :aria-label="sheetExpanded ? 'Bajar el formulario para ver el mapa' : 'Subir el formulario'"
            :aria-expanded="sheetExpanded"
            @click="sheetExpanded = !sheetExpanded"
          >
            <span class="block h-1.5 w-12 rounded-full bg-fg/40" aria-hidden="true" />
          </button>
          <component :is="Component" class="min-h-0 flex-1" />
        </section>
      </Transition>
    </RouterView>

    <MapHelp v-if="helpOpen" @close="helpOpen = false" />

    <StoryViewer
      v-if="storyIndex !== null"
      :stories="stories"
      :index="storyIndex"
      :detail="storyDetail"
      :detail-failed="!!currentStory && detailStatus[currentStory.id] === 'error'"
      @update:index="store.openStory"
      @close="store.closeStory"
      @view-on-map="viewOnMap($event, false)"
      @comment="viewOnMap($event, true)"
    />
  </main>
</template>

<style scoped>
/* Entrada: la lista llega desde la izquierda y el título rebota un poco */
.tm-slide-in {
  animation: tm-slide-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 0.35s both;
}
.tm-intro {
  animation: tm-intro 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes tm-slide-in {
  from {
    translate: -100% 0;
  }
}
@keyframes tm-intro {
  from {
    opacity: 0;
    scale: 0.8;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tm-slide-in,
  .tm-intro {
    animation: none;
  }
}

/* En móvil se usa pinch-zoom; los botones de zoom solo en escritorio */
@media (width < 48rem) {
  :deep(.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group) {
    display: none;
  }
}
</style>
