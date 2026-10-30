<script setup lang="ts">
import { stripAttachments } from '@testimonies/utils/stripMetadata'
import { computed, nextTick, onMounted, ref, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'
import type { ApiError } from '@/core/http/client'
import { adminTestimoniesService, staffEvidenceService } from '@admin/services/testimonies.service'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiCapturaRespuesta } from '@admin/types/api'
import OneTimeFolio from '@admin/components/OneTimeFolio.vue'
import { provideTestimonyForm, STEPS, useTestimonyForm } from '@testimonies/composables/useTestimonyForm'
import { useEvidenceUpload } from '@testimonies/composables/useEvidenceUpload'
import { DEFAULT_MAP_CODE } from '@testimonies/data/maps'
import { toCreatePayload } from '@testimonies/services/mappers'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { fieldErrorsFromApi } from '@testimonies/utils/apiErrors'
import FormStepper from '@testimonies/components/form/FormStepper.vue'
import StepPlace from '@testimonies/components/form/StepPlace.vue'
import StepQuestions from '@testimonies/components/form/StepQuestions.vue'
import StepStory from '@testimonies/components/form/StepStory.vue'
import StepWhat from '@testimonies/components/form/StepWhat.vue'
import UploadProgress from '@testimonies/components/UploadProgress.vue'

// Capturar una ficha en papel (POST /api/admin/testimonios): los mismos pasos que el formulario público,
// sin captcha. La persona puede ser nueva (la API emite su folio una sola vez) o una que ya tiene folio.

const STEP_COMPONENTS: Component[] = [StepWhat, StepPlace, StepStory, StepQuestions]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const route = useRoute()
const auth = useAuthStore()
// Facilitación solo captura: no ve la cola ni las fichas
const canBrowse = computed(() => auth.can('admin', 'moderador', 'lector'))
const categoriesStore = useCategoriesStore()

const form = useTestimonyForm({ storageKey: 'atlashacker:staff-draft', staff: true })
provideTestimonyForm(form)
const { draft, step, maxReached, isLast } = form

// Persona: nueva o existente (por su id de participante, p. ej. desde la ficha de la persona)
const initialPerson = typeof route.query.participante === 'string' ? route.query.participante : ''
const personMode = ref<'nueva' | 'existente'>(initialPerson ? 'existente' : 'nueva')
const participantId = ref(initialPerson)
const participantError = computed(() =>
  personMode.value === 'existente' && participantId.value.trim() && !UUID.test(participantId.value.trim()) ? 'No es un id de participante válido.' : null,
)

// Expediente (mapa) al que se suma
const dossiers = computed(() => categoriesStore.config?.dossiers ?? [])
const dossier = ref(DEFAULT_MAP_CODE)

onMounted(async () => {
  try {
    await categoriesStore.load()
  } catch {
    // El paso 1 muestra el error de categorías
  }
  if (!draft.facilitator.trim() && auth.user?.nombre) draft.facilitator = auth.user.nombre
})

const heading = ref<HTMLHeadingElement | null>(null)
watch(step, async () => {
  window.scrollTo({ top: 0 })
  await nextTick()
  heading.value?.focus()
})

const submitting = ref(false)
const submitError = ref<string | null>(null)
const result = ref<ApiCapturaRespuesta | null>(null)
const upload = useEvidenceUpload(staffEvidenceService)

function focusFirstError() {
  nextTick(() => {
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"], fieldset[aria-describedby] input:not(:disabled)')
    el?.focus()
    el?.scrollIntoView({ block: 'center' })
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
  if (personMode.value === 'existente' && (!participantId.value.trim() || participantError.value)) {
    submitError.value = 'Indica el id de la persona o elige «Persona nueva».'
    return
  }

  submitting.value = true
  submitError.value = null
  // Fotos sin metadatos (GPS, fecha, teléfono)
  const files = await stripAttachments(draft.files)
  try {
    result.value = await adminTestimoniesService.create({
      ...toCreatePayload(draft),
      expediente: dossier.value,
      ...(personMode.value === 'existente' ? { participante_id: participantId.value.trim() } : {}),
    })
    form.reset()
    if (files.length) upload.start(result.value.testimonio.id, '', files)
  } catch (error) {
    console.error(error)
    const e = error as Partial<ApiError>
    const mapped = e.code === 'DATOS_INVALIDOS' ? fieldErrorsFromApi(e.details) : null
    if (mapped) {
      form.showErrors(mapped.step, mapped.errors)
      submitError.value = 'Revisa los campos marcados.'
      focusFirstError()
    } else if (e.status === 403) {
      submitError.value = 'Tu rol no puede capturar testimonios.'
    } else if (e.status === 404) {
      submitError.value = 'No encontramos a esa persona. Revisa el id o elige «Persona nueva».'
    } else {
      submitError.value = e.message ?? 'No se pudo guardar la ficha.'
    }
  } finally {
    submitting.value = false
  }
}

function another() {
  result.value = null
  participantId.value = ''
  personMode.value = 'nueva'
  if (auth.user?.nombre) draft.facilitator = auth.user.nombre
}

const STATUS_LABELS = { pendiente: 'Pendiente de revisión', aprobado: 'Aprobado', rechazado: 'Rechazado' } as const
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-black uppercase">
          <span class="hl-box hl-lime" style="--hl-rot: -1deg">Capturar ficha</span>
        </h1>
        <p class="mt-2 text-sm opacity-70">Para fichas en papel o testimonios recogidos en campo. No pide captcha; queda registrado a tu nombre.</p>
      </div>
      <RouterLink v-if="canBrowse" :to="{ name: 'admin-testimonies' }" class="btn-hxnf btn-paper btn-sm">Ver testimonios</RouterLink>
    </div>

    <!-- Guardado -->
    <section v-if="result" class="card-brut-lg space-y-5 p-6" role="status">
      <div class="flex flex-wrap items-center gap-3">
        <span class="grid size-12 place-items-center rounded-full border-2 border-black bg-neon-green text-black shadow-[3px_3px_0_0_#000]" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10" /></svg>
        </span>
        <div>
          <h2 class="text-xl font-black uppercase">Ficha guardada</h2>
          <p class="text-sm opacity-75">
            <span class="font-mono font-semibold">{{ result.testimonio.folio }}</span> · {{ STATUS_LABELS[result.testimonio.estado] }}
            <template v-if="result.testimonio.publicado"> · ya está en el mapa</template>
          </p>
        </div>
      </div>
      <OneTimeFolio v-if="result.participante.folio" :folio="result.participante.folio" title="Folio de la persona (entrégaselo)" />
      <UploadProgress :upload="upload" />
      <div class="flex flex-wrap gap-3">
        <RouterLink v-if="canBrowse" :to="{ name: 'admin-testimony', params: { id: result.testimonio.id } }" class="btn-hxnf btn-ink">Abrir la ficha</RouterLink>
        <button type="button" class="btn-hxnf btn-lime" :disabled="upload.busy.value" @click="another">Capturar otra</button>
      </div>
    </section>

    <div v-else class="grid gap-6 lg:grid-cols-[15rem_1fr]">
      <aside class="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <FormStepper :step="step" :max-reached="maxReached" @go="form.goTo" />

        <section class="card-brut space-y-3 p-4" aria-labelledby="person-title">
          <h2 id="person-title" class="text-xs font-black tracking-wide uppercase">Persona</h2>
          <label class="flex items-start gap-2 text-sm">
            <input v-model="personMode" type="radio" value="nueva" class="mt-1 accent-black" />
            <span><span class="font-bold">Nueva</span><span class="block text-xs opacity-65">Se genera su folio al guardar.</span></span>
          </label>
          <label class="flex items-start gap-2 text-sm">
            <input v-model="personMode" type="radio" value="existente" class="mt-1 accent-black" />
            <span>
              <span class="font-bold">Ya tiene folio</span>
              <span class="block text-xs opacity-65">{{ auth.perms.admin ? 'Búscala en Personas y copia su id.' : 'Pide su id a administración.' }}</span>
            </span>
          </label>
          <div v-if="personMode === 'existente'" class="space-y-1">
            <input
              v-model="participantId"
              type="text"
              class="field-input font-mono text-xs"
              placeholder="Id de participante"
              aria-label="Id de participante"
              :aria-invalid="!!participantError"
            />
            <p v-if="participantError" class="text-xs text-danger">{{ participantError }}</p>
            <RouterLink v-if="auth.perms.admin" :to="{ name: 'admin-people' }" class="text-xs font-bold underline">Buscar en Personas</RouterLink>
          </div>
        </section>

        <section v-if="dossiers.length > 1" class="card-brut space-y-2 p-4">
          <label for="dossier" class="text-xs font-black tracking-wide uppercase">Mapa / expediente</label>
          <select id="dossier" v-model="dossier" class="field-input text-sm">
            <option v-for="d in dossiers" :key="d.code" :value="d.code">{{ d.code }} · {{ d.title }}</option>
          </select>
        </section>
      </aside>

      <section class="card-brut-lg @container min-w-0 p-5 md:p-8">
        <div class="mb-8 space-y-1">
          <p class="chip mb-2 bg-black text-[11px] tracking-wider text-white uppercase dark:bg-white dark:text-black">
            Paso {{ step + 1 }} de {{ STEPS.length }}
          </p>
          <h2 ref="heading" tabindex="-1" class="font-wide text-2xl leading-tight font-black uppercase focus:outline-none">{{ STEPS[step].title }}</h2>
          <p class="text-sm opacity-65">{{ STEPS[step].description }}</p>
        </div>

        <component :is="STEP_COMPONENTS[step]" />

        <footer class="mt-8 border-t-2 border-ink pt-5">
          <p v-if="submitError" role="alert" class="mb-3 text-sm font-semibold text-danger">{{ submitError }}</p>
          <div class="flex flex-wrap gap-3 md:justify-end">
            <button v-if="step > 0" type="button" class="btn-hxnf btn-paper" @click="form.back">Atrás</button>
            <button v-if="!isLast" type="button" class="btn-hxnf btn-ink" @click="onNext">Siguiente</button>
            <button v-else type="button" class="btn-hxnf btn-lime" :disabled="submitting" @click="onSubmit">
              {{ submitting ? 'Guardando…' : 'Guardar ficha' }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </div>
</template>
