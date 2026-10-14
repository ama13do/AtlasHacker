<script setup lang="ts">
import { ref } from 'vue'

// Dato secreto recién emitido (folio, contraseña temporal): se muestra una sola vez (la API solo guarda su hash)
defineProps<{ value: string; title: string; hint?: string }>()

const copied = ref(false)
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Sin permiso de portapapeles: el dato sigue visible para copiarlo a mano
  }
}
</script>

<template>
  <section class="space-y-3 rounded-[20px] border-2 border-black bg-neon-lime p-4 text-black shadow-[4px_4px_0_0_#000]" role="status">
    <div>
      <h3 class="text-sm font-black uppercase">{{ title }}</h3>
      <p class="text-xs opacity-75">
        {{ hint ?? 'Cópialo ahora y entrégalo por un canal seguro: no se mostrará otra vez.' }}
      </p>
    </div>
    <div class="flex items-center gap-2">
      <code class="min-w-0 flex-1 rounded-xl border-2 border-black bg-white px-3 py-2 text-center font-mono text-sm font-semibold whitespace-nowrap select-all sm:text-base">
        {{ value }}
      </code>
      <button
        type="button"
        class="btn-hxnf btn-ink btn-sm shrink-0"
        @click="copy(value)"
      >
        {{ copied ? 'Copiado' : 'Copiar' }}
      </button>
    </div>
  </section>
</template>
