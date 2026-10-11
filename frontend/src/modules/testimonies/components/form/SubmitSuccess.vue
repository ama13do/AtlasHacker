<script setup lang="ts">
import type { CreateTestimonyResult } from '@testimonies/types/testimony'

defineProps<{ result: CreateTestimonyResult }>()
defineEmits<{ viewOnMap: []; home: [] }>()
</script>

<template>
  <div class="flex flex-col items-center gap-6 py-10 text-center">
    <span class="grid size-16 place-items-center rounded-full bg-neon-lime text-black">
      <svg viewBox="0 0 24 24" class="size-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m5 12 5 5 9-10" />
      </svg>
    </span>

    <div class="space-y-2">
      <h2 class="text-2xl font-semibold">Gracias por tu testimonio</h2>
      <p class="text-fg/70">
        {{
          result.published
            ? 'Ya aparece en el mapa.'
            : 'Quedará en documentación interna o en revisión antes de publicarse.'
        }}
      </p>
    </div>

    <dl class="w-full max-w-sm space-y-2 rounded-2xl border border-fg/15 p-4 text-left text-sm">
      <div class="flex justify-between gap-3">
        <dt class="text-fg/50">Folio</dt>
        <dd class="font-semibold tabular-nums">{{ result.testimony.folio }}</dd>
      </div>
      <div v-if="result.evidenceFolio" class="flex justify-between gap-3">
        <dt class="text-fg/50">Folio de evidencia</dt>
        <dd class="font-semibold tabular-nums">{{ result.evidenceFolio }}</dd>
      </div>
    </dl>

    <div class="flex w-full max-w-sm flex-col gap-3">
      <button
        v-if="result.published"
        type="button"
        class="rounded-full bg-neon-lime py-3 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        @click="$emit('viewOnMap')"
      >
        Ver en el mapa
      </button>
      <button
        type="button"
        class="rounded-full border border-fg/30 py-3 font-semibold transition hover:border-fg focus-visible:outline-2 focus-visible:outline-fg"
        @click="$emit('home')"
      >
        Volver al inicio
      </button>
    </div>

    <p class="text-xs tracking-widest text-fg/50 uppercase">Escucha · Registra · Verifica · Protege</p>
  </div>
</template>
