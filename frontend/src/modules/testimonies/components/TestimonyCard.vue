<script setup lang="ts">
import { computed } from 'vue'
import { EVIDENCE_LABELS } from '@testimonies/data/topics'
import type { Testimony } from '@testimonies/types/testimony'
import TopicBadge from '@testimonies/components/TopicBadge.vue'

const props = defineProps<{ testimony: Testimony }>()
defineEmits<{ close: [] }>()

const DOCUMENT_STATUS = { si: 'Sí', no: 'No', pendiente: 'Pendiente' } as const

const date = computed(() =>
  new Date(`${props.testimony.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
)
const author = computed(() =>
  props.testimony.author.visibility === 'nombre' && props.testimony.author.name ? props.testimony.author.name : 'Anónimo',
)
</script>

<template>
  <aside
    class="flex max-h-[60dvh] flex-col overflow-hidden rounded-t-3xl border-t border-fg/15 bg-surface shadow-2xl md:max-h-none md:rounded-3xl md:border"
    :aria-label="`Testimonio ${testimony.folio}`"
  >
    <!-- Asa del bottom sheet (móvil) -->
    <div class="flex justify-center pt-2 md:hidden" aria-hidden="true">
      <span class="h-1 w-10 rounded-full bg-fg/30" />
    </div>

    <header class="flex items-start justify-between gap-3 px-5 pt-3 pb-4 md:pt-5">
      <div class="min-w-0 space-y-2">
        <TopicBadge :topic="testimony.topic" />
        <h2 class="text-xl leading-tight font-semibold">{{ testimony.title }}</h2>
        <p class="text-sm text-fg/70">{{ testimony.place }}</p>
        <p class="text-xs text-fg/50">{{ testimony.folio }} · {{ date }} · {{ author }}</p>
      </div>
      <button
        type="button"
        class="grid size-9 shrink-0 place-items-center rounded-full bg-fg/10 hover:bg-fg/20 focus-visible:outline-2 focus-visible:outline-fg"
        aria-label="Cerrar testimonio"
        @click="$emit('close')"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </header>

    <div class="space-y-5 overflow-y-auto px-5 pb-6 [scrollbar-color:color-mix(in_oklab,var(--fg)_25%,transparent)_transparent] [scrollbar-width:thin] text-sm leading-relaxed text-fg/85">
      <section>
        <h3 class="section-title">1 · El testimonio</h3>
        <p>{{ testimony.testimony }}</p>
      </section>

      <section>
        <h3 class="section-title">2 · El territorio dice</h3>
        <p>{{ testimony.territory }}</p>
      </section>

      <section>
        <h3 class="section-title">3 · La comunidad dice</h3>
        <p>{{ testimony.community }}</p>
      </section>

      <section>
        <h3 class="section-title">4 · El recibo / documento dice</h3>
        <p class="text-fg/60">
          Evidencia: <span class="font-semibold text-fg">{{ DOCUMENT_STATUS[testimony.document.status] }}</span>
          <template v-if="testimony.document.folio"> · {{ testimony.document.folio }}</template>
        </p>
        <p v-if="testimony.document.description" class="mt-1">{{ testimony.document.description }}</p>
      </section>

      <section v-if="testimony.data">
        <h3 class="section-title">5 · Los datos dicen</h3>
        <p>
          {{ testimony.data.text }}
          <template v-if="testimony.data.source || testimony.data.year">
            <span class="text-fg/60">
              — {{ [testimony.data.source, testimony.data.year].filter(Boolean).join(', ') }}
            </span>
          </template>
        </p>
        <p
          v-if="testimony.data.pendingVerification"
          class="mt-2 inline-flex rounded-full border border-brand-orange/50 px-2.5 py-0.5 text-xs text-danger"
        >
          Fuente pendiente de verificación
        </p>
      </section>

      <section class="rounded-2xl border border-neon-lime/40 light:border-fg/15 bg-neon-lime/10 light:bg-neon-lime/35 p-4">
        <h3 class="text-xs font-semibold tracking-wide text-accent-ink uppercase">6 · La pregunta del Tribunal</h3>
        <p class="mt-1 text-base font-semibold text-accent-ink">{{ testimony.tribunalQuestion }}</p>
      </section>

      <section>
        <h3 class="section-title">Evidencias que acompañan</h3>
        <ul class="flex flex-wrap gap-2">
          <li
            v-for="item in testimony.evidence"
            :key="item"
            class="rounded-full border border-fg/25 px-2.5 py-0.5 text-xs text-fg/85"
          >
            {{ EVIDENCE_LABELS[item] }}
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>

<style scoped>
@reference "@/style.css";

.section-title {
  @apply mb-1 text-xs font-semibold tracking-wide text-fg/50 uppercase;
}
</style>
