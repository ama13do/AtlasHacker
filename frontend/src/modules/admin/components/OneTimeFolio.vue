<script setup lang="ts">
import { ref } from 'vue'

// Folio de participante recién emitido: se muestra una sola vez (la API solo guarda su hash)
defineProps<{ folio: string; title?: string }>()

const copied = ref(false)
async function copy(folio: string) {
  try {
    await navigator.clipboard.writeText(folio)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Sin permiso de portapapeles: el folio sigue visible para copiarlo a mano
  }
}
</script>

<template>
  <section class="space-y-3 rounded-2xl border border-neon-lime/50 bg-neon-lime/10 p-4 light:border-fg/20 light:bg-neon-lime/35" role="status">
    <div>
      <h3 class="text-sm font-semibold">{{ title ?? 'Folio de la persona' }}</h3>
      <p class="text-xs text-fg/70">
        Cópialo ahora y entrégalo por un canal seguro: no se mostrará otra vez.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <code class="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 text-center font-mono text-sm font-semibold whitespace-nowrap select-all sm:text-base">
        {{ folio }}
      </code>
      <button
        type="button"
        class="shrink-0 rounded-full bg-fg px-4 py-2 text-sm font-semibold text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        @click="copy(folio)"
      >
        {{ copied ? 'Copiado' : 'Copiar' }}
      </button>
    </div>
  </section>
</template>
