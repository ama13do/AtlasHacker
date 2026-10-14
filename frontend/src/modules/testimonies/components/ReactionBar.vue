<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'
import { REACTION_TYPES, type ReactionType } from '@testimonies/types/testimony'
import ReactionIcon from '@testimonies/components/ReactionIcon.vue'

// Reacciones del testimonio: una de cada tipo por dispositivo, se pueden dar varias.
// `compact`: versión para historias (solo íconos, feedback inmediato de qué reacción es)
const props = defineProps<{ testimonyId: string; compact?: boolean }>()

const REACTIONS: Record<ReactionType, { label: string; meaning: string; bg: string }> = {
  like: { label: 'Me importa', meaning: 'Este testimonio me importa', bg: 'bg-neon-lime' },
  apoyo: { label: 'Apoyo', meaning: 'Respaldo a quien lo cuenta y a su comunidad', bg: 'bg-neon-green' },
  alerta: { label: 'Alerta', meaning: 'También pasa donde vivo o conozco', bg: 'bg-brand-orange' },
  fuego: { label: 'Urgente', meaning: 'Necesita atención urgente', bg: 'bg-brand-pink' },
}

const store = useTestimoniesStore()
const categories = useCategoriesStore()

const enabled = computed(() => categories.config?.reactionsEnabled ?? true)
const detail = computed(() => store.details[props.testimonyId])
const mine = computed(() => store.myReactions[props.testimonyId] ?? [])
const failed = ref(false)
const showHelp = ref(false)

// En historias: solo íconos; al tocar, muestra qué reacción es
const activeTooltip = ref<{ type: ReactionType; added: boolean } | null>(null)
let tooltipTimer: ReturnType<typeof setTimeout> | undefined

// Cargar reacciones del testimonio actual y reaccionar a cambios de testimonioId
watch(
  () => props.testimonyId,
  (id) => {
    activeTooltip.value = null
    if (id) store.loadMyReactions(id)
  },
  { immediate: true },
)

async function toggle(type: ReactionType) {
  failed.value = false
  const isAdding = !mine.value.includes(type)
  clearTimeout(tooltipTimer)
  activeTooltip.value = { type, added: isAdding }
  tooltipTimer = setTimeout(() => {
    activeTooltip.value = null
  }, 2500)

  try {
    await store.toggleReaction(props.testimonyId, type)
  } catch {
    failed.value = true
  }
}

const busy = (type: ReactionType) => store.pendingReactions.has(`${props.testimonyId}:${type}`)
</script>

<template>
  <!-- Historias: fila limpia de íconos; al tocar, un aviso dice qué reacción es -->
  <div v-if="enabled && detail && compact" class="relative">
    <Transition enter-from-class="opacity-0 -translate-y-1 scale-95" enter-active-class="transition duration-150 ease-out" leave-to-class="opacity-0 scale-95" leave-active-class="transition duration-200 ease-in">
      <div
        v-if="activeTooltip"
        class="pointer-events-none absolute -top-9 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-black px-3 py-0.5 text-xs font-black text-black shadow-[2px_2px_0_0_#000]"
        :class="REACTIONS[activeTooltip.type].bg"
        role="status"
      >
        <span>{{ activeTooltip.added ? '✓ ' : '✕ ' }}</span>
        <span>{{ REACTIONS[activeTooltip.type].label }}</span>
        <span class="font-normal opacity-75">({{ REACTIONS[activeTooltip.type].meaning }})</span>
      </div>
    </Transition>

    <ul class="flex items-center justify-around gap-2 px-1" aria-label="Reacciones">
      <li v-for="type in REACTION_TYPES" :key="type">
        <button
          type="button"
          class="group relative grid size-11 place-items-center rounded-full border-2 border-black text-black transition-[transform,box-shadow] active:scale-90 disabled:cursor-wait"
          :class="mine.includes(type) ? [REACTIONS[type].bg, '-translate-y-0.5 shadow-[2px_2px_0_0_#000] ring-2 ring-black/20'] : 'bg-white hover:-translate-y-0.5 hover:shadow-[2px_2px_0_0_#000]'"
          :aria-pressed="mine.includes(type)"
          :aria-label="`${REACTIONS[type].label}: ${detail.reactionCounts[type]}`"
          :title="`${REACTIONS[type].label}: ${REACTIONS[type].meaning}`"
          :disabled="busy(type)"
          @click="toggle(type)"
        >
          <ReactionIcon :type="type" :filled="mine.includes(type)" class="size-5 transition-transform group-hover:scale-110" :class="{ 'animate-pulse': busy(type) }" />
          <span
            v-if="detail.reactionCounts[type] > 0"
            class="absolute -right-1 -bottom-1 min-w-4 rounded-full border-1.5 border-black bg-black px-1 text-center text-[9px] leading-3.5 font-black text-white tabular-nums shadow-sm"
          >
            {{ detail.reactionCounts[type] }}
          </span>
        </button>
      </li>
    </ul>
    <p v-if="failed" role="status" class="mt-1 text-center text-xs font-semibold text-danger">No se pudo guardar tu reacción.</p>
  </div>

  <div v-else-if="enabled && detail" class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-black tracking-wide uppercase">
        Reacciona
        <span class="font-semibold normal-case opacity-60">· {{ detail.reactions }} en total</span>
      </p>
      <button
        v-if="!compact"
        type="button"
        class="text-[11px] font-bold underline decoration-2 underline-offset-2 opacity-70 hover:opacity-100"
        :aria-expanded="showHelp"
        @click="showHelp = !showHelp"
      >
        ¿Qué significa?
      </button>
    </div>

    <ul class="grid grid-cols-2 gap-2" aria-label="Reacciones">
      <li v-for="type in REACTION_TYPES" :key="type">
        <button
          type="button"
          class="relative flex w-full items-center gap-2 rounded-2xl border-2 border-black px-2.5 py-2 text-left text-black transition-[translate,box-shadow] disabled:cursor-wait"
          :class="[
            mine.includes(type) ? [REACTIONS[type].bg, '-translate-y-0.5 shadow-[3px_3px_0_0_#000]'] : 'bg-white hover:-translate-y-0.5 hover:shadow-[2px_2px_0_0_#000]',
          ]"
          :aria-pressed="mine.includes(type)"
          :aria-label="`${REACTIONS[type].label} (${REACTIONS[type].meaning}): ${detail.reactionCounts[type]}${mine.includes(type) ? '. Ya reaccionaste; toca para quitarla' : ''}`"
          :title="REACTIONS[type].meaning"
          :disabled="busy(type)"
          @click="toggle(type)"
        >
          <ReactionIcon :type="type" :filled="mine.includes(type)" class="size-5 shrink-0" :class="{ 'animate-pulse': busy(type) }" />
          <span class="min-w-0 flex-1 truncate text-xs font-bold">{{ REACTIONS[type].label }}</span>
          <span class="font-wide text-sm font-black tabular-nums">{{ detail.reactionCounts[type] }}</span>
          <span
            v-if="mine.includes(type)"
            class="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full border-2 border-black bg-black text-neon-lime"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" class="size-3" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10" /></svg>
          </span>
        </button>
      </li>
    </ul>

    <div v-if="showHelp" class="rounded-2xl border-2 border-ink bg-neon-lime/20 p-3 text-xs leading-relaxed">
      <p class="mb-1.5">Las reacciones muestran qué testimonios mueven a más gente. Puedes dar varias; vuelve a tocar una para quitarla. Se cuenta una de cada tipo por dispositivo.</p>
      <ul class="space-y-0.5">
        <li v-for="type in REACTION_TYPES" :key="type"><span class="font-bold">{{ REACTIONS[type].label }}:</span> {{ REACTIONS[type].meaning }}.</li>
      </ul>
    </div>
    <p v-else-if="mine.length && !compact" class="text-[11px] opacity-60">Ya reaccionaste ({{ mine.length }}). Toca de nuevo para quitarla.</p>
    <p v-if="failed" role="status" class="text-xs font-semibold text-danger">No se pudo guardar tu reacción. Intenta de nuevo.</p>
  </div>
</template>
