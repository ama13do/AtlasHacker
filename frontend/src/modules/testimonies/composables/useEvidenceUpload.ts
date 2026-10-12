import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { ApiError } from '@/core/http/client'
import { evidenceService, type Reservation } from '@testimonies/services/evidence.service'
import type { EvidenceAttachment, UploadItem } from '@testimonies/types/testimony'

// Margen para no usar una URL firmada a punto de expirar
const EXPIRY_MARGIN = 30_000

function messageOf(error: unknown) {
  const e = error as Partial<ApiError>
  if (e?.code === 'ARCHIVO_NO_SUBIDO') return 'El archivo no llegó al almacenamiento. Reintenta.'
  if (e?.status === null || e?.code === 'SUBIDA_FALLIDA') return 'No se pudo subir. Revisa tu conexión y reintenta.'
  return e?.message ?? 'No se pudo subir.'
}

// Sube las evidencias de un testimonio recién creado, una por una, con progreso por archivo
export function useEvidenceUpload(service = evidenceService) {
  const items = ref<UploadItem[]>([])
  const busy = ref(false)

  let context: { testimonyId: string; folio: string } | null = null
  const files = new Map<string, File>()
  const reservations = new Map<string, Reservation>()

  const done = computed(() => items.value.length > 0 && items.value.every((i) => i.status === 'lista'))
  const failed = computed(() => items.value.filter((i) => i.status === 'error').length)
  const uploaded = computed(() => items.value.filter((i) => i.status === 'lista').length)

  const item = (id: string) => items.value.find((i) => i.id === id)!

  function fail(id: string, error: unknown) {
    console.error(error)
    Object.assign(item(id), { status: 'error', error: messageOf(error) })
  }

  async function reserve(ids: string[]) {
    const attachments = ids.map((id) => {
      const i = item(id)
      return { id, file: files.get(id)!, type: i.type }
    })
    try {
      const result = await service.reserve(context!.testimonyId, context!.folio, attachments)
      result.forEach((r, n) => {
        reservations.set(ids[n], r)
        item(ids[n]).folio = r.folio
      })
      return true
    } catch (error) {
      ids.forEach((id) => fail(id, error))
      return false
    }
  }

  async function uploadOne(id: string) {
    const reservation = reservations.get(id)
    const file = files.get(id)
    if (!reservation || !file) return
    const current = item(id)
    Object.assign(current, { status: 'subiendo', progress: 0, error: undefined })
    try {
      await service.put(reservation, file, (ratio) => (current.progress = ratio))
      current.status = 'confirmando'
      await service.confirm(context!.testimonyId, reservation.evidenceId, context!.folio)
      Object.assign(current, { status: 'lista', progress: 1 })
    } catch (error) {
      fail(id, error)
    }
  }

  async function start(testimonyId: string, folio: string, attachments: EvidenceAttachment[]) {
    if (!attachments.length) return
    context = { testimonyId, folio }
    attachments.forEach((a) => files.set(a.id, a.file))
    items.value = attachments.map((a) => ({
      id: a.id,
      name: a.file.name,
      size: a.file.size,
      type: a.type,
      status: 'pendiente',
      progress: 0,
    }))

    busy.value = true
    try {
      const ids = attachments.map((a) => a.id)
      if (await reserve(ids)) {
        // De uno en uno: más estable en conexiones móviles
        for (const id of ids) await uploadOne(id)
      }
    } finally {
      busy.value = false
    }
  }

  async function retry(id: string) {
    if (!context || busy.value) return
    busy.value = true
    try {
      const reservation = reservations.get(id)
      // Sin reserva o con la URL vencida: se vuelve a reservar solo este archivo
      if (!reservation || reservation.expiresAt - EXPIRY_MARGIN < Date.now()) {
        reservations.delete(id)
        Object.assign(item(id), { status: 'pendiente', error: undefined })
        if (!(await reserve([id]))) return
      }
      await uploadOne(id)
    } finally {
      busy.value = false
    }
  }

  // Avisa si se intenta cerrar la página con subidas en curso
  function onBeforeUnload(e: BeforeUnloadEvent) {
    e.preventDefault()
  }
  watch(busy, (on) =>
    on ? window.addEventListener('beforeunload', onBeforeUnload) : window.removeEventListener('beforeunload', onBeforeUnload),
  )
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

  return { items, busy, done, failed, uploaded, start, retry }
}

export type EvidenceUpload = ReturnType<typeof useEvidenceUpload>
