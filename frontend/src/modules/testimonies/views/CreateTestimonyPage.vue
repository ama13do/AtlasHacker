<script setup lang="ts">
import { nextTick, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { provideTestimonyForm, STEPS, useTestimonyForm } from '@testimonies/composables/useTestimonyForm'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'
import type { CreateTestimonyResult } from '@testimonies/types/testimony'
import StepConsent from '@testimonies/components/form/StepConsent.vue'
import StepData from '@testimonies/components/form/StepData.vue'
import StepEvidence from '@testimonies/components/form/StepEvidence.vue'
import StepGeneral from '@testimonies/components/form/StepGeneral.vue'
import StepReview from '@testimonies/components/form/StepReview.vue'
import StepTerritory from '@testimonies/components/form/StepTerritory.vue'
import StepTestimony from '@testimonies/components/form/StepTestimony.vue'
import SubmitSuccess from '@testimonies/components/form/SubmitSuccess.vue'

const STEP_COMPONENTS: Component[] = [
  StepGeneral,
  StepTestimony,
  StepTerritory,
  StepEvidence,
  StepData,
  StepConsent,
  StepReview,
]

const router = useRouter()
const store = useTestimoniesStore()
const form = useTestimonyForm()
provideTestimonyForm(form)

const { draft, step, isLast } = form

const heading = ref<HTMLHeadingElement | null>(null)
const showRestored = ref(form.restored)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const result = ref<CreateTestimonyResult | null>(null)

// Al cambiar de paso: arriba y foco en el título para lectores de pantalla
watch(step, async () => {
  window.scrollTo({ top: 0 })
  document.querySelector('[data-scroll]')?.scrollTo({ top: 0 })
  await nextTick()
  heading.value?.focus()
})

// Campo con error o, en grupos de opciones, su primera opción
function focusFirstError() {
  nextTick(() => {
    const field = document.querySelector<HTMLElement>('[aria-invalid="true"]')
    const group = document.querySelector<HTMLElement>('fieldset[aria-describedby] input:not(:disabled)')
    const first = [field, group]
      .filter((el): el is HTMLElement => !!el)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))[0]
    first?.focus()
    first?.scrollIntoView({ block: 'center' })
  })
}

function onNext() {
  if (!form.next()) focusFirstError()
}

async function onSubmit() {
  const invalid = form.firstInvalidStep()
  if (invalid !== -1) {
    form.goTo(invalid)
    form.validateStep(invalid)
    return
  }

  submitting.value = true
  submitError.value = null
  try {
    result.value = await store.create({ ...draft, files: [...draft.files] })
    form.reset()
  } catch (error) {
    console.error(error)
    submitError.value = 'No pudimos enviar tu testimonio. Intenta de nuevo.'
  } finally {
    submitting.value = false
  }
}

function startOver() {
  form.reset()
  showRestored.value = false
}

function viewOnMap() {
  if (result.value) router.push({ name: 'home', query: { t: result.value.testimony.id } })
}
</script>

<template>
  <main class="min-h-dvh bg-black md:py-10">
    <div class="mx-auto flex min-h-dvh max-w-2xl flex-col md:min-h-0 md:rounded-3xl md:border md:border-white/15">
      <!-- Header -->
      <header class="sticky top-0 z-10 border-b border-white/10 bg-black/95 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur md:static md:rounded-t-3xl md:px-6 md:pt-5">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-white/50">Tribunal Popular · FUTURO/001</p>
            <p class="font-semibold">Subir testimonio</p>
          </div>
          <RouterLink
            :to="{ name: 'home' }"
            class="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Cerrar (tu borrador se guarda)"
          >
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </RouterLink>
        </div>

        <div v-if="!result" class="mt-3">
          <div class="flex gap-1" aria-hidden="true">
            <span
              v-for="(_, i) in STEPS"
              :key="i"
              class="h-1 flex-1 rounded-full transition-colors"
              :class="i <= step ? 'bg-neon-lime' : 'bg-white/15'"
            />
          </div>
          <p class="mt-2 text-xs text-white/60">Paso {{ step + 1 }} de {{ STEPS.length }}</p>
        </div>
      </header>

      <!-- Contenido -->
      <div data-scroll class="flex-1 px-4 py-6 md:px-6">
        <SubmitSuccess v-if="result" :result="result" @view-on-map="viewOnMap" @home="router.push({ name: 'home' })" />

        <template v-else>
          <div
            v-if="showRestored"
            class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 text-sm"
            role="status"
          >
            <span>Recuperamos tu borrador. Los archivos adjuntos hay que volver a elegirlos.</span>
            <button type="button" class="font-semibold text-neon-lime hover:underline" @click="startOver">
              Empezar de nuevo
            </button>
          </div>

          <h2 ref="heading" tabindex="-1" class="mb-6 text-2xl font-semibold focus:outline-none">{{ STEPS[step] }}</h2>
          <component :is="STEP_COMPONENTS[step]" />
        </template>
      </div>

      <!-- Acciones -->
      <footer
        v-if="!result"
        class="sticky bottom-0 border-t border-white/10 bg-black/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur md:static md:rounded-b-3xl md:px-6 md:pb-5"
      >
        <p v-if="submitError" role="alert" class="mb-3 text-sm text-brand-orange">{{ submitError }}</p>
        <div class="flex gap-3">
          <button
            v-if="step > 0"
            type="button"
            class="rounded-full border border-white/30 px-5 py-3 font-semibold transition hover:border-white focus-visible:outline-2 focus-visible:outline-white"
            @click="form.back"
          >
            Atrás
          </button>
          <button
            v-if="!isLast"
            type="button"
            class="flex-1 rounded-full bg-white py-3 font-semibold text-black transition hover:bg-neon-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            @click="onNext"
          >
            Siguiente
          </button>
          <button
            v-else
            type="button"
            class="flex-1 rounded-full bg-neon-lime py-3 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
            :disabled="submitting"
            @click="onSubmit"
          >
            {{ submitting ? 'Enviando…' : 'Enviar testimonio' }}
          </button>
        </div>
      </footer>
    </div>
  </main>
</template>
