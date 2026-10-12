import { computed, ref } from 'vue'

// Folio de participante: es la llave de la persona para subir más testimonios y editar los suyos
// (cabecera X-Folio). Dos formas de tenerlo:
// - recordado: en este dispositivo (localStorage), solo si la persona lo pide
// - de sesión: solo en memoria, se pierde al recargar
const STORAGE_KEY = 'atlashacker:folio'

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const remembered = ref<string | null>(read())
const session = ref<string | null>(null)
// El que se usa para enviar y para "Mi folio"
const active = computed(() => session.value ?? remembered.value)

export function useParticipantFolio() {
  function remember(folio: string) {
    remembered.value = folio
    try {
      localStorage.setItem(STORAGE_KEY, folio)
    } catch {
      // Sin almacenamiento: se recuerda solo durante esta visita
    }
  }

  function forget() {
    remembered.value = null
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignorar
    }
  }

  function signIn(folio: string, keep: boolean) {
    session.value = folio
    if (keep) remember(folio)
  }

  // `forgetDevice`: también lo olvida en este dispositivo
  function signOut(forgetDevice = false) {
    session.value = null
    if (forgetDevice) forget()
  }

  return { remembered, active, remember, forget, signIn, signOut }
}
