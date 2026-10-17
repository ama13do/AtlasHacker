<script setup lang="ts">
import { openCookiePreferences } from '@/core/consent/consent'
import { LEGAL, LEGAL_ROUTES } from '@/core/legal/legal'
import BrandMark from '@/shared/components/BrandMark.vue'

// Pie de las páginas públicas: marca, navegación, documentos legales y preferencias de cookies
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t-2 border-ink">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm md:px-8">
      <BrandMark variant="full" size="sm" :label="null" />
      <p class="font-bold uppercase">
        Escucha · Registra · Verifica · Folia · <span class="hl-box hl-lime text-sm" style="--hl-delay: 0.8s">Pregunta</span>
      </p>
      <nav class="flex flex-wrap gap-4 font-semibold" aria-label="Pie de página">
        <RouterLink :to="{ name: 'my-folio' }" class="hover:underline">Mi folio</RouterLink>
        <a href="https://hxnf.mx" target="_blank" rel="noopener" class="hover:underline">hxnf.mx ↗</a>
      </nav>
    </div>
    <div class="border-t-2 border-ink/15">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4 text-xs md:px-8">
        <span class="opacity-70">© {{ year }} {{ LEGAL.marca }}</span>
        <nav class="flex flex-wrap gap-x-4 gap-y-2 font-semibold" aria-label="Legal">
          <RouterLink v-for="doc in LEGAL_ROUTES" :key="doc.name" :to="{ name: doc.name }" class="hover:underline">{{ doc.label }}</RouterLink>
          <button type="button" class="font-semibold hover:underline" @click="openCookiePreferences">Preferencias de cookies</button>
        </nav>
        <a :href="`mailto:${LEGAL.email}`" class="font-semibold hover:underline sm:ml-auto">{{ LEGAL.email }}</a>
      </div>
    </div>
  </footer>
</template>
