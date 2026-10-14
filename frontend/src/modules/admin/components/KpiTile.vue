<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

// Número destacado con contexto. `alert` resalta algo que requiere atención (con texto, no solo color)
defineProps<{ label: string; value: string | number; detail?: string; alert?: string; to?: RouteLocationRaw }>()
</script>

<template>
  <component
    :is="to ? 'RouterLink' : 'div'"
    :to="to"
    class="flex flex-col gap-1 rounded-[22px] border-2 border-ink bg-card p-4 shadow-brut"
    :class="{ 'card-lift focus-visible:outline-3 focus-visible:outline-brand-blue': to }"
  >
    <span class="text-[11px] font-black tracking-wider uppercase opacity-65">{{ label }}</span>
    <span class="font-wide text-4xl leading-none font-black tabular-nums">{{ value }}</span>
    <span v-if="detail" class="text-xs font-semibold opacity-65">{{ detail }}</span>
    <span v-if="alert" class="chip mt-1 w-fit border-black bg-brand-orange text-black">
      <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <path d="M12 8v5M12 17h.01" />
        <circle cx="12" cy="12" r="10" />
      </svg>
      {{ alert }}
    </span>
  </component>
</template>
