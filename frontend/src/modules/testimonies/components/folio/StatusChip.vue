<script setup lang="ts">
import { computed } from 'vue'
import type { MyTestimony } from '@testimonies/types/testimony'

// Estado de revisión de un testimonio propio
const props = defineProps<{ testimony: Pick<MyTestimony, 'status' | 'active' | 'public'> }>()

const chip = computed(() => {
  const t = props.testimony
  if (!t.active) return { label: 'Dado de baja', class: 'border border-fg/25 text-fg/60' }
  if (t.status === 'rechazado') return { label: 'No publicado', class: 'bg-brand-orange text-black' }
  if (t.status === 'pendiente') return { label: 'En revisión', class: 'bg-neon-lime text-black' }
  return t.public
    ? { label: 'Publicado', class: 'bg-neon-green text-black' }
    : { label: 'Aprobado · no público', class: 'border border-fg/25 text-fg/70' }
})
</script>

<template>
  <span class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="chip.class">
    {{ chip.label }}
  </span>
</template>
