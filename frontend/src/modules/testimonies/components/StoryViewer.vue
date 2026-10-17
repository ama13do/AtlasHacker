<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { STICKERS, phraseFor } from '@/core/config/brand'
import { categoryStyle } from '@testimonies/data/categories'
import { coverFor } from '@testimonies/data/covers'
import { DEFAULT_MAP_SLUG, logoForSlug } from '@testimonies/data/maps'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { TestimonyDetail, TestimonySummary } from '@testimonies/types/testimony'
import CategoryIcon from '@testimonies/components/CategoryIcon.vue'
import ReactionBar from '@testimonies/components/ReactionBar.vue'
import ShareSheet from '@testimonies/components/ShareSheet.vue'
import MediaViewer from '@testimonies/components/media/MediaViewer.vue'
import MapLogo from '@testimonies/components/MapLogo.vue'

// Historias: los testimonios con más reacciones, uno tras otro. La duración depende de cuánto hay que leer
// y de cuántas fotos trae; las fotos pasan como carrete dentro de la historia.
const HOLD_THRESHOLD = 200
const MIN_DURATION = 10_000
const MAX_DURATION = 30_000

const props = defineProps<{
  stories: TestimonySummary[]
  index: number
  detail: TestimonyDetail | null
  detailFailed?: boolean
}>()
const emit = defineEmits<{
  close: []
  'update:index': [index: number]
  viewOnMap: [id: string]
  comment: [id: string]
}>()

const story = computed(() => props.stories[props.index])
const meta = computed(() => categoryStyle(story.value.category))
const categories = useCategoriesStore()
const categoryLabel = computed(() => categories.bySlug(story.value.category).label)
const date = computed(() =>
  new Date(`${story.value.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
)
const route = useRoute()
const mapSlug = computed(() => (typeof route.params.mapa === 'string' ? route.params.mapa : DEFAULT_MAP_SLUG))
const campaignLogo = computed(() => logoForSlug(mapSlug.value))

// Fotos del testimonio (carrete) y duración: ~16 caracteres por segundo de lectura + 3.5 s por foto extra
const photos = computed(() => props.detail?.files.filter((f) => f.mime.startsWith('image/')) ?? [])
const duration = computed(() => {
  const text = (props.detail?.testimony ?? '').slice(0, 420).length + (props.detail?.tribunalQuestion?.length ?? 0)
  const ms = 6_000 + (text / 16) * 1000 + Math.max(0, photos.value.length - 1) * 3_500
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, ms))
})

// --- Reproducción ---
const progress = ref(0)
const held = ref(false)
const userPaused = ref(false)
const viewerIndex = ref<number | null>(null)
const shareOpen = ref(false)
const paused = computed(() => held.value || userPaused.value || viewerIndex.value !== null || shareOpen.value)

let frame = 0
let lastTime = 0
function tick(time: number) {
  if (lastTime && !paused.value && props.detail) {
    progress.value += (time - lastTime) / duration.value
    if (progress.value >= 1) next()
  }
  lastTime = time
  frame = requestAnimationFrame(tick)
}

function next() {
  if (props.index < props.stories.length - 1) emit('update:index', props.index + 1)
  else emit('close')
}
function prev() {
  if (props.index > 0) emit('update:index', props.index - 1)
  else progress.value = 0
}

// --- Carrete de fotos: avanza con la historia; si la persona lo mueve, manda ella ---
const photoIndex = ref(0)
const photoTouched = ref(false)
watch(
  () => props.index,
  () => {
    progress.value = 0
    photoIndex.value = 0
    photoTouched.value = false
  },
)
watch(progress, (p) => {
  if (photoTouched.value || photos.value.length < 2) return
  photoIndex.value = Math.min(photos.value.length - 1, Math.floor(p * photos.value.length))
})
function goPhoto(i: number) {
  photoTouched.value = true
  photoIndex.value = (i + photos.value.length) % photos.value.length
}
let swipeX: number | null = null
function onGalleryDown(e: PointerEvent) {
  swipeX = e.clientX
}
function onGalleryUp(e: PointerEvent) {
  if (swipeX === null) return
  const dx = e.clientX - swipeX
  swipeX = null
  if (Math.abs(dx) > 40) goPhoto(photoIndex.value + (dx < 0 ? 1 : -1))
  else viewerIndex.value = photoIndex.value // toque: ver en grande
}

// --- Zona táctil del texto: izquierda regresa, derecha avanza; mantener pausa ---
let holdTimer: ReturnType<typeof setTimeout> | undefined
let wasHeld = false
function onPointerDown() {
  wasHeld = false
  holdTimer = setTimeout(() => {
    wasHeld = true
    held.value = true
  }, HOLD_THRESHOLD)
}
function onPointerUp(e: PointerEvent) {
  clearTimeout(holdTimer)
  held.value = false
  if (wasHeld) return
  const { left, width } = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (e.clientX - left < width / 3) prev()
  else next()
}
function onPointerCancel() {
  clearTimeout(holdTimer)
  held.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (viewerIndex.value !== null || shareOpen.value) return
  if (e.key === 'Escape') emit('close')
  else if (e.key === ' ') {
    e.preventDefault()
    userPaused.value = !userPaused.value
  } else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}

// Indicación de gestos (celular): solo al inicio
const showHint = ref(true)
setTimeout(() => (showHint.value = false), 4500)

const closeButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null
let leavingToMap = false
function toMap(comment: boolean) {
  leavingToMap = true
  if (comment) emit('comment', story.value.id)
  else emit('viewOnMap', story.value.id)
}

onMounted(async () => {
  previousFocus = document.activeElement as HTMLElement | null
  window.addEventListener('keydown', onKeydown)
  document.documentElement.style.overflow = 'hidden'
  frame = requestAnimationFrame(tick)
  await nextTick()
  closeButton.value?.focus()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearTimeout(holdTimer)
  window.removeEventListener('keydown', onKeydown)
  document.documentElement.style.overflow = ''
  if (!leavingToMap) previousFocus?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md sm:p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="`Historia ${index + 1} de ${stories.length}: ${story.title}`"
      @click.self="emit('close')"
    >
      <!-- Flechas (escritorio) -->
      <button
        type="button"
        class="icon-btn absolute top-1/2 left-[max(1rem,calc(50%-19.5rem))] z-10 hidden size-12 -translate-y-1/2 sm:grid"
        :disabled="index === 0"
        aria-label="Historia anterior"
        @click="prev"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <button
        type="button"
        class="icon-btn absolute top-1/2 right-[max(1rem,calc(50%-19.5rem))] z-10 hidden size-12 -translate-y-1/2 sm:grid"
        aria-label="Historia siguiente"
        @click="next"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>

      <div class="flex h-full w-full flex-col items-center sm:h-auto sm:w-auto">
        <!-- Celular: pantalla completa. Escritorio: tarjeta 9:16 -->
        <article
          class="tm-story on-light relative flex h-dvh w-full flex-col overflow-hidden text-black sm:aspect-9/16 sm:h-[min(52rem,calc(100dvh-5.5rem))] sm:w-auto sm:rounded-[30px] sm:border-[3px] sm:border-black sm:shadow-[10px_10px_0_0_#e0fa49]"
          :style="{ backgroundColor: meta.color }"
        >
          <!-- Semitono -->
          <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(0_0_0/0.11)_1.4px,transparent_1.6px)] [background-size:14px_14px]" aria-hidden="true" />

          <!-- Progreso -->
          <div class="relative z-10 flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div v-for="(s, i) in stories" :key="s.id" class="h-1.5 flex-1 overflow-hidden rounded-full bg-black/20">
              <div class="h-full rounded-full bg-black" :style="{ width: `${i < index ? 100 : i === index ? Math.min(progress, 1) * 100 : 0}%` }" />
            </div>
          </div>

          <!-- Encabezado -->
          <header class="relative z-10 flex items-center gap-2 px-3 pt-2.5">
            <MapLogo v-if="campaignLogo" :logo="campaignLogo" tone="ink" alt="Juicios x Nuestro Futuro" class="h-9 w-auto shrink-0 -rotate-2" />
            <img v-else :src="STICKERS.hxnf.lima" alt="hxnf" class="h-8 w-auto shrink-0 -rotate-3" />
            <div class="min-w-0 flex-1 leading-tight">
              <p class="truncate text-[11px] font-black uppercase">{{ index + 1 }} de {{ stories.length }} · Lo más apoyado</p>
              <p class="truncate text-xs font-semibold opacity-80">{{ story.place }}</p>
            </div>
            <button
              type="button"
              class="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-black bg-white px-3 text-xs font-black uppercase shadow-[2px_2px_0_0_#000] transition hover:-translate-y-0.5 active:translate-y-0.5"
              aria-label="Compartir en redes"
              @click="shareOpen = true"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
              </svg>
              <span class="hidden min-[430px]:inline">Compartir</span>
            </button>
            <button type="button" class="grid size-9 place-items-center rounded-full border-2 border-black bg-white shadow-[2px_2px_0_0_#000]" :aria-label="paused ? 'Reanudar' : 'Pausar'" @click="userPaused = !userPaused">
              <svg v-if="paused" viewBox="0 0 24 24" class="ml-0.5 size-4" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              <svg v-else viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
            </button>
            <button ref="closeButton" type="button" class="grid size-9 place-items-center rounded-full border-2 border-black bg-white shadow-[2px_2px_0_0_#000]" aria-label="Cerrar historias" @click="emit('close')">
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </header>

          <!-- Contenido (se anima al cambiar de historia) -->
          <div :key="story.id" class="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-3.5 pt-3 pb-2">
            <!-- Carrete de fotos -->
            <div v-if="photos.length" class="tm-story-media relative min-h-0 flex-1">
              <div
                class="relative h-full touch-pan-y overflow-hidden rounded-[22px] border-[3px] border-black bg-black shadow-[5px_5px_0_0_#000]"
                @pointerdown.stop="onGalleryDown"
                @pointerup.stop="onGalleryUp"
              >
                <div class="flex h-full transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]" :style="{ transform: `translateX(-${photoIndex * 100}%)` }">
                  <img
                    v-for="(p, i) in photos"
                    :key="p.id"
                    :src="p.url"
                    :alt="p.description || `Foto ${i + 1} del testimonio`"
                    class="size-full shrink-0 object-cover"
                    :class="{ 'tm-ken-burns': i === photoIndex }"
                    draggable="false"
                  />
                </div>
                <!-- Contador y puntos -->
                <span v-if="photos.length > 1" class="absolute top-2.5 right-2.5 rounded-full bg-black/75 px-2.5 py-0.5 text-[11px] font-black text-white tabular-nums">
                  {{ photoIndex + 1 }}/{{ photos.length }}
                </span>
                <div v-if="photos.length > 1" class="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
                  <button
                    v-for="(p, i) in photos"
                    :key="p.id"
                    type="button"
                    class="h-2 rounded-full border border-black transition-all"
                    :class="i === photoIndex ? 'w-6 bg-neon-lime' : 'w-2 bg-white/80'"
                    :aria-label="`Ver foto ${i + 1}`"
                    @pointerdown.stop
                    @pointerup.stop
                    @click.stop="goPhoto(i)"
                  />
                </div>
                <span class="pointer-events-none absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  <svg viewBox="0 0 24 24" class="size-3" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                  Toca para ampliar
                </span>
              </div>
            </div>

            <!-- Sin fotos: el ícono de la categoría y un sticker de frase (el relato tiene más espacio abajo) -->
            <div v-else class="tm-story-media relative flex min-h-24 flex-1 items-center justify-center gap-4">
              <img :src="coverFor(story)" alt="" class="cutout h-full max-h-44 w-auto max-w-[38%] -rotate-6 object-contain" />
              <img :src="phraseFor(story.category)" alt="" class="h-full max-h-40 w-auto max-w-[55%] rotate-3 animate-sticker-float object-contain drop-shadow-[4px_4px_0_rgba(0,0,0,0.85)] motion-reduce:animate-none" />
            </div>

            <!-- Texto (zona táctil para navegar) -->
            <div
              class="tm-story-text relative cursor-pointer touch-none space-y-2 overflow-hidden rounded-[22px] border-[3px] border-black bg-white p-3.5 shadow-[5px_5px_0_0_#000] select-none"
              @pointerdown="onPointerDown"
              @pointerup="onPointerUp"
              @pointercancel="onPointerCancel"
              @pointerleave="onPointerCancel"
            >
              <p class="flex items-center justify-between gap-2 text-[11px] font-black uppercase">
                <span class="inline-flex items-center gap-1.5 rounded-full border-2 border-black px-2 py-0.5" :style="{ backgroundColor: meta.color, color: meta.ink }">
                  <CategoryIcon :category="story.category" class="size-3.5" />
                  {{ categoryLabel }}
                </span>
                <span class="font-semibold normal-case opacity-60">{{ date }}</span>
              </p>
              <h2 class="line-clamp-3 text-xl leading-[1.15] font-extrabold text-balance sm:text-[1.35rem]">{{ detail?.title ?? story.title }}</h2>
              <p v-if="detail" class="text-[13px] leading-snug text-neutral-800 sm:text-sm" :class="photos.length ? 'line-clamp-4' : 'line-clamp-[12] text-[15px] sm:text-base'">{{ detail.testimony }}</p>
              <div v-else-if="!detailFailed" class="space-y-1.5" aria-hidden="true">
                <span class="block h-3 w-full animate-pulse rounded-full bg-black/15" />
                <span class="block h-3 w-3/5 animate-pulse rounded-full bg-black/15" />
              </div>
              <p v-if="detail?.tribunalQuestion" class="rounded-xl border-2 border-black bg-neon-lime px-2.5 py-1.5 text-xs leading-snug font-bold text-black">
                <span class="font-black uppercase">El Tribunal pregunta: </span>«{{ detail.tribunalQuestion }}»
              </p>
            </div>
          </div>

          <!-- Acciones -->
          <footer class="relative z-20 shrink-0 space-y-3 border-t-[3px] border-black bg-white px-3.5 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
            <ReactionBar v-if="detail" :testimony-id="story.id" compact />
            <div class="grid grid-cols-2 gap-2.5">
              <button type="button" class="btn-hxnf btn-sm border-black bg-white text-black" @click="toMap(false)">
                <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" />
                </svg>
                Leer completo
              </button>
              <button type="button" class="btn-hxnf btn-lime btn-sm" @click="toMap(true)">
                <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Comentar · {{ detail?.comments ?? story.comments }}
              </button>
            </div>
          </footer>

          <!-- Celular: indicación de gestos al inicio (flota y se va sola) -->
          <Transition leave-active-class="transition duration-500" leave-to-class="opacity-0">
            <p
              v-if="showHint && index === 0"
              class="pointer-events-none absolute inset-x-6 top-24 z-30 rounded-2xl bg-black/80 px-3 py-2 text-center text-xs font-bold text-white sm:hidden"
            >
              Toca el texto a la derecha para avanzar · a la izquierda para regresar · desliza las fotos
            </p>
          </Transition>
        </article>

        <!-- Escritorio: indicación FUERA de la tarjeta -->
        <p class="mt-3 hidden rounded-full border-2 border-white/40 px-4 py-1 text-xs font-bold text-white sm:block">
          Toca el texto: derecha avanza · izquierda regresa · mantén para pausar · ← → en el teclado
        </p>
      </div>
    </div>

    <MediaViewer
      v-if="viewerIndex !== null && photos.length"
      :files="photos"
      :index="viewerIndex"
      :title="story.title"
      @update:index="viewerIndex = $event"
      @close="viewerIndex = null"
    />
    <ShareSheet v-if="shareOpen" :testimony="story" :detail="detail" :map-slug="mapSlug" @close="shareOpen = false" />
  </Teleport>
</template>
