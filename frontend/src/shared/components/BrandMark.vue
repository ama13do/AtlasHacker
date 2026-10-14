<script setup lang="ts">
// Marca tipográfica: «Atlas» en caja verde con sombra dura + firma de Hackers x Nuestro Futuro
withDefaults(defineProps<{ size?: 'sm' | 'md'; subtitle?: string }>(), { size: 'md', subtitle: 'Hackers x Nuestro Futuro' })
</script>

<template>
  <span class="inline-flex items-center gap-2.5">
    <span
      class="hl-box hl-green leading-none font-black tracking-tight uppercase"
      :class="size === 'sm' ? 'text-lg' : 'text-xl md:text-2xl'"
      style="--hl-rot: -2deg"
    >
      Atlas
    </span>
    <span class="hidden flex-col leading-none sm:flex">
      <span class="text-[10px] font-bold tracking-[0.14em] uppercase opacity-70" :class="{ 'md:text-[11px]': size === 'md' }">{{ subtitle }}</span>
    </span>
  </span>
</template>
