<script setup lang="ts">
import { computed } from 'vue'

// Testimonios por entidad (top N): una sola magnitud en un solo tono; públicos como texto
const props = defineProps<{ rows: { entidad: string; total: number; publicos: number }[]; limit?: number }>()

const top = computed(() => props.rows.slice(0, props.limit ?? 10))
const max = computed(() => Math.max(1, ...top.value.map((r) => r.total)))
</script>

<template>
  <figure class="space-y-3">
    <figcaption class="text-sm font-semibold">Por entidad</figcaption>
    <p v-if="!top.length" class="text-sm text-fg/50">Sin datos.</p>
    <ul v-else class="space-y-2.5">
      <li v-for="r in top" :key="r.entidad" class="space-y-1">
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span class="truncate">{{ r.entidad }}</span>
          <span class="shrink-0 tabular-nums"><span class="font-semibold">{{ r.total }}</span> <span class="text-xs text-fg/50">({{ r.publicos }} públicos)</span></span>
        </div>
        <div class="h-2 rounded-full bg-fg/10" aria-hidden="true">
          <div class="h-full rounded-full bg-chart-1" :style="{ width: `${(r.total / max) * 100}%`, minWidth: r.total ? '4px' : '0' }" />
        </div>
      </li>
    </ul>
  </figure>
</template>
