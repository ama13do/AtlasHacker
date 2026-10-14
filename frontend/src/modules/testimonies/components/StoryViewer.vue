<script setup lang="ts">
import { coverFor } from '@testimonies/data/covers'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { categoryStyle } from '@testimonies/data/categories'
import type { TestimonyDetail, TestimonySummary } from '@testimonies/types/testimony'
import CategoryBadge from '@testimonies/components/CategoryBadge.vue'
import ReactionBar from '@testimonies/components/ReactionBar.vue'
import MediaViewer from '@testimonies/components/media/MediaViewer.vue'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'
import { useRoute } from 'vue-router'
import ShareSheet from '@testimonies/components/ShareSheet.vue'
import { DEFAULT_MAP_SLUG } from '@testimonies/data/maps'

const STORY_DURATION = 7000
const HOLD_THRESHOLD = 200

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
const date = computed(() =>
  new Date(`${story.value.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
)

const progress = ref(0)
const paused = ref(false)
const userPaused = ref(false)
const photoViewerIndex = ref<number | null>(null)
const shareOpen = ref(false)
const route = useRoute()
const mapSlug = computed(() => (typeof route.params.mapa === 'string' ? route.params.mapa : DEFAULT_MAP_SLUG))
watch([userPaused, () => photoViewerIndex.value !== null, shareOpen], ([a, b, c]) => (paused.value = a || b || c))

// «Me importa» en la cabecera
const store = useTestimoniesStore()
const liked = computed(() => store.myReactions[story.value.id]?.includes('like') ?? false)
const likes = computed(() => props.detail?.reactionCounts.like ?? 0)
const likeBusy = computed(() => store.pendingReactions.has(`${story.value.id}:like`))
const likePop = ref(false)
async function like() {
  if (!props.detail) return
  if (!liked.value) {
    likePop.value = true
    setTimeout(() => (likePop.value = false), 600)
  }
  try {
    await store.toggleReaction(story.value.id, 'like')
  } catch {
    // ReactionBar maneja el estado
  }
}

// Foto de fondo o evidencia principal
const photo = computed(() => props.detail?.files.find((f) => f.mime.startsWith('image/')) ?? null)
const closeButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null
const navigatingToMap = ref(false)

function handleViewOnMap(id: string) {
  navigatingToMap.value = true
  emit('viewOnMap', id)
}

function handleComment(id: string) {
  navigatingToMap.value = true
  emit('comment', id)
}

function openPhotoViewer(idx = 0) {
  photoViewerIndex.value = idx
}

let frame = 0
let lastTime = 0

function tick(time: number) {
  if (lastTime && !paused.value) {
    progress.value += (time - lastTime) / STORY_DURATION
    if (progress.value >= 1) {
      next()
    }
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

watch(
  () => props.index,
  () => (progress.value = 0),
)

// Gestos táctiles
let holdTimer: ReturnType<typeof setTimeout> | undefined
let held = false

function onPointerDown() {
  held = false
  holdTimer = setTimeout(() => {
    held = true
    paused.value = true
  }, HOLD_THRESHOLD)
}

function onPointerUp(e: PointerEvent) {
  clearTimeout(holdTimer)
  if (held) {
    paused.value = userPaused.value || photoViewerIndex.value !== null
    return
  }
  const target = e.currentTarget as HTMLElement
  const { left, width } = target.getBoundingClientRect()
  if (e.clientX - left < width / 3) prev()
  else next()
}

function onPointerCancel() {
  clearTimeout(holdTimer)
  if (held) paused.value = userPaused.value || photoViewerIndex.value !== null
}

function onKeydown(e: KeyboardEvent) {
  if (photoViewerIndex.value !== null || shareOpen.value) return
  if (e.key === 'Escape') emit('close')
  else if (e.key === ' ') {
    e.preventDefault()
    userPaused.value = !userPaused.value
  } else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}

onMounted(async () => {
  previousFocus = document.activeElement as HTMLElement | null
  window.addEventListener('keydown', onKeydown)
  frame = requestAnimationFrame(tick)
  await nextTick()
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearTimeout(holdTimer)
  window.removeEventListener('keydown', onKeydown)
  if (!navigatingToMap.value) {
    previousFocus?.focus()
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 select-none"
      role="dialog"
      aria-modal="true"
      :aria-label="`Historia ${index + 1} de ${stories.length}: ${story.title}`"
      @click.self="emit('close')"
    >
      <!-- Flechas laterales en escritorio -->
      <button
        type="button"
        class="icon-btn absolute top-1/2 left-[max(1rem,calc(50%-21rem))] z-10 hidden -translate-y-1/2 md:grid"
        :disabled="index === 0"
        aria-label="Historia anterior"
        @click="prev"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <button
        type="button"
        class="icon-btn absolute top-1/2 right-[max(1rem,calc(50%-21rem))] z-10 hidden -translate-y-1/2 md:grid"
        aria-label="Historia siguiente"
        @click="next"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>

      <!-- Contenedor central -->
      <div class="flex h-full w-full max-w-[440px] flex-col items-center justify-center">
        <!-- Tarjeta de la Historia con estética gráfica potente -->
        <article
          class="relative flex h-full max-h-[92dvh] w-full flex-col overflow-hidden text-black rounded-[28px] border-3 border-black shadow-[8px_8px_0_0_#e0fa49]"
          :style="{ backgroundColor: meta.color }"
        >
          <!-- Textura semitono de fondo neo-brutalista -->
          <div
            class="pointer-events-none absolute inset-0 opacity-[0.08] bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:14px_14px]"
            aria-hidden="true"
          />

          <!-- Fondo sutil con imagen desenfocada si hay foto -->
          <img
            v-if="photo"
            :key="`bg-${photo.id}`"
            :src="photo.url"
            alt=""
            class="pointer-events-none absolute inset-0 size-full object-cover opacity-15 blur-sm"
            aria-hidden="true"
          />

          <!-- Sello gráfico de agua de fondo: Tribunal Popular -->
          <div class="pointer-events-none absolute -right-8 -top-6 select-none opacity-[0.07] rotate-[-12deg]" aria-hidden="true">
            <span class="font-wide text-8xl font-black uppercase tracking-tighter">HXNF</span>
          </div>

          <!-- Barra de progreso superior -->
          <div class="relative z-10 flex gap-1 px-3.5 pt-3">
            <div v-for="(s, i) in stories" :key="s.id" class="h-1.5 flex-1 overflow-hidden rounded-full border border-black/50 bg-black/20">
              <div class="h-full rounded-full bg-black transition-all" :style="{ width: `${i < index ? 100 : i === index ? Math.min(progress, 1) * 100 : 0}%` }" />
            </div>
          </div>

          <!-- Encabezado con información del caso y acciones -->
          <header class="relative z-10 flex items-center gap-1.5 px-3.5 pt-2 sm:gap-2 sm:px-4">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="rounded bg-black px-1.5 py-0.2 text-[9px] font-black text-white uppercase tracking-wider">
                  Caso {{ index + 1 }}/{{ stories.length }}
                </span>
                <span class="truncate text-[11px] font-bold opacity-80">{{ story.folio }}</span>
              </div>
              <p class="truncate text-xs font-black sm:text-sm text-black">{{ story.place }}</p>
            </div>

            <!-- Botón Me importa -->
            <button
              v-if="detail"
              type="button"
              class="inline-flex h-8 items-center gap-1 rounded-full border-2 border-black px-2.5 text-xs font-black text-black shadow-[2px_2px_0_0_#000] transition-transform active:scale-90 disabled:cursor-wait"
              :class="[liked ? 'bg-neon-lime ring-2 ring-black' : 'bg-white', { 'scale-110': likePop }]"
              :aria-pressed="liked"
              :aria-label="`Me importa: ${likes}`"
              :disabled="likeBusy"
              @click="like"
            >
              <svg viewBox="0 0 24 24" class="size-3.5" :fill="liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
              </svg>
              <span class="tabular-nums">{{ likes }}</span>
            </button>

            <!-- Botón arriba: Compartir en redes -->
            <button
              type="button"
              class="inline-flex h-8 items-center gap-1 rounded-full border-2 border-black bg-brand-pink px-2.5 text-[11px] font-black text-black uppercase shadow-[2px_2px_0_0_#000] transition hover:-translate-y-0.5 active:scale-95"
              aria-label="Compartir en redes sociales"
              title="Compartir foto y testimonio con la leyenda oficial"
              @click="shareOpen = true"
            >
              <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
              </svg>
              <span class="font-black">Compartir</span>
            </button>

            <!-- Pausar / Reanudar -->
            <button type="button" class="icon-btn size-8 border-black bg-white text-black shadow-[1.5px_1.5px_0_0_#000]" :aria-label="paused ? 'Reanudar' : 'Pausar'" @click="userPaused = !userPaused">
              <svg v-if="paused" viewBox="0 0 24 24" class="ml-0.5 size-3.5" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              <svg v-else viewBox="0 0 24 24" class="size-3.5" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
            </button>

            <!-- Cerrar historia -->
            <button ref="closeButton" type="button" class="icon-btn size-8 border-black bg-white text-black shadow-[1.5px_1.5px_0_0_#000]" aria-label="Cerrar historia" @click="emit('close')">
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </header>

          <!-- Zona de contenido táctil central con IDENTIDAD VISUAL RICA -->
          <div
            class="relative z-10 flex min-h-0 flex-1 cursor-pointer touch-none flex-col justify-end gap-2.5 overflow-hidden px-4 pb-2 select-none"
            @pointerdown="onPointerDown"
            @pointerup="onPointerUp"
            @pointercancel="onPointerCancel"
            @pointerleave="onPointerCancel"
          >
            <!-- CASO 1: CUANDO HAY FOTO DE EVIDENCIA (Formato Expediente / Dossier Pericial con Alma) -->
            <div v-if="photo" class="relative mx-auto w-full flex-1 flex flex-col justify-center min-h-0 py-1">
              <!-- Marco tipo Expediente Judicial con esquineros y cinta pericial -->
              <div
                class="group/photo relative flex flex-col overflow-hidden rounded-2xl border-3 border-black bg-[#faf9f5] p-2.5 shadow-[6px_6px_0_0_#000] rotate-[-1deg] transition-all hover:rotate-0 hover:shadow-[8px_8px_0_0_#000] cursor-pointer"
                title="Toca para ampliar y examinar la fotografía"
                @click.stop="openPhotoViewer(0)"
              >
                <!-- Esquineros de archivo fotográfico pericial (Photo mounting corners) -->
                <div class="pointer-events-none absolute top-1.5 left-1.5 z-20 size-3.5 border-t-3 border-l-3 border-black" aria-hidden="true" />
                <div class="pointer-events-none absolute top-1.5 right-1.5 z-20 size-3.5 border-t-3 border-r-3 border-black" aria-hidden="true" />
                <div class="pointer-events-none absolute bottom-1.5 left-1.5 z-20 size-3.5 border-b-3 border-l-3 border-black" aria-hidden="true" />
                <div class="pointer-events-none absolute bottom-1.5 right-1.5 z-20 size-3.5 border-b-3 border-r-3 border-black" aria-hidden="true" />

                <!-- Cinta adhesiva pericial washi tape con franjas de advertencia -->
                <div class="absolute -top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-xs border-2 border-black bg-neon-lime px-3 py-0.5 shadow-xs rotate-[1.5deg]">
                  <span class="size-1.5 rounded-full bg-black animate-ping" />
                  <span class="font-mono text-[9px] font-black uppercase tracking-wider text-black">
                    ⚠ PRUEBA DOCUMENTAL · EXP. {{ story.folio }}
                  </span>
                </div>

                <!-- Foto con aspecto nítido, marco interno y overlay pericial -->
                <div class="relative aspect-4/3 w-full overflow-hidden rounded-xl border-2 border-black bg-black">
                  <img
                    :src="photo.url"
                    :alt="story.title"
                    class="size-full object-cover transition-transform duration-500 group-hover/photo:scale-105"
                  />

                  <!-- Degradado cinematográfico con datos de localización -->
                  <div class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/45 to-transparent p-2.5 text-white">
                    <div class="flex items-center justify-between text-[11px] font-bold">
                      <p class="flex items-center gap-1 text-neon-lime truncate max-w-[70%]">
                        <svg viewBox="0 0 24 24" class="size-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>
                        <span class="truncate">{{ story.place }}</span>
                      </p>
                      <time class="font-mono text-[9px] text-white/80 shrink-0">{{ date }}</time>
                    </div>
                  </div>

                  <!-- Badge interactivo de inspección / ampliación -->
                  <div class="absolute top-2 right-2 flex items-center gap-1 rounded-full border border-black/80 bg-black/85 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs backdrop-blur-xs transition-transform group-hover/photo:scale-105">
                    <svg viewBox="0 0 24 24" class="size-3 text-neon-lime" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6M8 11h6"/></svg>
                    <span>Ver original</span>
                  </div>
                </div>

                <!-- Pie de polaroid / sello oficial del Tribunal Popular -->
                <div class="mt-2 flex items-center justify-between px-1">
                  <div class="flex items-center gap-1.5">
                    <span class="rounded bg-black px-1.5 py-0.5 font-mono text-[8px] font-black uppercase text-neon-lime">EVIDENCIA CERTIFICADA</span>
                    <span class="font-mono text-[9px] font-bold text-black/70">HXNF · TERRITORIO</span>
                  </div>
                  <!-- Sello rojo de verificación -->
                  <div class="rotate-[-6deg] rounded border-1.5 border-dashed border-red-600 bg-red-600/10 px-1.5 py-0.2 text-[8px] font-black uppercase text-red-600">
                    ★ VERIFICADO ★
                  </div>
                </div>
              </div>
            </div>

            <!-- CASO 2: CUANDO NO HAY FOTO (Póster Neo-brutalista de Denuncia Popular) -->
            <div v-else class="relative mx-auto flex w-full flex-1 flex-col items-center justify-center py-2 min-h-0">
              <!-- Sello oficial de fondo del Tribunal Popular -->
              <div class="absolute -top-1 left-2 z-0 rotate-[-12deg] rounded-xl border-2 border-dashed border-black/40 p-2 text-center text-black/40">
                <span class="block text-[8px] font-black tracking-widest uppercase">TRIBUNAL POPULAR</span>
                <span class="block text-[7px] font-bold">CASO REGISTRADO</span>
              </div>

              <!-- Sticker de marca con animación y sombra brutalista -->
              <div class="relative z-10 grid place-items-center">
                <img :src="coverFor(story)" alt="" class="cutout w-36 sm:w-44 animate-sticker-float motion-reduce:animate-none drop-shadow-[6px_6px_0_rgba(0,0,0,1)]" />
              </div>

              <!-- Cartela conmemorativa del testimonio -->
              <div class="mt-2 rounded-full border-1.5 border-black bg-white/90 px-3 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow-xs">
                Declaración testimonial en territorio
              </div>
            </div>

            <!-- Tarjeta de Contenido: Título y Extracto del testimonio -->
            <div class="relative z-10 space-y-2 rounded-[20px] border-2.5 border-black bg-white p-3.5 shadow-[4px_4px_0_0_#000]">
              <div class="flex items-center justify-between gap-2">
                <CategoryBadge :category="story.category" class="self-start border-1.5 border-black" />
                <span class="text-[10px] font-bold opacity-60">📍 {{ story.place.split(',')[0] }}</span>
              </div>
              <h2 class="font-wide line-clamp-2 text-base leading-tight font-black text-balance sm:text-lg">{{ detail?.title ?? story.title }}</h2>
              <p v-if="detail" class="line-clamp-2 text-xs leading-snug sm:text-sm text-neutral-800">{{ detail.testimony }}</p>
              <div v-else-if="!detailFailed" class="space-y-1.5" aria-hidden="true">
                <span class="block h-3 w-full animate-pulse rounded-full bg-black/15" />
                <span class="block h-3 w-3/5 animate-pulse rounded-full bg-black/15" />
              </div>
            </div>

            <!-- Pregunta del Tribunal Popular -->
            <div v-if="detail?.tribunalQuestion" class="relative z-10 rotate-[-0.6deg] rounded-[18px] border-2 border-black bg-neon-lime p-2.5 text-black shadow-[3px_3px_0_0_#000]">
              <p class="text-[10px] font-black tracking-wide uppercase">⚡ El Tribunal pregunta</p>
              <p class="font-wide mt-0.5 line-clamp-2 text-xs leading-snug font-black sm:text-sm">«{{ detail.tribunalQuestion }}»</p>
            </div>
          </div>

          <!-- Acciones inferiores: Reacciones y Botones de Alto Impacto -->
          <footer class="relative z-20 shrink-0 space-y-2.5 border-t-2 border-black bg-white px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <!-- Reacciones: Solo íconos limpios con aviso flotante de qué reacción es -->
            <ReactionBar v-if="detail" :testimony-id="story.id" compact />

            <!-- BOTONES DE ACCIÓN: Alto contraste y visibilidad garantizada -->
            <div class="grid grid-cols-2 gap-2.5">
              <!-- Botón 1: Ver en el mapa (Blanco nítido con pin negro, no se confunde) -->
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-2xl border-2.5 border-black bg-white py-2.5 px-2 text-xs font-black text-black shadow-[3px_3px_0_0_#000] transition hover:-translate-y-0.5 hover:bg-neutral-100 active:scale-95"
                @click="handleViewOnMap(story.id)"
              >
                <svg viewBox="0 0 24 24" class="size-4 text-black" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                <span>Ver en mapa</span>
              </button>

              <!-- Botón 2: Comentar (Verde Neón llamativo con sombra dura e ícono, resalta al 100%) -->
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-2xl border-2.5 border-black bg-neon-lime py-2.5 px-2 text-xs font-black text-black shadow-[4px_4px_0_0_#000] ring-2 ring-black/20 transition hover:-translate-y-0.5 hover:bg-neon-green hover:shadow-[5px_5px_0_0_#000] active:scale-95"
                title="Abrir directamente la sección para escribir tu comentario"
                @click="handleComment(story.id)"
              >
                <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>Comentar</span>
                <span class="rounded-full bg-black px-1.5 py-0.2 text-[10px] font-black text-neon-lime tabular-nums">
                  {{ detail?.comments ?? story.comments }}
                </span>
              </button>
            </div>
          </footer>
        </article>

        <!-- Indicación de navegación: COMPLETAMENTE FUERA DE LA TARJETA (Tanto móvil como escritorio) -->
        <p class="mt-2.5 w-max max-w-[95%] rounded-full border border-white/40 bg-black/85 px-3.5 py-1 text-center text-[11px] font-bold text-white shadow-md">
          Toca derecha para avanzar · izquierda para regresar · mantén para pausar
        </p>
      </div>
    </div>

    <!-- Visor de pantalla completa para fotos de evidencia -->
    <MediaViewer
      v-if="photoViewerIndex !== null && detail?.files.length"
      :files="detail.files"
      :index="photoViewerIndex"
      :title="story.title"
      @update:index="photoViewerIndex = $event"
      @close="photoViewerIndex = null"
    />

    <!-- Hoja de Compartir en redes sociales -->
    <ShareSheet v-if="shareOpen" :testimony="story" :detail="detail" :map-slug="mapSlug" @close="shareOpen = false" />
  </Teleport>
</template>
