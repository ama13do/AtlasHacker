<script setup lang="ts">
import { computed } from 'vue'
import { coverFor } from '@testimonies/data/covers'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { TestimonySummary } from '@testimonies/types/testimony'
import CategoryIcon from '@testimonies/components/CategoryIcon.vue'

const props = defineProps<{ testimony: TestimonySummary; active?: boolean }>()
defineEmits<{ select: [id: string]; hover: [id: string | null] }>()

const categories = useCategoriesStore()
const meta = computed(() => categories.bySlug(props.testimony.category))
const date = computed(() =>
  new Date(`${props.testimony.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
)
</script>

<template>
  <!-- Tarjeta: franja del color de la categoría, sticker, título, lugar y conteos con texto -->
  <button
    type="button"
    class="group relative flex w-full overflow-hidden rounded-[20px] border-2 border-ink bg-card text-left transition-[translate,box-shadow] duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brut-lg focus-visible:-translate-x-0.5 focus-visible:-translate-y-0.5 focus-visible:shadow-brut-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
    :class="active ? '-translate-x-0.5 -translate-y-0.5 shadow-brut-lg' : 'shadow-brut'"
    :aria-current="active ? 'true' : undefined"
    @click="$emit('select', testimony.id)"
    @mouseenter="$emit('hover', testimony.id)"
    @mouseleave="$emit('hover', null)"
    @focus="$emit('hover', testimony.id)"
    @blur="$emit('hover', null)"
  >
    <span class="relative grid w-20 shrink-0 place-items-center border-r-2 border-ink" :style="{ backgroundColor: meta.color }" aria-hidden="true">
      <img :src="coverFor(testimony)" alt="" class="cutout w-14 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" loading="lazy" />
    </span>
    <span class="min-w-0 flex-1 p-3">
      <span class="flex items-center gap-1.5 text-[11px] font-bold opacity-70">
        <CategoryIcon :category="testimony.category" class="size-3.5" />
        <span class="truncate">{{ meta.label }}</span>
      </span>
      <span class="mt-0.5 line-clamp-2 block text-[15px] leading-tight font-black">{{ testimony.title }}</span>
      <span class="mt-1 block truncate text-xs font-semibold opacity-70">
        <svg viewBox="0 0 24 24" class="-mt-0.5 mr-0.5 inline size-3" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /></svg>
        {{ testimony.place }}
      </span>
      <span class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold opacity-70">
        <span>{{ date }}</span>
        <span>{{ testimony.reactions }} {{ testimony.reactions === 1 ? 'reacción' : 'reacciones' }}</span>
        <span>{{ testimony.comments }} {{ testimony.comments === 1 ? 'comentario' : 'comentarios' }}</span>
      </span>
    </span>
    <span class="grid w-8 shrink-0 place-items-center opacity-40 transition group-hover:opacity-100" aria-hidden="true">
      <svg viewBox="0 0 24 24" class="size-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </span>
  </button>
</template>
