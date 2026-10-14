<script setup lang="ts">
import { useRoute } from 'vue-router'
import BrandMark from '@/shared/components/BrandMark.vue'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'

// Encabezado de las páginas públicas, como el de hxnf.mx: borde de tinta, navegación en
// mayúsculas y la sección activa en una etiqueta de color girada con sombra dura
const route = useRoute()

const LINKS = [
  { label: 'Mapas', to: { name: 'home' }, match: ['home', 'map', 'testimony-new'], active: 'bg-neon-green -rotate-1' },
  { label: 'Mi folio', to: { name: 'my-folio' }, match: ['my-folio', 'my-testimony-edit'], active: 'bg-brand-pink rotate-1' },
] as const
</script>

<template>
  <header class="sticky top-0 z-30 border-b-2 border-ink bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
    <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-8">
      <RouterLink :to="{ name: 'home' }" class="shrink-0 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand-blue" aria-label="Atlas de Hackers x Nuestro Futuro, inicio">
        <span class="sm:hidden"><BrandMark variant="acronym" size="sm" /></span>
        <span class="hidden sm:inline"><BrandMark /></span>
      </RouterLink>

      <nav class="ml-auto flex items-center gap-1 text-xs font-bold uppercase sm:text-sm md:gap-3 md:text-base" aria-label="Principal">
        <RouterLink
          v-for="link in LINKS"
          :key="link.label"
          :to="link.to"
          class="border-2 px-2 py-1 whitespace-nowrap transition-all focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-blue md:px-3"
          :class="
            link.match.includes(String(route.name) as never)
              ? ['border-black text-black shadow-[3px_3px_0_0_#000]', link.active]
              : 'border-transparent hover:text-accent-ink hover:underline'
          "
          :aria-current="link.match.includes(String(route.name) as never) ? 'page' : undefined"
        >
          {{ link.label }}
        </RouterLink>
        <a
          href="https://hxnf.mx"
          target="_blank"
          rel="noopener"
          class="hidden border-2 border-transparent px-3 py-1 hover:underline focus-visible:outline-3 focus-visible:outline-brand-blue lg:inline-flex"
        >
          hxnf.mx ↗
        </a>
      </nav>
      <ThemeToggle />
    </div>
  </header>
</template>
