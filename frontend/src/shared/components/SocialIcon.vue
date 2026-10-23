<script setup lang="ts">
import type { SocialId } from '@/core/config/brand'

// Ícono de red social con el mismo trazo que el resto de los íconos del sitio
defineProps<{ id: SocialId }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="id === 'instagram'">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" />
    </template>
    <path v-else-if="id === 'tiktok'" d="M9.5 11.5a4 4 0 1 0 4 4V3c.4 2.6 2.5 4.6 5.2 4.8" />
    <template v-else-if="id === 'youtube'">
      <path d="M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </template>
    <path v-else d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
</template>
