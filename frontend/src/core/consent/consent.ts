import { computed, ref } from 'vue'

// Consentimiento de cookies y tecnologías similares. Las necesarias (sesión del panel, tema, borrador,
// identificador anónimo del dispositivo) no requieren permiso; la analítica solo se carga si la persona la
// acepta. En pantalla no se nombra la herramienta (solo en los términos y condiciones). La elección se guarda
// en este navegador y se puede cambiar en cualquier momento desde «Preferencias de cookies».

const STORAGE_KEY = 'atlashacker:consent'
// Si cambia lo que se pide (p. ej. una categoría nueva), subir la versión vuelve a preguntar
const CONSENT_VERSION = 1

export interface ConsentChoice {
  v: number
  analytics: boolean
  at: string // ISO: cuándo se eligió (evidencia del consentimiento)
}

function read(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as ConsentChoice
    return value.v === CONSENT_VERSION ? value : null
  } catch {
    return null
  }
}

const choice = ref<ConsentChoice | null>(read())
const preferencesOpen = ref(false)

export function useConsent() {
  return {
    choice,
    decided: computed(() => choice.value !== null),
    analytics: computed(() => choice.value?.analytics === true),
    preferencesOpen,
  }
}

export function saveConsent(analytics: boolean) {
  choice.value = { v: CONSENT_VERSION, analytics, at: new Date().toISOString() }
  preferencesOpen.value = false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice.value))
  } catch {
    // Sin almacenamiento: la elección vale solo para esta visita
  }
}

export function openCookiePreferences() {
  preferencesOpen.value = true
}
