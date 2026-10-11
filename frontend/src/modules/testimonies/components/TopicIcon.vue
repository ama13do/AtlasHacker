<script setup lang="ts">
import type { Topic } from '@testimonies/types/testimony'

defineProps<{ topic: Topic }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- Rayo: transición energética -->
    <path v-if="topic === 'transicion'" d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    <!-- Nube/humo: contaminación -->
    <template v-else-if="topic === 'contaminacion'">
      <path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.78A6 6 0 1 0 6 16.5" />
      <path d="M6 19h11.5" />
    </template>
    <!-- Alerta: suceso -->
    <template v-else>
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </template>
  </svg>
</template>
