<script setup lang="ts">
import { nextTick, onMounted, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { provideTestimonyForm, STEPS, useTestimonyForm } from '@testimonies/composables/useTestimonyForm'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'
import type { CreateTestimonyResult } from '@testimonies/types/testimony'
import StepConsent from '@testimonies/components/form/StepConsent.vue'
import StepData from '@testimonies/components/form/StepData.vue'
import StepEvidence from '@testimonies/components/form/StepEvidence.vue'
import StepGeneral from '@testimonies/components/form/StepGeneral.vue'
import StepReview from '@testimonies/components/form/StepReview.vue'
import StepTerritory from '@testimonies/components/form/StepTerritory.vue'
import StepTestimony from '@testimonies/components/form/StepTestimony.vue'
import FormStepper from '@testimonies/components/form/FormStepper.vue'
import SubmitSuccess from '@testimonies/components/form/SubmitSuccess.vue'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'

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

const { draft, step, maxReached, isLast } = form

const heading = ref<HTMLHeadingElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const showRestored = ref(form.restored)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const result = ref<CreateTestimonyResult | null>(null)

// Un borrador guardado puede traer una categoría que ya no existe (o de antes de la API)
onMounted(async () => {
  const categories = useCategoriesStore()
  try {
    await categories.load()
  } catch {
    return // El paso 1 muestra el error y permite reintentar
  }
  if (draft.topic && !categories.categories.some((c) => c.slug === draft.topic)) draft.topic = null
})

// Al cambiar de paso: arriba y foco en el título para lectores de pantalla
watch(step, async () => {
  window.scrollTo({ top: 0 })
  scroller.value?.scrollTo({ top: 0 })
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
    submitError.value =
      error instanceof Error ? error.message : 'No pudimos enviar tu testimonio. Intenta de nuevo.'
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
  <main class="min-h-dvh bg-surface md:h-dvh md:p-6">
    <div
      class="mx-auto flex min-h-dvh flex-col md:grid md:h-full md:min-h-0 md:max-w-6xl md:grid-cols-[17rem_1fr] md:overflow-hidden md:rounded-3xl md:border md:border-fg/15"
    >
      <!-- Lateral (escritorio): marca, pasos y salida -->
      <aside class="hidden flex-col gap-8 border-r border-fg/10 bg-fg/[0.03] p-6 md:flex">
        <div>
          <p class="text-xs text-fg/50">Tribunal Popular · FUTURO/001</p>
          <p class="text-lg font-semibold">Subir testimonio</p>
        </div>

        <FormStepper :step="step" :max-reached="maxReached" :done="!!result" @go="form.goTo" />

        <div class="mt-auto space-y-4">
          <p class="text-xs leading-relaxed text-fg/40">
            El recibo dice. El territorio dice. La comunidad dice. Los datos dicen. El Tribunal pregunta.
          </p>
          <div class="flex items-center justify-between gap-3">
            <RouterLink
              :to="{ name: 'home' }"
              class="inline-flex items-center gap-2 text-sm text-fg/70 hover:text-fg focus-visible:outline-2 focus-visible:outline-fg"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              Cerrar · tu borrador se guarda
            </RouterLink>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <section class="flex flex-1 flex-col md:min-h-0">
        <!-- Header (móvil) -->
        <header class="sticky top-0 z-10 border-b border-fg/10 bg-surface/95 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur md:hidden">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-fg/50">Tribunal Popular · FUTURO/001</p>
              <p class="font-semibold">Subir testimonio</p>
            </div>
            <ThemeToggle class="ml-auto" />
            <RouterLink
              :to="{ name: 'home' }"
              class="grid size-10 shrink-0 place-items-center rounded-full bg-fg/10 hover:bg-fg/20 focus-visible:outline-2 focus-visible:outline-fg"
              aria-label="Cerrar (tu borrador se guarda)"
            >
              <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </RouterLink>
          </div>

          <div v-if="!result" class="mt-3 flex gap-1" aria-hidden="true">
            <span
              v-for="(_, i) in STEPS"
              :key="i"
              class="h-1 flex-1 rounded-full transition-colors"
              :class="i <= step ? 'bg-neon-lime' : 'bg-fg/15'"
            />
          </div>
        </header>

        <!-- Contenido (en escritorio con scroll interno) -->
        <div ref="scroller" class="flex-1 px-4 py-6 md:overflow-y-auto md:px-10 md:py-8">
          <SubmitSuccess v-if="result" :result="result" @view-on-map="viewOnMap" @home="router.push({ name: 'home' })" />

          <template v-else>
            <div
              v-if="showRestored"
              class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-fg/5 px-4 py-3 text-sm"
              role="status"
            >
              <span>Recuperamos tu borrador. Los archivos adjuntos hay que volver a elegirlos.</span>
              <button type="button" class="font-semibold text-accent-ink hover:underline" @click="startOver">
                Empezar de nuevo
              </button>
            </div>

            <div class="mb-8 space-y-1">
              <p class="text-xs font-semibold tracking-wider text-accent-ink uppercase">
                Paso {{ step + 1 }} de {{ STEPS.length }}
              </p>
              <h2 ref="heading" tabindex="-1" class="text-2xl font-semibold focus:outline-none md:text-3xl">
                {{ STEPS[step].title }}
              </h2>
              <p class="text-sm text-fg/60">{{ STEPS[step].description }}</p>
            </div>

            <component :is="STEP_COMPONENTS[step]" />
          </template>
        </div>

        <!-- Acciones (fijas abajo) -->
        <footer
          v-if="!result"
          class="sticky bottom-0 border-t border-fg/10 bg-surface/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur md:static md:px-10 md:py-4"
        >
          <p v-if="submitError" role="alert" class="mb-3 text-sm text-danger">{{ submitError }}</p>
          <div class="flex gap-3 md:justify-end">
            <button
              v-if="step > 0"
              type="button"
              class="rounded-full border border-fg/30 px-6 py-3 font-semibold transition hover:border-fg focus-visible:outline-2 focus-visible:outline-fg md:py-2.5"
              @click="form.back"
            >
              Atrás
            </button>
            <button
              v-if="!isLast"
              type="button"
              class="flex-1 rounded-full bg-fg py-3 font-semibold text-surface transition hover:bg-neon-lime hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg md:flex-none md:px-8 md:py-2.5"
              @click="onNext"
            >
              Siguiente
            </button>
            <button
              v-else
              type="button"
              class="flex-1 rounded-full bg-neon-lime py-3 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-60 md:flex-none md:px-8 md:py-2.5"
              :disabled="submitting"
              @click="onSubmit"
            >
              {{ submitting ? 'Enviando…' : 'Enviar testimonio' }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </main>
</template>
