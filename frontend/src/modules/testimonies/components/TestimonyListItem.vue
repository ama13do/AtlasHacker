<script setup lang="ts">
import { computed } from 'vue'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { TestimonySummary } from '@testimonies/types/testimony'
import CategoryIcon from '@testimonies/components/CategoryIcon.vue'

const props = defineProps<{ testimony: TestimonySummary }>()
defineEmits<{ select: [id: string] }>()

const categories = useCategoriesStore()
const meta = computed(() => categories.bySlug(props.testimony.category))
const date = computed(() =>
  new Date(`${props.testimony.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
)
</script>

<template>
  <button
    type="button"
    class="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-fg"
    @click="$emit('select', testimony.id)"
  >
    <span
      class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-surface ring-2"
      :class="[meta.ring, meta.text, meta.chip]"
      aria-hidden="true"
    >
      <CategoryIcon :category="testimony.category" class="size-4" />
    </span>
    <span class="min-w-0 flex-1 space-y-1">
      <span class="line-clamp-2 block text-sm leading-snug font-semibold">{{ testimony.title }}</span>
      <span class="block truncate text-xs text-fg/60">{{ testimony.place }}</span>
      <span class="flex items-center gap-3 text-xs text-fg/50">
        <span>{{ date }}</span>
        <span class="inline-flex items-center gap-1" :aria-label="`${testimony.reactions} reacciones`">
          <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
          {{ testimony.reactions }}
        </span>
      </span>
    </span>
  </button>
</template>
