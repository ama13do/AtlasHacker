<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { TOPIC_META } from '@testimonies/data/topics'
import type { Testimony } from '@testimonies/types/testimony'
import TopicBadge from '@testimonies/components/TopicBadge.vue'

const STORY_DURATION = 7000
const HOLD_THRESHOLD = 200

const props = defineProps<{ stories: Testimony[]; index: number }>()
const emit = defineEmits<{
  close: []
  'update:index': [index: number]
  viewOnMap: [id: string]
}>()

const story = computed(() => props.stories[props.index])
const meta = computed(() => TOPIC_META[story.value.topic])
const date = computed(() =>
  new Date(`${story.value.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
)

const progress = ref(0)
const paused = ref(false)
const closeButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null

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

// Tocar: tercio izquierdo retrocede, el resto avanza. Mantener: pausa
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
    paused.value = false
    return
  }
  const target = e.currentTarget as HTMLElement
  const { left, width } = target.getBoundingClientRect()
  if (e.clientX - left < width / 3) prev()
  else next()
}

function onPointerCancel() {
  clearTimeout(holdTimer)
  paused.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowRight') next()
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
  previousFocus?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 md:p-6"
      role="dialog"
      aria-modal="true"
      :aria-label="`Historia: ${story.title}`"
      @click.self="emit('close')"
    >
      <article
        class="relative flex h-full w-full flex-col overflow-hidden bg-black bg-linear-to-b to-black to-60% md:aspect-9/16 md:h-auto md:max-h-full md:w-auto md:max-w-[420px] md:rounded-3xl"
        :class="meta.from"
      >
        <!-- Progreso -->
        <div class="flex gap-1 px-3 pt-3">
          <div v-for="(s, i) in stories" :key="s.id" class="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <div
              class="h-full rounded-full bg-white"
              :style="{ width: `${i < index ? 100 : i === index ? Math.min(progress, 1) * 100 : 0}%` }"
            />
          </div>
        </div>

        <!-- Encabezado -->
        <header class="flex items-center justify-between gap-3 px-4 pt-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold">{{ story.place }}</p>
            <p class="text-xs text-white/70">{{ story.folio }} · {{ date }}</p>
          </div>
          <button
            ref="closeButton"
            type="button"
            class="grid size-10 shrink-0 place-items-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Cerrar historia"
            @click="emit('close')"
          >
            <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <!-- Contenido (zona táctil de navegación) -->
        <div
          class="flex flex-1 cursor-pointer touch-none flex-col justify-end gap-5 px-6 pb-4 select-none"
          @pointerdown="onPointerDown"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
          @pointerleave="onPointerCancel"
        >
          <TopicBadge :topic="story.topic" class="self-start" />
          <h2 class="text-3xl leading-tight font-semibold text-balance">{{ story.title }}</h2>
          <p class="line-clamp-5 text-base text-white/85">{{ story.testimony }}</p>

          <div class="rounded-2xl border border-neon-lime/40 bg-neon-lime/10 p-4">
            <p class="text-xs font-semibold tracking-wide text-neon-lime uppercase">El Tribunal pregunta</p>
            <p class="mt-1 text-lg font-semibold text-neon-lime">{{ story.tribunalQuestion }}</p>
          </div>

          <p class="text-xs text-white/60">
            <span class="font-semibold text-white/80">{{ story.supports }}</span> personas respaldan este testimonio
          </p>
        </div>

        <!-- Acciones -->
        <footer class="space-y-3 px-6 pb-6">
          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 font-semibold text-black transition hover:bg-neon-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            @click="emit('viewOnMap', story.id)"
          >
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            Ver en el mapa
          </button>
          <p class="text-center text-[11px] leading-snug text-white/50">
            El recibo dice. El territorio dice. La comunidad dice. Los datos dicen. El Tribunal pregunta.
          </p>
        </footer>
      </article>
    </div>
  </Teleport>
</template>
