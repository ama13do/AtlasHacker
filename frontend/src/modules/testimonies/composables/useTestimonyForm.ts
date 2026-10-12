import { computed, inject, provide, reactive, ref, watch, type InjectionKey } from 'vue'
import type { EvidenceType, TestimonyDraft } from '@testimonies/types/testimony'
import { normalizeParticipantFolio } from '@testimonies/utils/folio'
import { isPublishable } from '@testimonies/utils/publication'

export const STEPS = [
  { title: 'Datos generales', description: 'De qué trata, dónde ocurre y cómo quieres aparecer.' },
  { title: 'El testimonio', description: 'Cuéntanos qué sucede y qué es importante que el Tribunal conozca.' },
  { title: 'El territorio y la comunidad', description: 'Qué ha cambiado en el lugar y cómo lo ha vivido la gente.' },
  { title: 'El recibo / documento dice', description: 'Documentos, fotos u otra evidencia que ayude a documentarlo.' },
  { title: 'Los datos y la pregunta', description: 'Un dato que lo respalde y la pregunta para quien tomó la decisión.' },
  { title: 'Consentimiento', description: 'Cómo autorizas el uso de tu testimonio y cómo protegerte.' },
  { title: 'Revisión', description: 'Revisa todo antes de enviarlo.' },
] as const

export const LIMITS = { title: 80, short: 120, long: 1500 } as const

const STORAGE_KEY = 'atlashacker:testimony-draft'
const SAVE_DELAY = 400

export type FormErrors = Partial<Record<keyof TestimonyDraft, string>>

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local

function emptyDraft(): TestimonyDraft {
  return {
    topic: null,
    title: '',
    place: '',
    coordinates: null,
    locationSource: null,
    gpsAccuracy: null,
    date: today(),
    name: '',
    visibility: 'anonimo',
    facilitator: '',
    testimony: '',
    territory: '',
    community: '',
    documentStatus: null,
    documentDescription: '',
    evidence: [],
    evidenceOther: '',
    files: [],
    dataText: '',
    dataSource: '',
    dataYear: '',
    dataPendingVerification: true,
    tribunalQuestion: '',
    voluntary: false,
    consent: null,
    mediaConsent: null,
    sensitive: null,
    sensitiveHandling: null,
    folio: '',
    email: '',
    phone: '',
  }
}

// Tipos de evidencia de borradores anteriores a la conexión con la API
const LEGACY_EVIDENCE: Record<string, EvidenceType> = { recibo: 'recibo_factura', documento: 'documento_oficial' }

// Borrador guardado sin archivos (File no es serializable) ni folio o contacto (no se guardan sin pedirlo)
function loadSaved(key: string): { draft: Partial<TestimonyDraft>; step: number } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const saved = JSON.parse(raw) as { draft: Partial<TestimonyDraft>; step: number }
    if (saved.draft.evidence) saved.draft.evidence = saved.draft.evidence.map((e) => LEGACY_EVIDENCE[e] ?? e)
    // Antes se podían elegir varias medidas de protección; la API acepta una
    if (Array.isArray(saved.draft.sensitiveHandling)) saved.draft.sensitiveHandling = saved.draft.sensitiveHandling[0] ?? null
    return saved
  } catch {
    return null
  }
}

function save(key: string, draft: TestimonyDraft, step: number) {
  try {
    const { files: _files, folio: _folio, email: _email, phone: _phone, ...rest } = draft
    localStorage.setItem(key, JSON.stringify({ draft: rest, step }))
  } catch {
    // Sin almacenamiento disponible: el borrador simplemente no se conserva
  }
}

function clearSaved(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignorar
  }
}

const required = (value: string) => value.trim().length > 0

// Mismos límites que la API (CrearTestimonioSchema)
const MIN_TESTIMONY = 10
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[\d\s().-]{7,25}$/

function hasContent(d: Partial<TestimonyDraft>) {
  return !!(d.topic || d.coordinates || d.title?.trim() || d.place?.trim() || d.testimony?.trim())
}

function validate(step: number, d: TestimonyDraft): FormErrors {
  const e: FormErrors = {}

  switch (step) {
    case 0:
      if (!d.topic) e.topic = 'Elige la categoría del testimonio.'
      if (!required(d.title)) e.title = 'Escribe un título corto.'
      if (!required(d.place)) e.place = 'Indica el lugar o territorio.'
      if (!d.coordinates) e.coordinates = 'Marca la ubicación en el mapa.'
      if (!d.date) e.date = 'Indica la fecha.'
      else if (d.date > today()) e.date = 'La fecha no puede ser futura.'
      if (d.visibility === 'nombre' && !required(d.name)) e.name = 'Escribe tu nombre o elige aparecer como anónimo.'
      break
    case 1:
      if (!required(d.testimony)) e.testimony = 'Cuéntanos qué está ocurriendo.'
      else if (d.testimony.trim().length < MIN_TESTIMONY) e.testimony = `Escribe al menos ${MIN_TESTIMONY} caracteres.`
      break
    case 2:
      if (!required(d.territory)) e.territory = 'Describe qué ha cambiado o qué puede observarse.'
      break
    case 3:
      if (!d.documentStatus) e.documentStatus = 'Indica si hay algún documento o evidencia.'
      if (d.evidence.includes('otro') && !required(d.evidenceOther)) e.evidenceOther = 'Describe el otro tipo de evidencia.'
      break
    case 4: {
      if (d.dataYear) {
        const year = Number(d.dataYear)
        if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) e.dataYear = 'Año no válido.'
      }
      if (!required(d.tribunalQuestion)) e.tribunalQuestion = 'Escribe la pregunta para el Tribunal.'
      break
    }
    case 5:
      if (!d.voluntary) e.voluntary = 'Es necesario confirmar tu participación voluntaria.'
      if (!d.consent) e.consent = 'Elige cómo autorizas el uso de tu testimonio.'
      else if (d.consent === 'publico-nombre' && d.visibility === 'anonimo')
        e.consent = 'Elegiste aparecer como anónimo; elige "Público anónimo".'
      if (!d.mediaConsent) e.mediaConsent = 'Indica si autorizas el uso de foto, audio o video.'
      if (d.sensitive === null) e.sensitive = 'Indica si hay información que pueda poner a alguien en riesgo.'
      else if (d.sensitive && !d.sensitiveHandling) e.sensitiveHandling = 'Elige qué hacer con esa información.'
      if (d.folio.trim() && !normalizeParticipantFolio(d.folio)) e.folio = 'El folio tiene el formato P-XXXX-XXXX-XXXX-XXXX.'
      if (d.email.trim() && !EMAIL.test(d.email.trim())) e.email = 'Correo no válido.'
      if (d.phone.trim() && !PHONE.test(d.phone.trim())) e.phone = 'Teléfono no válido.'
      break
  }

  return e
}

export interface TestimonyFormOptions {
  // Borrador inicial (p. ej. al editar un testimonio propio); si se da, no se restaura lo guardado
  initial?: TestimonyDraft
  // Dónde se guarda el borrador; null = no se guarda (edición)
  storageKey?: string | null
  // Editando un testimonio propio: sin folio, contacto ni captcha (se identifica con el folio activo)
  editing?: boolean
}

export function useTestimonyForm({ initial, storageKey = STORAGE_KEY, editing = false }: TestimonyFormOptions = {}) {
  const saved = !initial && storageKey ? loadSaved(storageKey) : null
  const draft = reactive<TestimonyDraft>({ ...emptyDraft(), ...(initial ?? saved?.draft), files: [] })
  const step = ref(Math.min(saved?.step ?? 0, STEPS.length - 1))
  // Paso más avanzado alcanzado: hasta ahí se puede saltar desde el stepper
  const maxReached = ref(step.value)
  const errors = ref<FormErrors>({})
  // Solo cuenta como restaurado si había algo escrito
  const restored = !!saved && hasContent(saved.draft)
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let skipNextSave = false

  const isLast = computed(() => step.value === STEPS.length - 1)
  const publishable = computed(() => isPublishable(draft))

  function validateStep(n = step.value) {
    errors.value = validate(n, draft)
    return Object.keys(errors.value).length === 0
  }

  // Primer paso con errores (para la revisión final)
  function firstInvalidStep() {
    for (let n = 0; n < STEPS.length - 1; n++) {
      if (Object.keys(validate(n, draft)).length) return n
    }
    return -1
  }

  function next() {
    if (!validateStep()) return false
    if (!isLast.value) step.value++
    return true
  }

  function back() {
    errors.value = {}
    if (step.value > 0) step.value--
  }

  function goTo(n: number) {
    errors.value = {}
    step.value = n
  }

  // Errores que devuelve la API: se muestran en su paso
  function showErrors(n: number, apiErrors: FormErrors) {
    step.value = n
    errors.value = apiErrors
  }

  function reset() {
    clearTimeout(saveTimer)
    skipNextSave = true
    Object.assign(draft, emptyDraft())
    step.value = 0
    maxReached.value = 0
    errors.value = {}
    if (storageKey) clearSaved(storageKey)
  }

  watch(step, (n) => (maxReached.value = Math.max(maxReached.value, n)))

  // Limpia el error de un campo en cuanto se corrige
  watch(
    () => ({ ...draft }),
    () => {
      if (Object.keys(errors.value).length) errors.value = validate(step.value, draft)
    },
    { deep: true },
  )

  watch(
    [() => ({ ...draft }), step],
    () => {
      clearTimeout(saveTimer)
      if (skipNextSave) {
        skipNextSave = false
        return
      }
      if (storageKey) saveTimer = setTimeout(() => save(storageKey, draft, step.value), SAVE_DELAY)
    },
    { deep: true },
  )

  return { draft, step, maxReached, errors, restored, editing, isLast, publishable, validateStep, firstInvalidStep, next, back, goTo, showErrors, reset }
}

export type TestimonyForm = ReturnType<typeof useTestimonyForm>

const FORM_KEY: InjectionKey<TestimonyForm> = Symbol('testimony-form')

export function provideTestimonyForm(form: TestimonyForm) {
  provide(FORM_KEY, form)
}

// Para los pasos del wizard: acceden al formulario de la página sin pasar props
export function useTestimonyFormContext(): TestimonyForm {
  const form = inject(FORM_KEY)
  if (!form) throw new Error('useTestimonyFormContext requiere provideTestimonyForm en un ancestro')
  return form
}
