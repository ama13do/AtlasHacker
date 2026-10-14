<script setup lang="ts">
import { computed } from 'vue'
import { LOGOS } from '@/core/config/brand'
import { useTheme } from '@/core/theme/useTheme'

// Marca: el logo oficial de Hackers x Nuestro Futuro (o su acrónimo) y la etiqueta del producto.
// El nombre nunca se escribe a mano: es el logo.
const props = withDefaults(defineProps<{ size?: 'sm' | 'md'; variant?: 'full' | 'acronym'; label?: string | null }>(), {
  size: 'md',
  variant: 'full',
  label: 'Atlas',
})

const { theme } = useTheme()
const src = computed(() => LOGOS[props.variant === 'full' ? 'hackers' : 'hxnf'][theme.value])
const height = computed(() => (props.variant === 'full' ? (props.size === 'sm' ? 'h-7' : 'h-8 md:h-10') : props.size === 'sm' ? 'h-6' : 'h-7 md:h-8'))
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <img :src="src" alt="Hackers x Nuestro Futuro" :class="height" class="w-auto" />
    <span
      v-if="label"
      class="rounded-full border-2 border-black bg-neon-lime px-2 py-0.5 text-[11px] leading-none font-black tracking-wide text-black uppercase shadow-[2px_2px_0_0_#000]"
      :class="{ 'md:text-xs': size === 'md' }"
    >
      {{ label }}
    </span>
  </span>
</template>
