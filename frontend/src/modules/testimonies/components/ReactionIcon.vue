<script setup lang="ts">
import type { ReactionType } from '@testimonies/types/testimony'

defineProps<{ type: ReactionType; filled?: boolean }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- Corazón: Me importa -->
    <path v-if="type === 'like'" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" :fill="filled ? 'currentColor' : 'none'" />
    <!-- Puño en alto: Apoyo -->
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
    <!-- Fuego: Urgente -->
    <path v-else d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
  </svg>
</template>
