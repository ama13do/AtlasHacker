<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { FACT_LABELS, SINCE_LABELS } from '@testimonies/data/facts'
import { testimoniesService, type AssistantMessage } from '@testimonies/services/testimonies.service'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { TestimonyDraft } from '@testimonies/types/testimony'

// Sugiere la pregunta al Tribunal con IA (prototipo: AsistentePregunta). No es un chat: un botón para sugerir y otro para
// regenerar. Solo aparece si la API lo tiene encendido (Groq, con OpenRouter de respaldo); la persona decide si la usa
const props = defineProps<{ draft: TestimonyDraft }>()
const emit = defineEmits<{ use: [question: string] }>()

const categories = useCategoriesStore()
const enabled = computed(() => categories.config?.assistant === true)

// Sugerencias anteriores: se mandan para que «Regenerar» proponga otra distinta (la API acepta hasta 16 mensajes)
const MAX_PREVIOUS = 5
const previous = ref<string[]>([])
const suggestion = ref<string | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)

const extract = (s: string) => (s.match(/<pregunta>([\s\S]*?)<\/pregunta>/)?.[1] ?? s.replace(/<\/?pregunta>/g, '')).trim()

const context = () => ({
  hechos: props.draft.facts.map((f) => FACT_LABELS[f]),
  lugar: [props.draft.place, props.draft.municipality, props.draft.state].map((s) => s.trim()).filter(Boolean).join(', '),
  desde_cuando: props.draft.since ? SINCE_LABELS[props.draft.since] : undefined,
  sigue_pasando: props.draft.ongoing === null ? undefined : props.draft.ongoing ? 'Sí' : 'No',
  titulo: props.draft.title.trim() || undefined,
  relato: props.draft.testimony.trim().slice(0, 1500) || undefined,
  pregunta: props.draft.tribunalQuestion.trim() || undefined,
})

async function suggest() {
  if (busy.value) return
  const seen = suggestion.value ? [...previous.value, suggestion.value].slice(-MAX_PREVIOUS) : []
  const messages: AssistantMessage[] = [{ role: 'user', content: 'Sugiere una pregunta.' }]
  for (const q of seen) messages.push({ role: 'assistant', content: `<pregunta>${q}</pregunta>` }, { role: 'user', content: 'Dame otra distinta.' })
  error.value = null
  busy.value = true
  try {
    const next = extract(await testimoniesService.askAssistant(context(), messages))
    previous.value = seen
    suggestion.value = next || null
    if (!next) error.value = 'No salió una sugerencia. Intenta de nuevo.'
  } catch (e) {
    const status = (e as Partial<ApiError>).status
    error.value = status === 429 ? 'Muchas consultas seguidas. Espera un momento.' : 'Ahora no pudimos sugerir una pregunta. Puedes escribirla por tu cuenta.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="enabled" class="space-y-3">
    <button v-if="!suggestion" type="button" class="btn-hxnf btn-paper btn-sm" :disabled="busy" @click="suggest">
      <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.94 14.06 4 20M14.5 4l1.1 2.9L18.5 8l-2.9 1.1L14.5 12l-1.1-2.9L10.5 8l2.9-1.1zM19 14l.6 1.4L21 16l-1.4.6L19 18l-.6-1.4L17 16l1.4-.6z" /></svg>
      {{ busy ? 'Pensando…' : 'Sugerir pregunta para el tribunal' }}
    </button>

    <div v-else class="space-y-3 rounded-2xl border-2 border-ink bg-card p-3" aria-live="polite">
      <p class="text-xs font-bold tracking-wide text-fg/60 uppercase">Sugerencia</p>
      <p class="text-sm leading-relaxed" :class="busy && 'opacity-50'">{{ suggestion }}</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-hxnf btn-ink btn-sm" :disabled="busy" @click="emit('use', suggestion!)">Usar esta pregunta</button>
        <button type="button" class="btn-hxnf btn-paper btn-sm" :disabled="busy" @click="suggest">
          <svg viewBox="0 0 24 24" class="size-4" :class="busy && 'animate-spin'" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" /><path d="M21 3v5h-5" /></svg>
          {{ busy ? 'Pensando…' : 'Regenerar' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    <p class="text-xs text-fg/60">La sugerencia la escribe una inteligencia artificial con lo que contaste; tú decides si la usas.</p>
  </div>
</template>
