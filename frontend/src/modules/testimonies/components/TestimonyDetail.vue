<script setup lang="ts">
import { computed, ref } from 'vue'
import { EVIDENCE_LABELS } from '@testimonies/data/categories'
import type { LoadStatus } from '@testimonies/stores/testimonies'
import type { TestimonyDetail, TestimonySummary } from '@testimonies/types/testimony'
import CategoryBadge from '@testimonies/components/CategoryBadge.vue'

// El encabezado sale del resumen (inmediato); el cuerpo, de la ficha completa cuando llega
const props = defineProps<{ testimony: TestimonySummary; detail: TestimonyDetail | null; status?: LoadStatus }>()
defineEmits<{ retry: [] }>()

const DOCUMENT_STATUS = { si: 'Sí', no: 'No', pendiente: 'Pendiente' } as const

const date = computed(() =>
  new Date(`${props.testimony.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
)
const author = computed(() => {
  if (!props.detail) return null
  return props.detail.author.visibility === 'nombre' && props.detail.author.name ? props.detail.author.name : 'Anónimo'
})
const title = computed(() => props.detail?.title ?? props.testimony.title)

const titleRef = ref<HTMLHeadingElement | null>(null)
defineExpose({ focusTitle: () => titleRef.value?.focus() })
</script>

<template>
  <article :aria-label="`Testimonio ${testimony.folio}`" :aria-busy="!detail && status !== 'error'">
    <header class="flex items-start justify-between gap-3 pb-4">
      <div class="min-w-0 space-y-2">
        <CategoryBadge :category="testimony.category" />
        <h2 ref="titleRef" tabindex="-1" class="text-xl leading-tight font-semibold focus:outline-none">{{ title }}</h2>
        <p class="text-sm text-fg/70">
          {{ detail?.place ?? testimony.place }}
          <span v-if="testimony.approximate" class="text-fg/50">· ubicación aproximada</span>
        </p>
        <p class="text-xs text-fg/50">
          {{ testimony.folio }} · {{ date }}<template v-if="author"> · {{ author }}</template>
        </p>
      </div>
      <!-- Acciones del contenedor (p. ej. cerrar) -->
      <slot name="actions" />
    </header>

    <!-- Error al cargar la ficha -->
    <div v-if="!detail && status === 'error'" class="space-y-3 rounded-2xl border border-fg/15 p-4 text-sm" role="alert">
      <p class="text-fg/70">No pudimos cargar el testimonio completo.</p>
      <button
        type="button"
        class="rounded-full border border-fg/30 px-4 py-1.5 font-semibold transition hover:border-fg focus-visible:outline-2 focus-visible:outline-fg"
        @click="$emit('retry')"
      >
        Reintentar
      </button>
    </div>

    <!-- Cargando -->
    <div v-else-if="!detail" class="space-y-5" aria-hidden="true">
      <div v-for="n in 3" :key="n" class="space-y-2">
        <span class="block h-3 w-28 animate-pulse rounded-full bg-fg/10" />
        <span class="block h-3 w-full animate-pulse rounded-full bg-fg/10" />
        <span class="block h-3 w-4/5 animate-pulse rounded-full bg-fg/10" />
      </div>
    </div>

    <div v-else class="space-y-5 text-sm leading-relaxed text-fg/85">
      <section>
        <h3 class="section-title">1 · El testimonio</h3>
        <p class="whitespace-pre-line">{{ detail.testimony }}</p>
      </section>

      <section v-if="detail.territory">
        <h3 class="section-title">2 · El territorio dice</h3>
        <p class="whitespace-pre-line">{{ detail.territory }}</p>
      </section>

      <section v-if="detail.community">
        <h3 class="section-title">3 · La comunidad dice</h3>
        <p class="whitespace-pre-line">{{ detail.community }}</p>
      </section>

      <section>
        <h3 class="section-title">4 · El recibo / documento dice</h3>
        <p class="text-fg/60">
          Evidencia: <span class="font-semibold text-fg">{{ DOCUMENT_STATUS[detail.document.status] }}</span>
        </p>
      </section>

      <section v-if="detail.data">
        <h3 class="section-title">5 · Los datos dicen</h3>
        <p class="whitespace-pre-line">{{ detail.data.text }}</p>
        <p
          v-if="detail.data.pendingVerification"
          class="mt-2 inline-flex rounded-full border border-brand-orange/50 px-2.5 py-0.5 text-xs text-danger"
        >
          Fuente pendiente de verificación
        </p>
      </section>

      <section
        v-if="detail.tribunalQuestion"
        class="rounded-2xl border border-neon-lime/40 light:border-fg/15 bg-neon-lime/10 light:bg-neon-lime/35 p-4"
      >
        <h3 class="text-xs font-semibold tracking-wide text-accent-ink uppercase">6 · La pregunta del Tribunal</h3>
        <p class="mt-1 text-base font-semibold text-accent-ink">{{ detail.tribunalQuestion }}</p>
      </section>

      <section v-if="detail.evidence.length || detail.files.length">
        <h3 class="section-title">Evidencias que acompañan</h3>
        <ul v-if="detail.evidence.length" class="flex flex-wrap gap-2">
          <li
            v-for="item in detail.evidence"
            :key="item"
            class="rounded-full border border-fg/25 px-2.5 py-0.5 text-xs text-fg/85"
          >
            {{ EVIDENCE_LABELS[item] }}
          </li>
        </ul>
        <!-- Archivos públicos (URL firmada, válida 1 h) -->
        <ul v-if="detail.files.length" class="mt-3 space-y-1.5">
          <li v-for="file in detail.files" :key="file.id">
            <a
              :href="file.url"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-2 rounded-xl border border-fg/15 px-3 py-2 text-xs transition hover:border-fg/40 focus-visible:outline-2 focus-visible:outline-fg"
            >
              <span class="min-w-0 flex-1 truncate font-semibold text-fg">{{ file.description || file.name }}</span>
              <span class="shrink-0 text-fg/50">{{ EVIDENCE_LABELS[file.type] }} · {{ file.folio }}</span>
            </a>
          </li>
        </ul>
      </section>
    </div>
  </article>
</template>

<style scoped>
@reference "@/style.css";

.section-title {
  @apply mb-1 text-xs font-semibold tracking-wide text-fg/50 uppercase;
}
</style>
