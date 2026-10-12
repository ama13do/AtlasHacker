// Identificador anónimo de este dispositivo (UUID aleatorio, sin datos personales).
// La API lo usa para "una reacción/like por dispositivo"; se manda en la cabecera X-Device-Id
const STORAGE_KEY = 'atlashacker:device-id'

let cached: string | null = null

const uuid = () => crypto.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`

export function getDeviceId(): string {
  if (cached) return cached
  try {
    cached = localStorage.getItem(STORAGE_KEY)
    if (!cached) {
      cached = uuid()
      localStorage.setItem(STORAGE_KEY, cached)
    }
  } catch {
    cached ??= uuid() // Sin almacenamiento: dura lo que la visita
  }
  return cached
}
