<script setup lang="ts">
import { track } from '@/core/analytics/analytics'
import { stripAttachments } from '@testimonies/utils/stripMetadata'
import { computed, defineAsyncComponent, nextTick, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DEFAULT_MAP_SLUG } from '@testimonies/data/maps'
import { provideTestimonyForm, STEPS, useTestimonyForm } from '@testimonies/composables/useTestimonyForm'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'
import type { CreateTestimonyResult, TestimonyDraft } from '@testimonies/types/testimony'
import StepPlace from '@testimonies/components/form/StepPlace.vue'
import StepQuestions from '@testimonies/components/form/StepQuestions.vue'
import StepStory from '@testimonies/components/form/StepStory.vue'
import StepWhat from '@testimonies/components/form/StepWhat.vue'
import FormStepper from '@testimonies/components/form/FormStepper.vue'
import SubmitSuccess from '@testimonies/components/form/SubmitSuccess.vue'
import SubmitCelebration from '@testimonies/components/form/SubmitCelebration.vue'
import { marchIsUpcoming } from '@/core/config/event'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'
import TurnstileWidget from '@/shared/components/TurnstileWidget.vue'
import type { ApiError } from '@/core/http/client'
import { useEvidenceUpload } from '@testimonies/composables/useEvidenceUpload'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import { fieldErrorsFromApi } from '@testimonies/utils/apiErrors'
import { normalizeParticipantFolio } from '@testimonies/utils/folio'
import { participantService } from '@testimonies/services/participant.service'
import UploadProgress from '@testimonies/components/UploadProgress.vue'
import { guideInputOf, hasGuide, type GuideInput } from '@testimonies/utils/guideInput'

// La guía trae los datos del Excel: se carga solo cuando se abre
const TestimonyGuide = defineAsyncComponent(() => import('@testimonies/components/guide/TestimonyGuide.vue'))

// Sin `edit`: subir un testimonio nuevo. Con `edit`: editar uno propio (desde Mi folio)
// `panel`: dentro del inicio (barra lateral en escritorio, pantalla completa en móvil), en una sola columna
const props = defineProps<{
  edit?: { id: string; testimonyFolio: string; participantFolio: string; draft: TestimonyDraft }
  variant?: 'page' | 'panel'
}>()
const editing = !!props.edit
const panel = props.variant === 'panel'

const STEP_COMPONENTS: Component[] = [StepWhat, StepPlace, StepStory, StepQuestions]

const router = useRouter()
const route = useRoute()
// Mapa al que pertenece el envío (en Mi folio no hay: se vuelve al principal)
const mapSlug = computed(() => (typeof route.params.mapa === 'string' ? route.params.mapa : DEFAULT_MAP_SLUG))
const closeTo = computed(() => (editing ? { name: 'my-folio' } : { name: 'map', params: { mapa: mapSlug.value } }))
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
// Ventana de cierre (testimonio guardado, aparta la fecha, redes) encima de la pantalla del folio
const celebrate = ref(false)
// Solo en local: ?preview=exito la muestra sin enviar nada (la API de desarrollo es la de producción)
const previewCelebration = ref(import.meta.env.DEV && route.query.preview === 'exito')
// Guía después de enviar (con una copia de las respuestas: el borrador se limpia)
const guideInput = ref<GuideInput | null>(null)
const showGuide = ref(false)
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
  if (!panel) window.scrollTo({ top: 0 })
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
  // Se copian antes de limpiar el borrador. Las fotos van sin metadatos (GPS, fecha, teléfono)
  const files = await stripAttachments(draft.files)
  const folio = normalizeParticipantFolio(draft.folio) ?? rememberedFolio.value
  try {
    result.value = await store.create({ ...draft, files }, { captchaToken: captchaToken.value, folio })
    // «success»: la persona llegó al final y su testimonio quedó guardado (conteo de quienes terminan)
    track('success', { tipo: 'testimonio', categoria: draft.topic ?? undefined, con_evidencias: files.length > 0, participante_nuevo: !folio })
    celebrate.value = marchIsUpcoming()
    guideInput.value = guideInputOf(draft)
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
  // Fotos sin metadatos (GPS, fecha, teléfono)
  const files = await stripAttachments(draft.files)
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
    form.showErrors(STEPS.length - 1, { folio: 'Este folio no es válido. Revísalo o envía sin folio.' })
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

const GUIDE_STATUS = { pendiente: 'en revisión, todavía no es público', aprobado: 'publicado en el mapa', rechazado: 'no publicado' } as const

function openGuide(open: boolean) {
  showGuide.value = open
  scroller.value?.scrollTo({ top: 0 })
  if (!panel) window.scrollTo({ top: 0 })
}

function viewOnMap() {
  if (result.value) router.push({ name: 'map', params: { mapa: mapSlug.value }, query: { t: result.value.id } })
}
</script>

<template>
  <main :class="panel ? 'flex h-full flex-col bg-surface' : 'min-h-dvh md:h-dvh md:p-6'">
    <div
      :class="
        panel
          ? 'flex min-h-0 flex-1 flex-col'
          : 'mx-auto flex min-h-dvh flex-col bg-card md:grid md:h-full md:min-h-0 md:max-w-6xl md:grid-cols-[17rem_1fr] md:overflow-hidden md:rounded-[28px] md:border-2 md:border-ink md:shadow-brut-lg'
      "
    >
      <!-- Lateral (escritorio): marca, pasos y salida -->
      <aside v-if="!panel" class="hidden flex-col gap-8 border-r-2 border-ink bg-surface p-6 md:flex">
        <div>
          <p class="text-xs text-fg/50">{{ edit ? edit.testimonyFolio : `Tribunal Popular · ${store.dossier ?? 'FUTURO/001'}` }}</p>
          <p class="mt-2 text-xl font-black uppercase"><span class="hl-box hl-lime" style="--hl-rot: -1deg">{{ title }}</span></p>
        </div>

        <FormStepper :step="step" :max-reached="editing ? STEPS.length - 1 : maxReached" :done="!!result || saved" @go="form.goTo" />

        <div class="mt-auto space-y-4">
          <p class="text-xs leading-relaxed text-fg/40">
            Lo que vives cuenta. Tu testimonio se revisa antes de sumarse al mapa.
          </p>
          <div class="flex items-center justify-between gap-3">
            <RouterLink
              :to="closeTo"
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

      <section class="flex flex-1 flex-col" :class="panel ? 'min-h-0' : 'md:min-h-0'">
        <!-- Header (móvil; en panel, siempre) -->
        <header
          class="z-10 border-b-2 border-ink bg-surface px-4 pb-3"
          :class="panel ? 'pt-1 md:px-5 md:pt-4' : 'sticky top-0 pt-[max(env(safe-area-inset-top),0.75rem)] md:hidden'"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-fg/50">{{ edit ? edit.testimonyFolio : `Tribunal Popular · ${store.dossier ?? 'FUTURO/001'}` }}</p>
              <p class="mt-1 text-lg leading-tight font-black uppercase"><span class="hl-box hl-lime" style="--hl-rot: -1deg">{{ title }}</span></p>
            </div>
            <ThemeToggle class="ml-auto" />
            <RouterLink
              :to="closeTo"
              class="icon-btn"
              :aria-label="editing ? 'Cerrar sin guardar' : 'Cerrar (tu borrador se guarda)'"
            >
              <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </RouterLink>
          </div>

          <div v-if="!result && !saved" class="mt-3 flex gap-1.5" aria-hidden="true">
            <span
              v-for="(_, i) in STEPS"
              :key="i"
              class="h-2.5 flex-1 rounded-full border-2 border-ink transition-colors"
              :class="i < step ? 'bg-neon-green' : i === step ? 'bg-neon-lime' : 'bg-card'"
            />
          </div>
        </header>

        <!-- Contenido (en escritorio con scroll interno) -->
        <div
          ref="scroller"
          class="@container flex-1 px-4 py-6"
          :class="panel ? 'min-h-0 overflow-y-auto md:px-5' : 'md:overflow-y-auto md:px-10 md:py-8'"
        >
          <template v-if="result">
            <div v-if="showGuide && guideInput" class="space-y-6">
              <UploadProgress :upload="upload" />
              <TestimonyGuide :input="guideInput" :folio="result.folio" :status="GUIDE_STATUS[result.status]">
                <div class="mt-6 flex flex-col gap-3 @xl:flex-row">
                  <button type="button" class="btn-hxnf btn-paper" @click="openGuide(false)">Volver a tu folio</button>
                  <button v-if="result.published" type="button" class="btn-hxnf btn-lime" @click="viewOnMap">Ver en el mapa</button>
                </div>
              </TestimonyGuide>
            </div>
            <SubmitSuccess
              v-else
              :result="result"
              :upload="upload"
              :has-guide="!!guideInput && hasGuide(guideInput)"
              @guide="openGuide(true)"
              @view-on-map="viewOnMap"
              @home="router.push(closeTo)"
            />
          </template>

          <!-- Edición guardada -->
          <div v-else-if="saved" class="flex flex-col items-center gap-6 py-10 text-center">
            <span class="grid size-16 place-items-center rounded-full border-2 border-black bg-neon-lime text-black shadow-[4px_4px_0_0_#000]">
              <svg viewBox="0 0 24 24" class="size-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m5 12 5 5 9-10" />
              </svg>
            </span>
            <div class="space-y-2">
              <h2 class="text-2xl font-black uppercase">Cambios guardados</h2>
              <p class="text-fg/70">Tu testimonio vuelve a revisión antes de mostrarse otra vez en el mapa.</p>
            </div>
            <UploadProgress :upload="upload" class="w-full max-w-sm" />
            <RouterLink
              :to="{ name: 'my-folio' }"
              class="btn-hxnf btn-lime w-full max-w-sm"
              :class="{ 'pointer-events-none opacity-50': upload.busy.value }"
            >
              Volver a Mi folio
            </RouterLink>
          </div>

          <template v-else>
            <p
              v-if="editing"
              class="mb-6 rounded-2xl border-2 border-ink bg-neon-lime/30 px-4 py-3 text-sm font-semibold"
              role="note"
            >
              Al guardar, tu testimonio vuelve a revisión antes de mostrarse otra vez en el mapa.
            </p>
            <div
              v-if="showRestored"
              class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-ink px-4 py-3 text-sm"
              role="status"
            >
              <span>Recuperamos tu borrador. Los archivos adjuntos hay que volver a elegirlos.</span>
              <button type="button" class="font-bold underline decoration-2 underline-offset-2 hover:bg-neon-lime hover:text-black" @click="startOver">
                Empezar de nuevo
              </button>
            </div>

            <div class="mb-8 space-y-1">
              <p class="chip mb-2 bg-black text-[11px] tracking-wider text-white uppercase dark:bg-white dark:text-black">
                Paso {{ step + 1 }} de {{ STEPS.length }}
              </p>
              <h2 ref="heading" tabindex="-1" class="font-wide text-2xl leading-tight font-black uppercase focus:outline-none @3xl:text-3xl">
                {{ STEPS[step].title }}
              </h2>
              <p class="text-sm text-fg/60">{{ STEPS[step].description }}</p>
            </div>

            <component :is="STEP_COMPONENTS[step]" />

            <!-- Verificación antes de enviar -->
            <section v-if="isLast && captchaRequired" class="mt-6 space-y-2" aria-label="Verificación">
              <p
                v-if="captchaUnavailable"
                class="rounded-2xl border-2 border-brand-orange px-4 py-3 text-sm"
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

          <!-- Ventana de cierre (aparta la fecha, redes): encima de lo que haya -->
          <SubmitCelebration
            v-if="(result && celebrate) || previewCelebration"
            :published="result?.published ?? false"
            :has-folio="result ? !!result.participantFolio : true"
            @close="(celebrate = false), (previewCelebration = false)"
          />
        </div>

        <!-- Acciones (fijas abajo) -->
        <footer
          v-if="!result && !saved"
          class="border-t-2 border-ink bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
          :class="panel ? 'md:px-5' : 'sticky bottom-0 md:static md:px-10 md:py-4'"
        >
          <p v-if="submitError" role="alert" class="mb-3 text-sm font-semibold text-danger">{{ submitError }}</p>
          <div class="flex gap-3 md:justify-end">
            <button
              v-if="step > 0"
              type="button"
              class="btn-hxnf btn-paper"
              @click="form.back"
            >
              Atrás
            </button>
            <button
              v-if="!isLast"
              type="button"
              class="btn-hxnf btn-ink flex-1 md:flex-none"
              @click="onNext"
            >
              Siguiente
            </button>
            <button
              v-else
              type="button"
              class="btn-hxnf btn-lime flex-1 md:flex-none"
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
