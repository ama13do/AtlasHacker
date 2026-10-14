<script setup lang="ts">
import { coverFor } from '@testimonies/data/covers'
import { categoryStyle } from '@testimonies/data/categories'
import type { TestimonySummary } from '@testimonies/types/testimony'

defineProps<{ stories: TestimonySummary[]; loading?: boolean }>()
defineEmits<{ open: [index: number] }>()

function shortPlace(place: string) {
  return place.split(',')[0]
}
</script>

<template>
  <div>
    <!-- Cargando: círculos en esqueleto -->
    <ul
      v-if="loading"
      class="flex gap-4 overflow-hidden px-4 py-2 md:justify-center"
      aria-hidden="true"
    >
      <li v-for="n in 6" :key="n" class="flex w-18 shrink-0 flex-col items-center gap-1.5">
        <span class="size-16 animate-pulse rounded-full border-2 border-ink/20 bg-fg/10" />
        <span class="h-3 w-12 animate-pulse rounded-full bg-fg/10" />
      </li>
    </ul>
    <p v-if="!loading && stories.length" class="flex justify-center px-4" aria-hidden="true">
      <span class="rounded-full border-2 border-black bg-white px-2.5 py-0.5 text-[10px] font-black tracking-wider text-black uppercase">
        Historias · los más apoyados — toca para verlas
      </span>
    </p>
    <ul
      v-if="!loading && stories.length"
      class="flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 py-2 md:justify-center-safe [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Testimonios más populares"
    >
      <li v-for="(story, i) in stories" :key="story.id" class="tm-stagger shrink-0 snap-start" :style="{ '--i': i }">
        <button
          type="button"
          class="group flex w-18 flex-col items-center gap-1.5 focus-visible:outline-none"
          :aria-label="`Ver historia: ${story.title}, ${story.place}`"
          @click="$emit('open', i)"
        >
          <span
            class="relative grid size-16 place-items-center rounded-full border-[2.5px] border-black bg-card shadow-[3px_3px_0_0_#000] transition group-hover:-translate-y-0.5 group-hover:rotate-3 group-hover:shadow-[5px_5px_0_0_#000] group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-brand-blue"
            :style="{ backgroundColor: i < 3 ? '#e0fa49' : categoryStyle(story.category).color }"
          >
            <img :src="coverFor(story)" alt="" class="cutout size-11 object-contain" loading="lazy" decoding="async" />
            <span
              v-if="i < 3"
              class="absolute -bottom-1.5 rounded-full border-2 border-black bg-black px-1.5 text-[10px] leading-3.5 font-black text-neon-lime uppercase"
            >
              Top
            </span>
          </span>
          <span class="w-full truncate text-center text-[11px] font-bold">{{ shortPlace(story.place) }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
