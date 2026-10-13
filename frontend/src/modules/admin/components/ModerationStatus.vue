<script setup lang="ts">
import { computed } from 'vue'
import type { EstadoModeracion } from '@admin/types/api'

// Estado de un testimonio para el equipo: moderación + si está en el mapa o dado de baja
const props = defineProps<{ estado: EstadoModeracion; activo: boolean; publico: boolean }>()

const chip = computed(() => {
  if (!props.activo) return { label: 'Dado de baja', class: 'border border-fg/25 text-fg/60' }
  if (props.estado === 'pendiente') return { label: 'Pendiente', class: 'bg-neon-lime text-black' }
  if (props.estado === 'rechazado') return { label: 'Rechazado', class: 'bg-brand-orange text-black' }
  return props.publico
    ? { label: 'Publicado', class: 'bg-neon-green text-black' }
    : { label: 'Aprobado · no público', class: 'border border-fg/25 text-fg/70' }
})
</script>

<template>
  <span class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap" :class="chip.class">
    {{ chip.label }}
  </span>
</template>
