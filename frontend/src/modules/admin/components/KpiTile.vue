<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

// Número destacado con contexto. `alert` resalta algo que requiere atención (con texto, no solo color)
defineProps<{ label: string; value: string | number; detail?: string; alert?: string; to?: RouteLocationRaw }>()
</script>

<template>
  <component
    :is="to ? 'RouterLink' : 'div'"
    :to="to"
    class="flex flex-col gap-1 rounded-2xl border border-fg/15 p-4"
    :class="{ 'transition hover:border-fg/40 focus-visible:outline-2 focus-visible:outline-fg': to }"
  >
    <span class="text-xs font-semibold tracking-wide text-fg/60 uppercase">{{ label }}</span>
    <span class="text-3xl font-semibold tabular-nums">{{ value }}</span>
    <span v-if="detail" class="text-xs text-fg/60">{{ detail }}</span>
    <span
      v-if="alert"
      class="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-brand-orange px-2 py-0.5 text-xs font-semibold text-black"
    >
      <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <path d="M12 8v5M12 17h.01" />
        <circle cx="12" cy="12" r="10" />
      </svg>
      {{ alert }}
    </span>
  </component>
</template>
