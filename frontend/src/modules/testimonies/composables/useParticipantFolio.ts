import { ref } from 'vue'

// Folio de participante recordado en este dispositivo (solo si la persona lo pide).
// Es su llave para subir más testimonios y editar los suyos; se manda en la cabecera X-Folio
const STORAGE_KEY = 'atlashacker:folio'

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const remembered = ref<string | null>(read())

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

  return { remembered, remember, forget }
}
