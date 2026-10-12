<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { provideTestimonyForm, STEPS, useTestimonyForm } from '@testimonies/composables/useTestimonyForm'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'
import type { CreateTestimonyResult, TestimonyDraft } from '@testimonies/types/testimony'
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
import TurnstileWidget from '@/shared/components/TurnstileWidget.vue'
import type { ApiError } from '@/core/http/client'
import { useEvidenceUpload } from '@testimonies/composables/useEvidenceUpload'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import { fieldErrorsFromApi } from '@testimonies/utils/apiErrors'
import { normalizeParticipantFolio } from '@testimonies/utils/folio'
import { participantService } from '@testimonies/services/participant.service'
import UploadProgress from '@testimonies/components/UploadProgress.vue'

// Sin `edit`: subir un testimonio nuevo. Con `edit`: editar uno propio (desde Mi folio)
const props = defineProps<{
  edit?: { id: string; testimonyFolio: string; participantFolio: string; draft: TestimonyDraft }
}>()
const editing = !!props.edit

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
const form = useTestimonyForm(
  props.edit ? { initial: props.edit.draft, storageKey: null, editing: true } : {},
)
provideTestimonyForm(form)

const { draft, step, maxReached, isLast } = form

const heading = ref<HTMLHeadingElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const showRestored = ref(form.restored)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const result = ref<CreateTestimonyResult | null>(null)
// Edición guardada
const saved = ref(false)
const title = editing ? 'Editar testimonio' : 'Subir testimonio'

// Captcha (Turnstile): se pide en el último paso si la API lo exige. El token sirve para un solo envío
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const categoriesStore = useCategoriesStore()
// Al editar no se pide captcha: la ruta exige el folio
const captchaRequired = computed(() => !editing && (categoriesStore.config?.captchaRequired ?? true))
const captcha = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const captchaToken = ref<string | null>(null)
const captchaUnavailable = ref(!SITE_KEY)
const canSubmit = computed(() => !captchaRequired.value || !!captchaToken.value)

function onCaptchaError(code: string) {
  captchaToken.value = null
  console.warn('Turnstile:', code)
  captchaUnavailable.value = true
}

function resetCaptcha() {
  captchaToken.value = null
  captcha.value?.reset()
}

const { active: rememberedFolio } = useParticipantFolio()

// Evidencias: se suben después de crear el testimonio, con el folio de la persona
const upload = useEvidenceUpload()
watch(upload.done, (done) => {
  const id = result.value?.id ?? props.edit?.id
  if (done && id) store.invalidateDetail(id)
})

// Un borrador guardado puede traer una categoría que ya no existe (o de antes de la API)
onMounted(async () => {
  try {
    await categoriesStore.load()
  } catch {
    return // El paso 1 muestra el error y permite reintentar
  }
  if (draft.topic && !categoriesStore.categories.some((c) => c.slug === draft.topic)) draft.topic = null
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

  if (props.edit) return saveEdit(props.edit)

  submitting.value = true
  submitError.value = null
  // Se copian antes de limpiar el borrador
  const files = [...draft.files]
  const folio = normalizeParticipantFolio(draft.folio) ?? rememberedFolio.value
  try {
    result.value = await store.create({ ...draft, files }, { captchaToken: captchaToken.value, folio })
    form.reset()
    const uploadFolio = result.value.participantFolio ?? folio
    if (files.length && uploadFolio) upload.start(result.value.id, uploadFolio, files)
  } catch (error) {
    console.error(error)
    handleSubmitError(error as Partial<ApiError>)
  } finally {
    submitting.value = false
    // El token ya se consumió (con éxito o no)
    if (!result.value) resetCaptcha()
  }
}

async function saveEdit(edit: NonNullable<typeof props.edit>) {
  submitting.value = true
  submitError.value = null
  const files = [...draft.files]
  try {
    await participantService.updateMine(edit.participantFolio, edit.id, draft)
    saved.value = true
    store.invalidateDetail(edit.id)
    if (store.status === 'ready') store.load() // La visibilidad pudo cambiar (vuelve a revisión)
    if (files.length) upload.start(edit.id, edit.participantFolio, files)
  } catch (error) {
    console.error(error)
    const e = error as Partial<ApiError>
    if (e.status === 403) submitError.value = 'La edición de testimonios está desactivada por ahora.'
    else if (e.status === 401) submitError.value = 'Tu folio ya no es válido. Vuelve a entrar en Mi folio.'
    else handleSubmitError(e)
  } finally {
    submitting.value = false
  }
}

// Errores de la API → mensaje claro y, si aplica, el paso y campo a corregir
function handleSubmitError(error: Partial<ApiError>) {
  if (error.code === 'DATOS_INVALIDOS') {
    const mapped = fieldErrorsFromApi(error.details)
    if (mapped) {
      form.showErrors(mapped.step, mapped.errors)
      submitError.value = 'Revisa los campos marcados.'
      focusFirstError()
      return
    }
  }
  if (error.code === 'CAPTCHA_INVALIDO') {
    submitError.value = 'La verificación expiró. Vuelve a verificar e intenta de nuevo.'
  } else if (error.status === 401) {
    // Folio inválido (el escrito o el recordado)
    form.showErrors(5, { folio: 'Este folio no es válido. Revísalo o envía sin folio.' })
    if (!draft.folio.trim()) draft.folio = rememberedFolio.value ?? ''
    submitError.value = 'Tu folio no es válido.'
    focusFirstError()
  } else if (error.status === 429) {
    submitError.value = 'Hiciste demasiados envíos. Intenta de nuevo más tarde.'
  } else if (error.status === null) {
    submitError.value = 'No hay conexión con el servidor. Tu borrador sigue guardado; intenta de nuevo.'
  } else {
    submitError.value = error.message ?? 'No pudimos enviar tu testimonio. Intenta de nuevo.'
  }
}

function startOver() {
  form.reset()
  showRestored.value = false
}

function viewOnMap() {
  if (result.value) router.push({ name: 'home', query: { t: result.value.id } })
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
          <p class="text-xs text-fg/50">{{ edit ? edit.testimonyFolio : 'Tribunal Popular · FUTURO/001' }}</p>
          <p class="text-lg font-semibold">{{ title }}</p>
        </div>

        <FormStepper :step="step" :max-reached="editing ? STEPS.length - 1 : maxReached" :done="!!result || saved" @go="form.goTo" />

        <div class="mt-auto space-y-4">
          <p class="text-xs leading-relaxed text-fg/40">
            El recibo dice. El territorio dice. La comunidad dice. Los datos dicen. El Tribunal pregunta.
          </p>
          <div class="flex items-center justify-between gap-3">
            <RouterLink
              :to="{ name: editing ? 'my-folio' : 'home' }"
              class="inline-flex items-center gap-2 text-sm text-fg/70 hover:text-fg focus-visible:outline-2 focus-visible:outline-fg"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              {{ editing ? 'Cerrar sin guardar' : 'Cerrar · tu borrador se guarda' }}
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
              <p class="text-xs text-fg/50">{{ edit ? edit.testimonyFolio : 'Tribunal Popular · FUTURO/001' }}</p>
              <p class="font-semibold">{{ title }}</p>
            </div>
            <ThemeToggle class="ml-auto" />
            <RouterLink
              :to="{ name: editing ? 'my-folio' : 'home' }"
              class="grid size-10 shrink-0 place-items-center rounded-full bg-fg/10 hover:bg-fg/20 focus-visible:outline-2 focus-visible:outline-fg"
              :aria-label="editing ? 'Cerrar sin guardar' : 'Cerrar (tu borrador se guarda)'"
            >
              <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </RouterLink>
          </div>

          <div v-if="!result && !saved" class="mt-3 flex gap-1" aria-hidden="true">
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
          <SubmitSuccess
            v-if="result"
            :result="result"
            :upload="upload"
            @view-on-map="viewOnMap"
            @home="router.push({ name: 'home' })"
          />

          <!-- Edición guardada -->
          <div v-else-if="saved" class="flex flex-col items-center gap-6 py-10 text-center">
            <span class="grid size-16 place-items-center rounded-full bg-neon-lime text-black">
              <svg viewBox="0 0 24 24" class="size-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m5 12 5 5 9-10" />
              </svg>
            </span>
            <div class="space-y-2">
              <h2 class="text-2xl font-semibold">Cambios guardados</h2>
              <p class="text-fg/70">Tu testimonio vuelve a revisión antes de mostrarse otra vez en el mapa.</p>
            </div>
            <UploadProgress :upload="upload" class="w-full max-w-sm" />
            <RouterLink
              :to="{ name: 'my-folio' }"
              class="w-full max-w-sm rounded-full bg-neon-lime py-3 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
              :class="{ 'pointer-events-none opacity-50': upload.busy.value }"
            >
              Volver a Mi folio
            </RouterLink>
          </div>

          <template v-else>
            <p
              v-if="editing"
              class="mb-6 rounded-xl bg-fg/5 px-4 py-3 text-sm text-fg/80"
              role="note"
            >
              Al guardar, tu testimonio vuelve a revisión antes de mostrarse otra vez en el mapa.
            </p>
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

            <!-- Verificación antes de enviar -->
            <section v-if="isLast && captchaRequired" class="mt-6 space-y-2" aria-label="Verificación">
              <p
                v-if="captchaUnavailable"
                class="rounded-xl bg-fg/5 px-4 py-3 text-sm text-fg/80"
                role="alert"
              >
                La verificación anti-spam no está disponible en este sitio, así que por ahora no se puede enviar.
                Tu borrador se guarda.
              </p>
              <template v-else>
                <p class="text-sm text-fg/60">Confirma que eres una persona para enviar.</p>
                <TurnstileWidget
                  ref="captcha"
                  :site-key="SITE_KEY!"
                  @token="captchaToken = $event"
                  @expired="captchaToken = null"
                  @error="onCaptchaError"
                />
              </template>
            </section>
          </template>
        </div>

        <!-- Acciones (fijas abajo) -->
        <footer
          v-if="!result && !saved"
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
              :disabled="submitting || !canSubmit"
              @click="onSubmit"
            >
              {{ submitting ? (editing ? 'Guardando…' : 'Enviando…') : editing ? 'Guardar cambios' : 'Enviar testimonio' }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </main>
</template>
