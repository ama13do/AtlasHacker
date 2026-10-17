<script setup lang="ts">
import { computed } from 'vue'
import type { ThemedLogo } from '@/core/config/brand'
import { useTheme } from '@/core/theme/useTheme'

// Logo de la campaña de un mapa (p. ej. «Juicios x Nuestro Futuro»). Sigue el tema (letras negras en claro,
// blancas en oscuro) salvo que `tone` lo fije: 'ink' para fondos de color (historias), 'paper' para fondos negros
const props = withDefaults(defineProps<{ logo: ThemedLogo; alt: string; tone?: 'auto' | 'ink' | 'paper' }>(), { tone: 'auto' })

const { theme } = useTheme()
const src = computed(() => (props.tone === 'ink' ? props.logo.light : props.tone === 'paper' ? props.logo.dark : props.logo[theme.value]))
</script>

<template>
  <img :src="src" :alt="alt" class="block select-none" draggable="false" />
</template>
