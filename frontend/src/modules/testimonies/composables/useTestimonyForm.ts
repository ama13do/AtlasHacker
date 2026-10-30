import { computed, inject, provide, reactive, ref, watch, type InjectionKey } from 'vue'
import type { TestimonyDraft } from '@testimonies/types/testimony'
import { asksThreats, classifyFacts, COMPLAINT_LABELS, FACT_KEYS, protectionMode, SINCE_LABELS, THREATS_LABELS } from '@testimonies/data/facts'
import { normalizeParticipantFolio } from '@testimonies/utils/folio'
import { asText } from '@testimonies/utils/text'

export { asText }

// Formulario de 4 pantallas del prototipo v2 del Atlas (hoja UI-MVP): qué pasa, dónde y desde cuándo, el relato
// y dos preguntas. Los testimonios anteriores conservan sus respuestas del formato del Manual
export const STEPS = [
  { title: '¿Qué pasa?', description: 'Toca una o varias. La primera que toques es la principal.' },
  { title: '¿Dónde y desde cuándo?', description: 'Marca el lugar y dinos desde cuándo pasa.' },
  { title: 'Cuéntalo', description: 'Con tus propias palabras: qué está pasando y qué quieres preguntarle al Tribunal.' },
  { title: 'Dos preguntas', description: 'Si ya reclamaste y cómo quieres aparecer.' },
] as const

export const LIMITS = { title: 80, short: 120, long: 1500, testimony: 2000 } as const

const STORAGE_KEY = 'atlashacker:testimony-draft'
const SAVE_DELAY = 400

export type FormErrors = Partial<Record<keyof TestimonyDraft, string>>

function emptyDraft(): TestimonyDraft {
  return {
    facts: [],
    topic: null,
    coordinates: null,
    state: '',
    municipality: '',
    place: '',
    locationSource: null,
    gpsAccuracy: null,
    since: null,
    ongoing: null,
    title: '',
    testimony: '',
    tribunalQuestion: '',
    links: [],
    files: [],
    complaint: null,
    threats: null,
    visibility: 'anonimo',
    name: '',
    facilitator: '',
    consent: null,
    voluntary: false,
    folio: '',
    email: '',
    phone: '',
  }
}

// Deja el borrador guardado con la forma actual: cada campo con el tipo que espera el formulario.
// Un borrador de una versión anterior (p. ej. del formulario del Manual) conserva lo que sigue existiendo
function sanitize(saved: Partial<TestimonyDraft>): Partial<TestimonyDraft> {
  const base = emptyDraft() as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(saved)) {
    if (!(key in base) || key === 'files') continue
    const expected = base[key]
    if (key === 'coordinates') {
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
  // Respuestas fuera del catálogo actual se descartan
  const d = out as Partial<TestimonyDraft>
  if (d.facts) d.facts = d.facts.filter((f, i, all) => FACT_KEYS.includes(f) && all.indexOf(f) === i)
  if (d.since && !(d.since in SINCE_LABELS)) d.since = null
  if (d.complaint && !(d.complaint in COMPLAINT_LABELS)) d.complaint = null
  if (d.threats && !(d.threats in THREATS_LABELS)) d.threats = null
  if (d.ongoing !== undefined && typeof d.ongoing !== 'boolean') d.ongoing = null
  // Borradores viejos o alterados: la API rechaza valores fuera de catálogo
  if (d.locationSource && !['gps', 'mapa'].includes(d.locationSource)) d.locationSource = 'mapa'
  if (d.visibility && !['anonimo', 'nombre'].includes(d.visibility)) d.visibility = 'anonimo'
  if (d.consent && !['publico-nombre', 'publico-anonimo', 'interno', 'no-publicar'].includes(d.consent)) d.consent = null
  if (d.gpsAccuracy !== undefined && typeof d.gpsAccuracy !== 'number') d.gpsAccuracy = null
  return d
}

function loadSaved(key: string): { draft: Partial<TestimonyDraft>; step: number } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const saved = JSON.parse(raw) as { draft: Partial<TestimonyDraft>; step: number }
    if (!saved || typeof saved !== 'object' || !saved.draft || typeof saved.draft !== 'object') return null
    saved.draft = sanitize(saved.draft)
    saved.step = Number.isInteger(saved.step) ? saved.step : 0
    return saved
  } catch {
    return null
  }
}

// Borrador guardado sin archivos (File no es serializable) ni folio o contacto (no se guardan sin pedirlo)
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

export const MAX_LINKS = 20

// Link pegado por la persona → URL completa (agrega https:// si falta); null si no es un link válido
export function normalizeLink(value: string): string | null {
  const raw = asText(value).trim()
  if (!raw || raw.length > 2000 || /\s/.test(raw)) return null
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.') ? url.href : null
  } catch {
    return null
  }
}

// Mismos límites que la API (CrearTestimonioSchema)
const MIN_TESTIMONY = 10
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[\d\s().-]{7,25}$/

function hasContent(d: Partial<TestimonyDraft>) {
  return !!(d.facts?.length || d.coordinates || d.title?.trim() || d.testimony?.trim())
}

function validate(step: number, d: TestimonyDraft): FormErrors {
  const e: FormErrors = {}

  switch (step) {
    case 0:
      if (!d.facts.length) e.facts = 'Elige al menos una opción.'
      else if (!d.topic) e.facts = 'No pudimos asignar la categoría. Recarga la página e inténtalo de nuevo.'
      break
    case 1:
      if (!d.coordinates) e.coordinates = 'Marca el lugar en el mapa.'
      if (!required(d.state)) e.state = 'Elige el estado.'
      if (!required(d.municipality))
        e.municipality = 'El municipio es obligatorio: sin él no podemos contar casos ni vincular compromisos de tu territorio.'
      if (!d.since) e.since = 'Elige desde cuándo pasa.'
      if (d.ongoing === null) e.ongoing = 'Indica si sigue pasando.'
      break
    case 2:
      if (!required(d.title)) e.title = 'Escribe un título.'
      if (!required(d.testimony)) e.testimony = 'Cuenta lo que pasa.'
      else if (d.testimony.trim().length < MIN_TESTIMONY) e.testimony = `Escribe al menos ${MIN_TESTIMONY} caracteres.`
      if (d.links.some((l) => !normalizeLink(l))) e.links = 'Revisa los links: alguno no es válido.'
      break
    case 3:
      if (!d.complaint) e.complaint = 'Indica si ya reclamaste.'
      if (asksThreats(d.facts) && !d.threats) e.threats = 'Responde esta pregunta (puedes elegir «Prefiero no decir»).'
      if (d.visibility === 'nombre' && !protectionMode(d.facts, d.threats) && !required(d.name))
        e.name = 'Escribe el nombre con el que quieres aparecer.'
      if (!d.voluntary) e.voluntary = 'Es necesario confirmar tu participación voluntaria.'
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
  const step = ref(Math.min(Math.max(saved?.step ?? 0, 0), STEPS.length - 1))
  // Paso más avanzado alcanzado: hasta ahí se puede saltar desde el stepper
  const maxReached = ref(step.value)
  const errors = ref<FormErrors>({})
  // Solo cuenta como restaurado si había algo escrito
  const restored = !!saved && hasContent(saved.draft)
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let skipNextSave = false

  const isLast = computed(() => step.value === STEPS.length - 1)
  // Modo protección (amenazas): anónimo, ubicación aproximada y revisión antes de publicar; el back también lo hace valer
  const protection = computed(() => protectionMode(draft.facts, draft.threats))

  function validateStep(n = step.value) {
    errors.value = validate(n, draft)
    return Object.keys(errors.value).length === 0
  }

  // Primer paso con errores (antes de enviar)
  function firstInvalidStep() {
    for (let n = 0; n < STEPS.length; n++) {
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

  // La categoría sale sola del hecho principal (un testimonio anterior sin hechos conserva la suya)
  watch(
    () => [...draft.facts],
    (facts) => {
      const classified = classifyFacts(facts)
      if (classified) draft.topic = classified.category
      if (!asksThreats(facts)) draft.threats = null
    },
    { immediate: true },
  )

  watch(
    protection,
    (on) => {
      if (on) draft.visibility = 'anonimo'
    },
    { immediate: true },
  )

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

  return { draft, step, maxReached, errors, restored, editing, staff, isLast, protection, validateStep, firstInvalidStep, next, back, goTo, showErrors, reset }
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
