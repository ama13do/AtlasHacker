<script setup lang="ts">
import { TOPIC_META } from '@testimonies/data/topics'
import type { Testimony } from '@testimonies/types/testimony'
import TopicIcon from '@testimonies/components/TopicIcon.vue'

defineProps<{ stories: Testimony[] }>()
defineEmits<{ open: [index: number] }>()

function shortPlace(place: string) {
  return place.split(',')[0]
}
</script>

<template>
  <ul
    class="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-2 md:justify-center-safe [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    aria-label="Testimonios más populares"
  >
    <li v-for="(story, i) in stories" :key="story.id" class="shrink-0 snap-start">
      <button
        type="button"
        class="group flex w-18 flex-col items-center gap-1.5 focus-visible:outline-none"
        :aria-label="`Ver historia: ${story.title}, ${story.place}`"
        @click="$emit('open', i)"
      >
        <span
          class="relative grid size-16 place-items-center rounded-full bg-black ring-2 ring-offset-2 ring-offset-black transition group-hover:scale-105 group-focus-visible:ring-white"
          :class="[i < 3 ? 'ring-neon-lime' : TOPIC_META[story.topic].ring, TOPIC_META[story.topic].text]"
        >
          <TopicIcon :topic="story.topic" class="size-7" />
          <span
            v-if="i < 3"
            class="absolute -bottom-1 rounded-full bg-neon-lime px-1.5 text-[10px] font-semibold leading-4 text-black"
          >
            Top
          </span>
        </span>
        <span class="w-full truncate text-center text-xs text-white/90">{{ shortPlace(story.place) }}</span>
      </button>
    </li>
  </ul>
</template>
