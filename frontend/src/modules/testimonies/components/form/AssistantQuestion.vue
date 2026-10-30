<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { FACT_LABELS, SINCE_LABELS } from '@testimonies/data/facts'
import { testimoniesService, type AssistantMessage } from '@testimonies/services/testimonies.service'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { TestimonyDraft } from '@testimonies/types/testimony'

// Asistente para escribir la pregunta al Tribunal (prototipo: AsistentePregunta). Solo aparece si la API lo tiene
// encendido (OpenRouter); la persona decide si usa la propuesta
const props = defineProps<{ draft: TestimonyDraft }>()
const emit = defineEmits<{ use: [question: string] }>()

const categories = useCategoriesStore()
const enabled = computed(() => categories.config?.assistant === true)

const open = ref(false)
const messages = ref<AssistantMessage[]>([])
const text = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const end = ref<HTMLElement | null>(null)

const extract = (s: string) => s.match(/<pregunta>([\s\S]*?)<\/pregunta>/)?.[1]?.trim() ?? null
const clean = (s: string) => s.replace(/<\/?pregunta>/g, '')

const context = () => ({
  hechos: props.draft.facts.map((f) => FACT_LABELS[f]),
  lugar: [props.draft.place, props.draft.municipality, props.draft.state].map((s) => s.trim()).filter(Boolean).join(', '),
  desde_cuando: props.draft.since ? SINCE_LABELS[props.draft.since] : undefined,
  sigue_pasando: props.draft.ongoing === null ? undefined : props.draft.ongoing ? 'Sí' : 'No',
  titulo: props.draft.title.trim() || undefined,
  relato: props.draft.testimony.trim().slice(0, 1500) || undefined,
  pregunta: props.draft.tribunalQuestion.trim() || undefined,
})

async function send(content: string) {
  if (busy.value) return
  const next = [...messages.value, { role: 'user' as const, content }]
  messages.value = next
  text.value = ''
  error.value = null
  busy.value = true
  try {
    messages.value = [...next, { role: 'assistant', content: await testimoniesService.askAssistant(context(), next) }]
  } catch (e) {
    const status = (e as Partial<ApiError>).status
    error.value = status === 429 ? 'Muchas consultas seguidas. Espera un momento.' : 'El asistente no está disponible ahora. Puedes escribir tu pregunta por tu cuenta.'
    messages.value = next.slice(0, -1)
  } finally {
    busy.value = false
    await nextTick()
    end.value?.scrollIntoView({ block: 'nearest' })
  }
}
</script>

<template>
  <div v-if="enabled">
    <button v-if="!open" type="button" class="btn-hxnf btn-paper btn-sm" @click="open = true">¿No sabes cómo preguntarlo? Te ayudo</button>
    <div v-else class="space-y-3 rounded-2xl border-2 border-ink/30 p-3" aria-label="Asistente para tu pregunta">
      <p class="text-xs text-fg/70">
        Te ayudo a escribir tu pregunta; tú decides cuál usar. Lo que escribas aquí lo procesa una inteligencia artificial: no pongas
        nombres ni datos personales.
      </p>
      <div class="max-h-72 space-y-2 overflow-y-auto" aria-live="polite">
        <button
          v-if="!messages.length"
          type="button"
          class="btn-hxnf btn-ink btn-sm"
          :disabled="busy"
          @click="send(draft.tribunalQuestion.trim() ? 'Ayúdame a mejorar mi pregunta.' : 'Ayúdame a escribir mi pregunta.')"
        >
          Empezar
        </button>
        <div
          v-for="(m, i) in messages"
          :key="i"
          class="rounded-2xl px-3 py-2 text-sm whitespace-pre-line"
          :class="m.role === 'user' ? 'ml-8 bg-fg/10' : 'mr-8 border-2 border-ink bg-card'"
        >
          {{ m.role === 'assistant' ? clean(m.content) : m.content }}
          <button
            v-if="m.role === 'assistant' && extract(m.content)"
            type="button"
            class="btn-hxnf btn-ink btn-sm mt-2"
            @click="emit('use', extract(m.content)!)"
          >
            Usar esta pregunta
          </button>
        </div>
        <p v-if="busy" class="text-sm text-fg/60" role="status">Pensando…</p>
        <div ref="end" />
      </div>
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <form v-if="messages.length" class="flex gap-2" @submit.prevent="text.trim() && send(text.trim())">
        <label for="assistant-text" class="sr-only">Responde al asistente</label>
        <input id="assistant-text" v-model="text" type="text" maxlength="1500" class="field-input min-w-0 flex-1 text-sm" placeholder="Escribe aquí…" />
        <button type="submit" class="btn-hxnf btn-ink btn-sm shrink-0" :disabled="busy || !text.trim()">Enviar</button>
      </form>
    </div>
  </div>
</template>
