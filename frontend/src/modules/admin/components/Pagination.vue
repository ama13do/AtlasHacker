<script setup lang="ts">
// Paginación simple: anterior / siguiente
defineProps<{ page: number; pages: number }>()
defineEmits<{ go: [page: number] }>()
</script>

<template>
  <nav v-if="pages > 1" class="flex items-center justify-center gap-3 text-sm" aria-label="Paginación">
    <button
      type="button"
      class="btn-hxnf btn-paper btn-sm"
      :disabled="page <= 1"
      @click="$emit('go', page - 1)"
    >
      Anterior
    </button>
    <span class="tabular-nums text-fg/70">Página {{ page }} de {{ pages }}</span>
    <button
      type="button"
      class="btn-hxnf btn-paper btn-sm"
      :disabled="page >= pages"
      @click="$emit('go', page + 1)"
    >
      Siguiente
    </button>
  </nav>
</template>
