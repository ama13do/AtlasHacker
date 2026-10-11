<script setup lang="ts">
import { computed } from 'vue'
import { TOPIC_META } from '@testimonies/data/topics'
import type { Topic } from '@testimonies/types/testimony'
import TopicIcon from '@testimonies/components/TopicIcon.vue'

const props = defineProps<{ topic: Topic }>()
const meta = computed(() => TOPIC_META[props.topic])
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-black"
    :class="meta.bg"
  >
    <TopicIcon :topic="topic" class="size-3.5" />
    {{ meta.label }}
  </span>
</template>
