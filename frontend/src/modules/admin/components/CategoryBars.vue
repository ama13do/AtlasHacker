<script setup lang="ts">
import { computed } from 'vue'
import { categoryStyle } from '@/modules/testimonies'

// Testimonios por categoría: una sola magnitud (total) en un solo tono; el punto de color identifica
// la categoría y públicos/pendientes van como texto
const props = defineProps<{ rows: { slug: string; nombre: string; total: number; publicos: number; pendientes: number }[] }>()

const max = computed(() => Math.max(1, ...props.rows.map((r) => r.total)))
</script>

<template>
  <figure class="space-y-3">
    <figcaption class="text-sm font-semibold">Por categoría</figcaption>
    <ul class="space-y-3">
      <li v-for="r in rows" :key="r.slug" class="space-y-1.5">
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span class="inline-flex min-w-0 items-center gap-2">
            <span class="size-2.5 shrink-0 rounded-full" :class="categoryStyle(r.slug).bg" aria-hidden="true" />
            <span class="truncate">{{ r.nombre }}</span>
          </span>
          <span class="shrink-0 font-semibold tabular-nums">{{ r.total }}</span>
        </div>
        <div class="h-2 rounded-full bg-fg/10" aria-hidden="true">
          <div
            class="h-full rounded-full bg-chart-1 transition-[width]"
            :style="{ width: `${(r.total / max) * 100}%`, minWidth: r.total ? '4px' : '0' }"
          />
        </div>
        <p class="text-xs text-fg/60 tabular-nums">{{ r.publicos }} públicos · {{ r.pendientes }} pendientes</p>
      </li>
    </ul>
  </figure>
</template>
