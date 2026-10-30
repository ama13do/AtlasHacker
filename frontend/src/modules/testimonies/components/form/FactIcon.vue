<script setup lang="ts">
import type { FactKey } from '@testimonies/data/facts'

// Íconos de «¿Qué pasa?» (trazos del prototipo v2, estilo sticker)
defineProps<{ fact: FactKey }>()
</script>

<template>
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- Foco tachado -->
    <template v-if="fact === 'apagones'">
      <path d="M14 26 C9 22 9 12 20 9 C31 12 31 22 26 26 V30 H14 Z" />
      <path d="M16 34 H24" />
      <path d="M6 6 L34 34" />
    </template>
    <!-- Tijeras -->
    <template v-else-if="fact === 'cortes_sin_aviso'">
      <circle cx="11" cy="28" r="4" />
      <circle cx="11" cy="12" r="4" />
      <path d="M14 14 L34 30 M14 26 L34 10" />
    </template>
    <!-- Recibo -->
    <template v-else-if="fact === 'recibo_impagable'">
      <path d="M10 5 H30 V35 L26 32 L22 35 L18 32 L14 35 L10 32 Z" />
      <path d="M15 13 H25 M15 19 H25" />
      <path d="M20 23 V29 M17 25 C17 23 23 23 23 25 C23 27 17 27 17 29 C17 31 23 31 23 29" />
    </template>
    <!-- Casa tachada -->
    <template v-else-if="fact === 'sin_luz'">
      <path d="M8 18 L20 8 L32 18 V34 H8 Z" />
      <path d="M17 34 V24 H23 V34" />
      <path d="M5 5 L35 35" />
    </template>
    <!-- Termómetro -->
    <template v-else-if="fact === 'calor_clima'">
      <path d="M17 7 V24 A6 6 0 1 0 23 24 V7 A3 3 0 0 0 17 7 Z" />
      <path d="M20 14 V27" />
      <path d="M30 8 L34 6 M30 15 H35 M30 22 L34 24" />
    </template>
    <!-- Panel solar -->
    <template v-else-if="fact === 'paneles_bloqueados'">
      <path d="M6 26 L12 12 H34 L28 26 Z" />
      <path d="M9 19 H31 M17 12 L13 26 M25 12 L21 26" />
      <path d="M18 26 V33 M13 33 H23" />
    </template>
    <!-- Torre y grúa -->
    <template v-else-if="fact === 'proyecto_territorio'">
      <path d="M8 35 L16 8 H18 L26 35" />
      <path d="M11 25 H23 M13 17 H21" />
      <path d="M17 8 L33 8 M33 8 V16" />
      <path d="M30 16 H36 V20 H30 Z" />
    </template>
    <!-- Puntos suspensivos -->
    <template v-else>
      <circle cx="10" cy="20" r="2.5" />
      <circle cx="20" cy="20" r="2.5" />
      <circle cx="30" cy="20" r="2.5" />
    </template>
  </svg>
</template>
