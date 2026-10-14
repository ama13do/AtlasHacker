<script setup lang="ts">
import OneTimeSecret from '@admin/components/OneTimeSecret.vue'

// Folio de participante recién emitido (una sola vez)
defineProps<{ folio: string; title?: string }>()
</script>

<template>
  <OneTimeSecret :value="folio" :title="title ?? 'Folio de la persona'" />
</template>
