<script setup lang="ts">
// Aviso cuando no hay testimonios que mostrar: sin publicados todavía o error al cargar
defineProps<{ kind: 'empty' | 'error' }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-6 py-8 text-center" :role="kind === 'error' ? 'alert' : 'status'">
    <template v-if="kind === 'empty'">
      <p class="font-wide text-lg font-black uppercase">Aún no hay testimonios publicados</p>
      <p class="text-sm text-fg/60">Lo que pasa en tu territorio también cuenta. Comparte el primero.</p>
      <RouterLink
        :to="{ name: 'testimony-new' }"
        class="btn-hxnf btn-lime btn-sm mt-1"
      >
        Comparte el primero
      </RouterLink>
    </template>
    <template v-else>
      <p class="font-wide text-lg font-black uppercase">No pudimos cargar los testimonios</p>
      <p class="text-sm text-fg/60">Revisa tu conexión e intenta de nuevo.</p>
      <button
        type="button"
        class="btn-hxnf btn-paper btn-sm mt-1"
        @click="$emit('retry')"
      >
        Reintentar
      </button>
    </template>
  </div>
</template>
