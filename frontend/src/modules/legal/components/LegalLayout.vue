<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LEGAL, LEGAL_ROUTES } from '@/core/legal/legal'
import SiteFooter from '@/shared/components/SiteFooter.vue'
import SiteHeader from '@/shared/components/SiteHeader.vue'

// Página de un documento legal: título, versión, índice (fijo a un lado en escritorio) y el texto
const props = defineProps<{ title: string; kicker: string; intro: string; sections: { id: string; title: string }[]; current: keyof typeof LEGAL_ROUTES }>()

// El índice arranca abierto en pantallas grandes y cerrado en celular (no tapa el texto)
const tocOpen = ref(false)
onMounted(() => {
  document.title = `${props.title} · Atlas HxNF`
  tocOpen.value = window.matchMedia('(min-width: 1024px)').matches
})
</script>

<template>
  <div class="min-h-dvh overflow-x-clip">
    <SiteHeader />

    <main class="mx-auto max-w-6xl px-4 pt-8 pb-20 md:px-8 md:pt-12">
      <!-- Documentos legales -->
      <nav class="flex flex-wrap gap-2" aria-label="Documentos legales">
        <RouterLink
          v-for="(doc, key) in LEGAL_ROUTES"
          :key="key"
          :to="{ name: doc.name }"
          class="chip px-3 py-1.5 text-xs transition"
          :class="key === current ? 'bg-fg text-surface' : 'bg-card hover:bg-neon-lime hover:text-black'"
          :aria-current="key === current ? 'page' : undefined"
        >
          {{ doc.label }}
        </RouterLink>
      </nav>

      <header class="mt-6 max-w-3xl">
        <p class="text-xs font-black tracking-widest uppercase opacity-60">{{ kicker }}</p>
        <h1 class="mt-2 text-3xl leading-[1.15] font-black uppercase md:text-5xl">
          <span class="hl-box hl-wrap hl-lime" style="--hl-rot: -1deg">{{ title }}</span>
        </h1>
        <p class="mt-4 leading-relaxed opacity-85">{{ intro }}</p>
        <p class="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <span class="chip bg-card px-2.5 py-1">Versión {{ LEGAL.version }}</span>
          <span class="chip bg-card px-2.5 py-1">Última actualización: {{ LEGAL.updatedAt }}</span>
        </p>
      </header>

      <div class="mt-10 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <!-- Índice -->
        <aside class="lg:sticky lg:top-24 lg:self-start" aria-label="Contenido">
          <details class="card-brut group p-4" :open="tocOpen">
            <summary class="cursor-pointer list-none text-xs font-black tracking-widest uppercase lg:pointer-events-none">
              Contenido <span class="float-right transition group-open:rotate-180 lg:hidden" aria-hidden="true">▾</span>
            </summary>
            <ol class="mt-3 space-y-1.5 text-sm">
              <li v-for="(s, i) in sections" :key="s.id" class="flex gap-2">
                <span class="w-5 shrink-0 font-black tabular-nums opacity-50">{{ i + 1 }}</span>
                <a :href="`#${s.id}`" class="leading-snug hover:underline">{{ s.title }}</a>
              </li>
            </ol>
          </details>
        </aside>

        <article class="legal-prose card-brut-lg min-w-0 p-6 md:p-10">
          <slot />
          <section class="mt-10 rounded-2xl border-2 border-black bg-neon-lime p-5 text-black on-light">
            <h2 class="!mt-0 !text-base">¿Dudas o quieres ejercer tus derechos?</h2>
            <p class="!mb-0">
              Escríbenos a <a :href="`mailto:${LEGAL.email}`" class="font-black underline">{{ LEGAL.email }}</a>. Respondemos en un máximo de 20 días hábiles.
            </p>
          </section>
        </article>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>
