import { computed, inject, provide, reactive, ref, watch, type InjectionKey } from 'vue'
import type { DraftSource, EvidenceType, TestimonyDraft } from '@testimonies/types/testimony'
import { normalizeParticipantFolio } from '@testimonies/utils/folio'
import { isPublishable } from '@testimonies/utils/publication'
import { asText } from '@testimonies/utils/text'

export { asText }

// Orden del Manual para llenar testimonios y evidencias (Anexo): primero la voz de la persona y después
// las cinco secciones del formato (01 recibo, 02 territorio, 03 comunidad, 04 datos, 05 pregunta)
export const STEPS = [
  { title: 'Datos generales', description: 'De qué trata, dónde ocurre y cómo quieres aparecer.' },
  { title: 'El testimonio', description: 'Con tus propias palabras: ¿qué está ocurriendo y qué es importante que el Tribunal conozca?' },
  { title: '01 · El recibo dice', description: 'Documentos, recibos, fotos u otra evidencia. Primero registra lo que el documento dice, sin interpretarlo.' },
  { title: '02 · El territorio · 03 · La comunidad', description: 'Lo que puede observarse en el lugar y la voz de quienes lo viven.' },
  { title: '04 · Los datos · 05 · La pregunta', description: 'Datos con su fuente y la pregunta pública para quien tomó la decisión.' },
  { title: 'Consentimiento y cuidados', description: 'Cómo autorizas el uso de tu testimonio y cómo protegemos a las personas.' },
  { title: 'Revisión', description: 'Revisa todo antes de enviarlo.' },
] as const

export const LIMITS = { title: 80, short: 120, long: 1500 } as const

const STORAGE_KEY = 'atlashacker:testimony-draft'
const SAVE_DELAY = 400

export type FormErrors = Partial<Record<keyof TestimonyDraft, string>>

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local

export function emptySource(): DraftSource {
  return { id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, source: '', year: '', link: '' }
}

function emptyDraft(): TestimonyDraft {
  return {
    topic: null,
    title: '',
    place: '',
    coordinates: null,
    state: '',
    municipality: '',
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
    sources: [emptySource()],
    dataPendingVerification: true,
    tribunalQuestion: '',
    anythingElse: '',
    voiceRecord: '',
    voluntary: false,
    consent: null,
    mediaConsent: null,
    voiceImage: null,
    sensitive: null,
    minors: null,
    stripMetadata: true,
    sensitiveHandling: null,
    folio: '',
    email: '',
    phone: '',
  }
}

// Tipos de evidencia de borradores anteriores a la conexión con la API
// …y de la primera versión con API (antes del Manual), donde recibo/factura y documento oficial iban juntos
const LEGACY_EVIDENCE: Record<string, EvidenceType> = {
  recibo_factura: 'recibo',
  documento_oficial: 'oficio',
  documento: 'oficio',
}

// Borrador guardado sin archivos (File no es serializable) ni folio o contacto (no se guardan sin pedirlo)

// Deja el borrador guardado con la forma actual: cada campo con el tipo que espera el formulario.
// Un borrador de una versión anterior (p. ej. el año guardado como número) rompía el formulario en cada carga
// y dejaba la pantalla en blanco aunque se recargara la página
function sanitize(saved: Partial<TestimonyDraft>): Partial<TestimonyDraft> {
  const base = emptyDraft() as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(saved)) {
    if (!(key in base) || key === 'files') continue
    const expected = base[key]
    if (key === 'sources') {
      out.sources = Array.isArray(value)
        ? (value as unknown as Record<string, unknown>[]).map((s) => ({ ...emptySource(), source: asText(s?.source), year: asText(s?.year), link: asText(s?.link) }))
        : [emptySource()]
    } else if (key === 'coordinates') {
      out.coordinates = Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === 'number') ? value : null
    } else if (typeof expected === 'string') {
      out[key] = asText(value)
    } else if (Array.isArray(expected)) {
      if (Array.isArray(value)) out[key] = value
    } else if (typeof expected === 'boolean') {
      if (typeof value === 'boolean') out[key] = value
    } else {
      out[key] = value // null por defecto: se valida al usarse
    }
  }
  return out as Partial<TestimonyDraft>
}

function loadSaved(key: string): { draft: Partial<TestimonyDraft>; step: number } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const saved = JSON.parse(raw) as { draft: Partial<TestimonyDraft>; step: number }
    if (!saved || typeof saved !== 'object' || !saved.draft || typeof saved.draft !== 'object') return null
    if (saved.draft.evidence) saved.draft.evidence = saved.draft.evidence.map((e) => LEGACY_EVIDENCE[e] ?? e)
    // Antes se podían elegir varias medidas de protección; la API acepta una
    if (Array.isArray(saved.draft.sensitiveHandling)) saved.draft.sensitiveHandling = saved.draft.sensitiveHandling[0] ?? null
    // Antes había un solo «Fuente» y «Año»: pasan a la lista de fuentes
    const old = saved.draft as Partial<TestimonyDraft> & { dataSource?: string; dataYear?: string }
    if (!old.sources?.length) {
      old.sources = [{ ...emptySource(), source: old.dataSource ?? '', year: old.dataYear ?? '' }]
      delete old.dataSource
      delete old.dataYear
    }
    saved.draft = sanitize(saved.draft)
    saved.step = Number.isInteger(saved.step) ? saved.step : 0
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
    // Manual C.6: ninguna de las cinco secciones es obligatoria («no inventes información para llenar los espacios»)
    case 2:
      if (!d.documentStatus) e.documentStatus = 'Indica si hay algún documento o evidencia (puede ser «Pendiente»).'
      if (d.evidence.includes('otro') && !required(d.evidenceOther)) e.evidenceOther = 'Describe el otro tipo de evidencia.'
      break
    case 4: {
      const badYear = d.sources.some((s) => {
        if (!asText(s.year).trim()) return false
        const year = Number(s.year)
        return !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()
      })
      if (badYear) e.sources = 'Revisa el año de las fuentes.'
      else if (d.sources.some((s) => !asText(s.source).trim() && (asText(s.year).trim() || asText(s.link).trim()))) e.sources = 'Escribe el nombre de cada fuente.'
      break
    }
    case 5:
      if (!d.voluntary) e.voluntary = 'Es necesario confirmar tu participación voluntaria.'
      if (!d.consent) e.consent = 'Elige cómo autorizas el uso de tu testimonio.'
      else if (d.consent === 'publico-nombre' && d.visibility === 'anonimo')
        e.consent = 'Elegiste aparecer como anónimo; elige "Público anónimo".'
      if (!d.voiceImage) e.voiceImage = 'Indica si autorizas la transmisión o grabación de tu voz o imagen.'
      if (!d.mediaConsent) e.mediaConsent = 'Indica si las personas fotografiadas autorizaron el uso de su imagen.'
      if (d.minors === null) e.minors = 'Indica si hay información de niñas, niños o adolescentes.'
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
  // Captura desde el panel (ficha en papel): sin folio de participante en el formulario
  staff?: boolean
}

export function useTestimonyForm({ initial, storageKey = STORAGE_KEY, editing = false, staff = false }: TestimonyFormOptions = {}) {
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

  return { draft, step, maxReached, errors, restored, editing, staff, isLast, publishable, validateStep, firstInvalidStep, next, back, goTo, showErrors, reset }
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
