<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'
import { REACTION_TYPES, type ReactionType } from '@testimonies/types/testimony'

// Reacciones del testimonio (una de cada tipo por dispositivo). Requiere la ficha cargada
const props = defineProps<{ testimonyId: string; compact?: boolean }>()

const REACTIONS: Record<ReactionType, { label: string; active: string }> = {
  like: { label: 'Me importa', active: 'bg-neon-lime text-black border-neon-lime' },
  apoyo: { label: 'Apoyo', active: 'bg-neon-green text-black border-neon-green' },
  alerta: { label: 'Alerta', active: 'bg-brand-orange text-black border-brand-orange' },
  fuego: { label: 'Urgente', active: 'bg-brand-pink text-black border-brand-pink' },
}

const store = useTestimoniesStore()
const categories = useCategoriesStore()

const enabled = computed(() => categories.config?.reactionsEnabled ?? true)
const detail = computed(() => store.details[props.testimonyId])
const mine = computed(() => store.myReactions[props.testimonyId] ?? [])
const failed = ref(false)

async function toggle(type: ReactionType) {
  failed.value = false
  try {
    await store.toggleReaction(props.testimonyId, type)
  } catch {
    failed.value = true
  }
}
</script>

<template>
  <div v-if="enabled && detail" class="space-y-1.5">
    <ul class="flex flex-wrap gap-2" aria-label="Reacciones">
      <li v-for="type in REACTION_TYPES" :key="type">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
          :class="[
            compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            mine.includes(type) ? REACTIONS[type].active : 'border-fg/20 text-fg/80 hover:border-fg/50',
          ]"
          :aria-pressed="mine.includes(type)"
          :aria-label="`${REACTIONS[type].label}: ${detail.reactionCounts[type]}`"
          @click="toggle(type)"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <!-- Corazón -->
            <path v-if="type === 'like'" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
            <!-- Puño en alto -->
            <template v-else-if="type === 'apoyo'">
              <path d="M7 11V7a2 2 0 0 1 4 0v4" />
              <path d="M11 10V5a2 2 0 0 1 4 0v5" />
              <path d="M15 10V7a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-2a2 2 0 0 1 4 0" />
            </template>
            <!-- Alerta -->
            <template v-else-if="type === 'alerta'">
              <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </template>
            <!-- Fuego -->
            <path v-else d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
          </svg>
          <span v-if="!compact">{{ REACTIONS[type].label }}</span>
          <span class="tabular-nums">{{ detail.reactionCounts[type] }}</span>
        </button>
      </li>
    </ul>
    <p v-if="failed" role="status" class="text-xs text-danger">No se pudo guardar tu reacción. Intenta de nuevo.</p>
  </div>
</template>
