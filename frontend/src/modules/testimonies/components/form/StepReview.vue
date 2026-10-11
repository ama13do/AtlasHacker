<script setup lang="ts">
import { computed } from 'vue'
import { useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { EVIDENCE_LABELS, TOPIC_META } from '@testimonies/data/topics'
import TopicBadge from '@testimonies/components/TopicBadge.vue'

const { draft, publishable, goTo } = useTestimonyFormContext()

const LABELS = {
  document: { si: 'Sí', no: 'No', pendiente: 'Pendiente' },
  consent: {
    'publico-nombre': 'Público con nombre',
    'publico-anonimo': 'Público anónimo',
    interno: 'Solo documentación interna',
    'no-publicar': 'No autorizo publicación',
  },
  media: { si: 'Sí', no: 'No', na: 'N/A' },
  handling: { anonimizar: 'Anonimizar', interno: 'Uso interno', revision: 'Revisión antes de publicar' },
} as const

const date = computed(() =>
  draft.date
    ? new Date(`${draft.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—',
)

const evidence = computed(() =>
  draft.evidence.map((e) => (e === 'otro' && draft.evidenceOther ? `Otro: ${draft.evidenceOther}` : EVIDENCE_LABELS[e])),
)

const sections = computed(() => [
  {
    step: 0,
    title: 'Datos generales',
    rows: [
      ['Tema', draft.topic ? TOPIC_META[draft.topic].label : '—'],
      ['Título', draft.title],
      ['Lugar', draft.place],
      ['Ubicación', draft.coordinates ? `${draft.coordinates[1].toFixed(4)}, ${draft.coordinates[0].toFixed(4)}` : '—'],
      ['Fecha', date.value],
      ['Aparece como', draft.visibility === 'nombre' ? draft.name || '—' : 'Anónimo'],
      ['Facilitador/a', draft.facilitator],
    ],
  },
  { step: 1, title: '1 · El testimonio', text: draft.testimony },
  {
    step: 2,
    title: '2 y 3 · El territorio y la comunidad',
    rows: [
      ['El territorio dice', draft.territory],
      ['La comunidad dice', draft.community],
    ],
  },
  {
    step: 3,
    title: '4 · El recibo / documento dice',
    rows: [
      ['Documento', draft.documentStatus ? LABELS.document[draft.documentStatus] : '—'],
      ['Descripción', draft.documentDescription],
      ['Evidencias', evidence.value.join(', ')],
      ['Archivos', draft.files.map((f) => f.name).join(', ')],
    ],
  },
  {
    step: 4,
    title: '5 y 6 · Los datos y la pregunta',
    wide: true,
    rows: [
      ['Dato', draft.dataText],
      ['Fuente', [draft.dataSource, draft.dataYear].filter(Boolean).join(', ')],
      ['Verificación', draft.dataText ? (draft.dataPendingVerification ? 'Pendiente' : 'Verificada') : ''],
      ['Pregunta del Tribunal', draft.tribunalQuestion],
    ],
  },
  {
    step: 5,
    title: 'Consentimiento',
    wide: true,
    rows: [
      ['Autorizo', draft.consent ? LABELS.consent[draft.consent] : '—'],
      ['Foto/audio/video', draft.mediaConsent ? LABELS.media[draft.mediaConsent] : '—'],
      [
        'Información sensible',
        draft.sensitive === null
          ? '—'
          : draft.sensitive
            ? `Sí · ${draft.sensitiveHandling.map((h) => LABELS.handling[h]).join(', ')}`
            : 'No',
      ],
    ],
  },
])
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <TopicBadge v-if="draft.topic" :topic="draft.topic" />
      <p class="text-sm" :class="publishable ? 'text-neon-green' : 'text-white/70'">
        {{ publishable ? 'Se publicará en el mapa' : 'No se publicará en el mapa' }}
      </p>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <section
        v-for="section in sections"
        :key="section.step"
        class="rounded-2xl border border-white/15 p-4"
        :class="{ 'lg:col-span-2': 'wide' in section && section.wide }"
      >
        <header class="mb-3 flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold">{{ section.title }}</h3>
          <button
            type="button"
            class="rounded-full px-3 py-1 text-xs font-semibold text-neon-lime hover:bg-neon-lime/10 focus-visible:outline-2 focus-visible:outline-white"
            :aria-label="`Editar ${section.title}`"
            @click="goTo(section.step)"
          >
            Editar
          </button>
        </header>
        <p v-if="section.text" class="text-sm whitespace-pre-line text-white/85">{{ section.text }}</p>
        <dl v-else class="space-y-2 text-sm">
          <template v-for="[label, value] in section.rows" :key="label">
            <div v-if="value" class="grid grid-cols-[8rem_1fr] gap-3">
              <dt class="text-white/50">{{ label }}</dt>
              <dd class="whitespace-pre-line text-white/85">{{ value }}</dd>
            </div>
          </template>
        </dl>
      </section>
    </div>
  </div>
</template>
