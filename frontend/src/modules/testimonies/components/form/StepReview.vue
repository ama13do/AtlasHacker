<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { asText, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { EVIDENCE_LABELS } from '@testimonies/data/categories'
import { useCategoriesStore } from '@testimonies/stores/categories'
import CategoryBadge from '@testimonies/components/CategoryBadge.vue'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import { maskFolio, normalizeParticipantFolio } from '@testimonies/utils/folio'

const { draft, publishable, goTo, editing, staff } = useTestimonyFormContext()
const categories = useCategoriesStore()
const { remembered } = useParticipantFolio()

const folio = computed(() => {
  const typed = normalizeParticipantFolio(draft.folio)
  if (typed) return maskFolio(typed)
  return remembered.value ? maskFolio(remembered.value) : 'Se te dará uno al enviar'
})

const LABELS = {
  document: { si: 'Sí', no: 'No', pendiente: 'Pendiente' },
  consent: {
    'publico-nombre': 'Público con nombre',
    'publico-anonimo': 'Público anónimo',
    interno: 'Solo documentación interna',
    'no-publicar': 'No autoriza su uso',
  },
  media: { si: 'Sí', no: 'No', na: 'No aplica' },
  voice: { voz_imagen: 'Voz e imagen', solo_voz: 'Solo voz', ninguna: 'Ninguna' },
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

const sources = computed(() =>
  draft.sources
    .filter((s) => asText(s.source).trim())
    .map((s) => [asText(s.source).trim(), asText(s.year).trim(), asText(s.link).trim()].filter(Boolean).join(' · '))
    .join('\n'),
)

// Miniaturas de lo adjuntado (URLs locales; se liberan al salir)
const thumbs = computed(() =>
  draft.files.map((a) => ({ id: a.id, name: a.file.name, kind: a.file.type.split('/')[0], type: a.type, url: URL.createObjectURL(a.file) })),
)
onBeforeUnmount(() => thumbs.value.forEach((t) => URL.revokeObjectURL(t.url)))

const sections = computed(() => [
  {
    step: 0,
    title: 'Datos generales',
    rows: [
      ['Categoría', draft.topic ? categories.bySlug(draft.topic).label : '—'],
      ['Título', draft.title],
      ['Lugar', draft.place],
      ['Municipio · Estado', [draft.municipality, draft.state].filter(Boolean).join(' · ')],
      ['Ubicación', draft.coordinates ? `${draft.coordinates[1].toFixed(4)}, ${draft.coordinates[0].toFixed(4)}` : '—'],
      ['Fecha', date.value],
      ['Aparece como', draft.visibility === 'nombre' ? draft.name || '—' : 'Anónimo'],
      ['Facilitador/a', draft.facilitator],
    ],
  },
  { step: 1, title: 'El testimonio', text: draft.testimony },
  {
    step: 2,
    title: '01 · El recibo dice',
    rows: [
      ['Documento', draft.documentStatus ? LABELS.document[draft.documentStatus] : '—'],
      ['Qué dice', draft.documentDescription],
      ['Evidencias', evidence.value.join(', ')],
      ['Links', draft.links.join('\n')],
      ['Huella digital', draft.files.some((a) => a.file.type.startsWith('image/')) ? (draft.stripMetadata ? 'Se borran los metadatos de las fotos' : 'Las fotos se suben tal cual') : ''],
    ],
    files: true,
  },
  {
    step: 3,
    title: '02 · El territorio · 03 · La comunidad',
    rows: [
      ['El territorio dice', draft.territory || 'Pendiente'],
      ['La comunidad dice', draft.community || 'Pendiente'],
    ],
  },
  {
    step: 4,
    title: '04 · Los datos · 05 · La pregunta',
    wide: true,
    rows: [
      ['Datos', draft.dataText],
      ['Fuentes', sources.value],
      ['Verificación', draft.dataText || sources.value ? (draft.dataPendingVerification ? 'Pendiente de verificación' : 'Verificada') : ''],
      ['Pregunta del Tribunal', draft.tribunalQuestion || 'Pendiente'],
      ['Algo más', draft.anythingElse],
      ['Cómo registrar su voz', draft.voiceRecord],
    ],
  },
  {
    step: 5,
    title: 'Consentimiento y cuidados',
    wide: true,
    rows: [
      ['Autoriza', draft.consent ? LABELS.consent[draft.consent] : '—'],
      ['Voz o imagen', draft.voiceImage ? LABELS.voice[draft.voiceImage] : '—'],
      ['Personas fotografiadas', draft.mediaConsent ? LABELS.media[draft.mediaConsent] : '—'],
      [
        'Información de riesgo',
        draft.sensitive === null ? '—' : draft.sensitive ? `Sí · ${draft.sensitiveHandling ? LABELS.handling[draft.sensitiveHandling] : '—'}` : 'No',
      ],
      ['Niñas, niños o adolescentes', draft.minors === null ? '—' : draft.minors ? 'Sí · se revisa antes de publicar' : 'No'],
      ['Folio', editing || staff ? '' : folio.value],
      ['Contacto', editing ? '' : [draft.email.trim(), draft.phone.trim()].filter(Boolean).join(' · ')],
    ],
  },
])
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <CategoryBadge v-if="draft.topic" :category="draft.topic" />
      <p class="chip px-3 py-1" :class="publishable ? 'bg-neon-green text-black' : 'bg-card'">
        {{ publishable ? (draft.minors ? 'Se publicará después de una revisión cuidadosa' : 'Se publicará en el mapa después de una revisión') : 'No se publicará en el mapa' }}
      </p>
    </div>

    <div class="grid gap-4 @3xl:grid-cols-2">
      <section
        v-for="section in sections"
        :key="section.step"
        class="rounded-[22px] border-2 border-ink bg-card p-4 shadow-brut"
        :class="{ '@3xl:col-span-2': 'wide' in section && section.wide }"
      >
        <header class="mb-3 flex items-center justify-between gap-3">
          <h3 class="text-sm font-black uppercase">{{ section.title }}</h3>
          <button type="button" class="btn-hxnf btn-paper btn-sm min-h-8 px-3 text-xs" :aria-label="`Editar ${section.title}`" @click="goTo(section.step)">
            Editar
          </button>
        </header>
        <p v-if="section.text" class="text-sm whitespace-pre-line text-fg/85">{{ section.text }}</p>
        <dl v-else class="space-y-2 text-sm">
          <template v-for="[label, value] in section.rows" :key="label">
            <div v-if="value" class="grid grid-cols-[9rem_1fr] gap-3">
              <dt class="text-fg/55">{{ label }}</dt>
              <dd class="min-w-0 whitespace-pre-line text-fg/90 [overflow-wrap:anywhere]" :class="{ 'italic opacity-60': value === 'Pendiente' }">{{ value }}</dd>
            </div>
          </template>
        </dl>

        <!-- Miniaturas de los archivos -->
        <ul v-if="'files' in section && thumbs.length" class="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Archivos adjuntos">
          <li v-for="t in thumbs" :key="t.id" class="w-24 shrink-0">
            <div class="relative aspect-square overflow-hidden rounded-xl border-2 border-ink bg-fg/5">
              <img v-if="t.kind === 'image'" :src="t.url" :alt="t.name" class="size-full object-cover" />
              <video v-else-if="t.kind === 'video'" :src="t.url" class="size-full object-cover" muted preload="metadata" />
              <span v-else class="grid size-full place-items-center text-xs font-black uppercase">{{ t.kind === 'audio' ? 'Audio' : 'PDF' }}</span>
            </div>
            <p class="mt-1 truncate text-[10px] font-semibold">{{ EVIDENCE_LABELS[t.type] }}</p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
