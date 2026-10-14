<script setup lang="ts">
import { ref, useId } from 'vue'

// Ayuda desplegable de una pregunta: para qué sirve y un ejemplo (Manual para llenar testimonios)
defineProps<{ help?: string; example?: string; label?: string }>()

const open = ref(false)
const panelId = useId()
</script>

<template>
  <div>
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/30 px-2.5 py-0.5 text-[11px] font-bold text-fg/75 transition hover:border-ink hover:bg-neon-lime hover:text-black focus-visible:outline-3 focus-visible:outline-brand-blue"
      :class="{ 'border-ink bg-neon-lime text-black': open }"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
    >
      <span class="grid size-4 place-items-center rounded-full bg-black text-[10px] text-neon-lime" aria-hidden="true">?</span>
      {{ label ?? '¿Qué poner aquí?' }}
    </button>
    <div v-show="open" :id="panelId" class="mt-2 space-y-2 rounded-2xl border-2 border-ink bg-neon-lime/20 p-3 text-xs leading-relaxed">
      <p v-if="help">{{ help }}</p>
      <p v-if="example" class="border-l-4 border-black pl-2.5 italic dark:border-neon-lime">
        <span class="not-italic font-bold">Ejemplo: </span>{{ example }}
      </p>
    </div>
  </div>
</template>
