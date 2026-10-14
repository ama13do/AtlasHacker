<script setup lang="ts">
// Paginación simple: anterior / siguiente
defineProps<{ page: number; pages: number }>()
defineEmits<{ go: [page: number] }>()
</script>

<template>
  <nav v-if="pages > 1" class="flex items-center justify-center gap-3 text-sm" aria-label="Paginación">
    <button
      type="button"
      class="rounded-full border border-fg/25 px-4 py-1.5 font-semibold disabled:opacity-40"
      :disabled="page <= 1"
      @click="$emit('go', page - 1)"
    >
      Anterior
    </button>
    <span class="tabular-nums text-fg/70">Página {{ page }} de {{ pages }}</span>
    <button
      type="button"
      class="rounded-full border border-fg/25 px-4 py-1.5 font-semibold disabled:opacity-40"
      :disabled="page >= pages"
      @click="$emit('go', page + 1)"
    >
      Siguiente
    </button>
  </nav>
</template>
