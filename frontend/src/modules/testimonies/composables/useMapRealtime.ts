import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase, realtimeConfigured } from '@/core/realtime/supabase'
import { toSummary } from '@testimonies/services/mappers'
import { testimoniesService } from '@testimonies/services/testimonies.service'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'

const CHANNEL = 'mapa'

// Payload de testimonio.publicado / .actualizado (solo datos públicos); retirado trae solo { id }
interface MapEvent {
  id: string
}

// Pines en vivo: escucha el canal privado "mapa" de Supabase Realtime y actualiza el store
export function useMapRealtime() {
  const store = useTestimoniesStore()
  const live = ref(false)
  // Testimonio abierto que dejó de ser público (para avisar)
  const removedNotice = ref<string | null>(null)
  let channel: RealtimeChannel | null = null
  let disposed = false

  // El payload no trae fecha ni lugar: se pide la ficha pública y se arma el resumen
  async function upsert({ id }: MapEvent) {
    try {
      const detail = await testimoniesService.getDetail(id)
      // Solo los del mapa (expediente) que se está viendo
      if (store.dossier && detail.dossier && detail.dossier !== store.dossier) return
      store.upsertSummary(toSummary(detail), detail)
    } catch (e) {
      console.error('Tiempo real: no se pudo cargar', id, e)
    }
  }

  function retire({ id }: MapEvent) {
    if (store.selectedId === id) removedNotice.value = 'Este testimonio ya no está disponible.'
    store.remove(id)
  }

  async function connect() {
    if (!realtimeConfigured) {
      console.info('Tiempo real desactivado: faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
      return
    }
    try {
      await useCategoriesStore().load()
      if (!useCategoriesStore().config?.realtime) return

      const supabase = await getSupabase()
      if (disposed) return
      await supabase.realtime.setAuth() // Canal privado: autoriza con la anon key
      channel = supabase
        .channel(CHANNEL, { config: { private: true } })
        .on('broadcast', { event: 'testimonio.publicado' }, ({ payload }) => upsert(payload as MapEvent))
        .on('broadcast', { event: 'testimonio.actualizado' }, ({ payload }) => upsert(payload as MapEvent))
        .on('broadcast', { event: 'testimonio.retirado' }, ({ payload }) => retire(payload as MapEvent))
        .subscribe((status) => {
          live.value = status === 'SUBSCRIBED'
        })
    } catch (e) {
      console.warn('Tiempo real: no se pudo conectar', e)
    }
  }

  onMounted(connect)

  onBeforeUnmount(async () => {
    disposed = true
    live.value = false
    if (channel) (await getSupabase()).removeChannel(channel)
  })

  return { live, removedNotice, handlers: { upsert, retire } }
}
