<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { adminTestimoniesService } from '@admin/services/testimonies.service'
import { useAuthStore } from '@admin/stores/auth'
import type { AccionModeracion, ApiTestimonioStaff } from '@admin/types/api'

// Acciones de moderación según el estado del testimonio y el rol (admin/moderador; eliminar solo admin)
const props = defineProps<{ testimony: ApiTestimonioStaff }>()
const emit = defineEmits<{ updated: [testimony: ApiTestimonioStaff]; deleted: [] }>()

const auth = useAuthStore()
const canModerate = computed(() => auth.can('admin', 'moderador'))
const isAdmin = computed(() => auth.can('admin'))

type Panel = 'aprobar' | 'rechazar' | 'desaprobar' | 'eliminar' | null
const panel = ref<Panel>(null)
const motivo = ref('')
// Por defecto se publica la multimedia si la persona lo autorizó (recibos y documentos oficiales nunca)
const publishMedia = ref(props.testimony.autoriza_multimedia === 'si')
const confirmFolio = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

const t = computed(() => props.testimony)
const notPublishable = computed(
  () => t.value.autorizacion === 'solo_documentacion_interna' || t.value.autorizacion === 'no_autoriza' || t.value.sensible_accion === 'uso_interno',
)

function open(p: Panel) {
  panel.value = p
  motivo.value = ''
  confirmFolio.value = ''
  error.value = null
}

async function run(action: AccionModeracion) {
  if (action === 'rechazar' && !motivo.value.trim()) return
  busy.value = true
  error.value = null
  try {
    const body = action === 'aprobar' ? { publicar_evidencias: publishMedia.value } : motivo.value.trim() ? { motivo: motivo.value.trim() } : {}
    emit('updated', await adminTestimoniesService.moderate(t.value.id, action, body))
    panel.value = null
  } catch (e) {
    error.value = (e as Partial<ApiError>).message ?? 'No se pudo aplicar la acción.'
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (confirmFolio.value.trim().toUpperCase() !== t.value.folio.toUpperCase()) return
  busy.value = true
  error.value = null
  try {
    await adminTestimoniesService.remove(t.value.id, t.value.folio)
    emit('deleted')
  } catch (e) {
    error.value = (e as Partial<ApiError>).message ?? 'No se pudo eliminar.'
  } finally {
    busy.value = false
  }
}

const btn = 'rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50'
</script>

<template>
  <section v-if="canModerate" class="border-2 border-ink bg-card shadow-brut space-y-3 rounded-[22px] p-4" aria-label="Moderación">
    <div class="flex flex-wrap gap-2">
      <template v-if="t.activo">
        <button v-if="t.estado !== 'aprobado'" type="button" :class="[btn, 'bg-neon-green text-black']" @click="open('aprobar')">Aprobar</button>
        <button v-if="t.estado !== 'rechazado'" type="button" :class="[btn, 'bg-brand-orange text-black']" @click="open('rechazar')">Rechazar</button>
        <button v-if="t.estado !== 'pendiente'" type="button" :class="[btn, 'border border-fg/25 hover:border-fg']" @click="open('desaprobar')">
          Regresar a revisión
        </button>
        <button type="button" :class="[btn, 'border border-fg/25 hover:border-fg']" :disabled="busy" @click="run('desactivar')">Dar de baja</button>
      </template>
      <button v-else type="button" :class="[btn, 'bg-fg text-surface']" :disabled="busy" @click="run('activar')">Reactivar</button>
      <button v-if="isAdmin" type="button" :class="[btn, 'ml-auto text-danger hover:underline']" @click="open('eliminar')">
        Eliminar definitivamente
      </button>
    </div>

    <!-- Aprobar -->
    <div v-if="panel === 'aprobar'" class="space-y-3 rounded-xl bg-fg/5 p-3 text-sm">
      <p v-if="notPublishable" class="font-semibold">
        Por su autorización, este testimonio se aprobará pero no se mostrará en el mapa.
      </p>
      <p v-else>Se publicará en el mapa{{ t.ubicacion_aproximada ? ' con ubicación aproximada (~1 km)' : '' }}.</p>
      <label class="flex cursor-pointer items-center gap-2">
        <input v-model="publishMedia" type="checkbox" class="size-4 accent-neon-lime" />
        Publicar fotos, audio y video ({{ t.autoriza_multimedia === 'si' ? 'la persona lo autorizó' : 'la persona NO lo autorizó' }})
      </label>
      <p class="text-xs text-fg/60">Recibos y documentos oficiales nunca se publican automáticamente.</p>
      <div class="flex gap-2">
        <button type="button" :class="[btn, 'bg-neon-green text-black']" :disabled="busy" @click="run('aprobar')">Confirmar aprobación</button>
        <button type="button" class="text-sm text-fg/60 hover:underline" @click="panel = null">Cancelar</button>
      </div>
    </div>

    <!-- Rechazar / regresar a revisión -->
    <div v-if="panel === 'rechazar' || panel === 'desaprobar'" class="space-y-2 rounded-xl bg-fg/5 p-3 text-sm">
      <label for="motivo" class="font-semibold">
        {{ panel === 'rechazar' ? 'Motivo del rechazo (lo verá la persona en «Mi folio»)' : 'Motivo (opcional, queda en la bitácora)' }}
      </label>
      <textarea id="motivo" v-model="motivo" rows="3" maxlength="1000" class="field-input text-sm" />
      <div class="flex gap-2">
        <button
          type="button"
          :class="[btn, panel === 'rechazar' ? 'bg-brand-orange text-black' : 'bg-fg text-surface']"
          :disabled="busy || (panel === 'rechazar' && !motivo.trim())"
          @click="run(panel)"
        >
          {{ panel === 'rechazar' ? 'Confirmar rechazo' : 'Regresar a revisión' }}
        </button>
        <button type="button" class="text-sm text-fg/60 hover:underline" @click="panel = null">Cancelar</button>
      </div>
    </div>

    <!-- Eliminar (irreversible) -->
    <div v-if="panel === 'eliminar'" class="space-y-2 rounded-xl border border-brand-orange/50 p-3 text-sm">
      <p class="font-semibold">Esto borra el testimonio, sus comentarios, reacciones, auditoría y archivos. No se puede deshacer.</p>
      <p class="text-fg/70">Para ocultarlo sin borrarlo usa «Dar de baja». Si de verdad quieres eliminarlo, escribe su folio:</p>
      <input v-model="confirmFolio" type="text" class="field-input font-mono text-sm" :placeholder="t.folio" aria-label="Folio del testimonio para confirmar" />
      <div class="flex gap-2">
        <button
          type="button"
          :class="[btn, 'bg-brand-orange text-black']"
          :disabled="busy || confirmFolio.trim().toUpperCase() !== t.folio.toUpperCase()"
          @click="remove"
        >
          Eliminar definitivamente
        </button>
        <button type="button" class="text-sm text-fg/60 hover:underline" @click="panel = null">Cancelar</button>
      </div>
    </div>

    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
  </section>
</template>
