<script setup lang="ts">
import { computed } from 'vue'
import { categoryStyle } from '@testimonies/data/categories'
import type { CategorySlug } from '@testimonies/types/testimony'

const props = defineProps<{ category: CategorySlug }>()
const icon = computed(() => categoryStyle(props.category).icon)
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- Rayo: inseguridad energética -->
    <path v-if="icon === 'zap'" d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    <!-- Nube con lluvia: cambio climático -->
    <template v-else-if="icon === 'cloud'">
      <path d="M20 16.6A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
      <path d="M8 19v2M8 13v2M16 19v2M16 13v2M12 21v2M12 15v2" />
    </template>
    <!-- Fábrica: megaproyectos -->
    <template v-else-if="icon === 'factory'">
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M17 18h1M12 18h1M7 18h1" />
    </template>
    <!-- Categoría sin ícono propio -->
    <circle v-else cx="12" cy="12" r="5" />
  </svg>
</template>
