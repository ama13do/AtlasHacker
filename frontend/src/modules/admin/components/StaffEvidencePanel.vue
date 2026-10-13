<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { adminTestimoniesService } from '@admin/services/testimonies.service'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiEvidenciaStaff } from '@admin/types/api'
import { EVIDENCIA_LABELS } from '@admin/data/labels'

// Evidencias de un testimonio: ver (URL temporal), hacer pública/privada, ocultar y eliminar
const props = defineProps<{ testimonyId: string; items: ApiEvidenciaStaff[] }>()
const emit = defineEmits<{ changed: [items: ApiEvidenciaStaff[]] }>()

const auth = useAuthStore()
const canModerate = computed(() => auth.can('admin', 'moderador'))

const busy = ref<string | null>(null)
const confirming = ref<string | null>(null)
const error = ref<string | null>(null)

const size = (b: number) => (b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`)

async function view(e: ApiEvidenciaStaff) {
  busy.value = e.id
  error.value = null
  // Se abre la pestaña antes de pedir la URL para que el navegador no la bloquee
  // (con 'noopener' window.open devuelve null; se corta el vínculo a mano)
  const tab = window.open('', '_blank')
  if (tab) tab.opener = null
  try {
    const url = await adminTestimoniesService.evidenceUrl(e.id)
    if (tab) tab.location.href = url
    else window.open(url, '_blank', 'noopener')
  } catch (err) {
    tab?.close()
    error.value = (err as Partial<ApiError>).message ?? 'No se pudo abrir la evidencia.'
  } finally {
    busy.value = null
  }
}

async function update(e: ApiEvidenciaStaff, changes: { publica?: boolean; activo?: boolean }) {
  busy.value = e.id
  error.value = null
  try {
    emit('changed', await adminTestimoniesService.updateEvidence(props.testimonyId, e.id, changes))
  } catch (err) {
    error.value = (err as Partial<ApiError>).message ?? 'No se pudo actualizar.'
  } finally {
    busy.value = null
  }
}

async function remove(e: ApiEvidenciaStaff) {
  busy.value = e.id
  error.value = null
  try {
    await adminTestimoniesService.deleteEvidence(props.testimonyId, e.id)
    emit('changed', props.items.filter((x) => x.id !== e.id))
  } catch (err) {
    error.value = (err as Partial<ApiError>).message ?? 'No se pudo eliminar.'
  } finally {
    busy.value = null
    confirming.value = null
  }
}
</script>

<template>
  <section class="space-y-3 rounded-2xl border border-fg/15 p-4" aria-labelledby="ev-title">
    <h2 id="ev-title" class="text-sm font-semibold">Evidencias <span class="font-normal text-fg/50">({{ items.length }})</span></h2>
    <p v-if="!items.length" class="text-sm text-fg/50">Sin archivos.</p>
    <ul v-else class="space-y-2">
      <li
        v-for="e in items"
        :key="e.id"
        class="space-y-2 rounded-xl border border-fg/10 p-3 text-sm"
        :class="{ 'opacity-60': !e.activo }"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <span class="min-w-0 truncate font-semibold">{{ e.nombre_original }}</span>
          <span class="text-xs text-fg/50">{{ EVIDENCIA_LABELS[e.tipo] ?? e.tipo }} · {{ size(e.bytes) }} · {{ e.folio }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span v-if="e.estado_subida !== 'subida'" class="rounded-full border border-fg/25 px-2 py-0.5">Subida incompleta</span>
          <span v-else-if="!e.activo" class="rounded-full border border-fg/25 px-2 py-0.5">Oculta</span>
          <span v-else-if="e.publica" class="rounded-full bg-neon-green px-2 py-0.5 font-semibold text-black">Pública</span>
          <span v-else class="rounded-full border border-fg/25 px-2 py-0.5">Privada</span>

          <span class="ml-auto flex flex-wrap gap-3">
            <button v-if="e.estado_subida === 'subida'" type="button" class="font-semibold text-accent-ink hover:underline disabled:opacity-50" :disabled="busy === e.id" @click="view(e)">
              Ver
            </button>
            <template v-if="canModerate">
              <button
                v-if="e.activo && e.estado_subida === 'subida'"
                type="button"
                class="hover:underline disabled:opacity-50"
                :disabled="busy === e.id"
                @click="update(e, { publica: !e.publica })"
              >
                {{ e.publica ? 'Hacer privada' : 'Hacer pública' }}
              </button>
              <button type="button" class="hover:underline disabled:opacity-50" :disabled="busy === e.id" @click="update(e, { activo: !e.activo })">
                {{ e.activo ? 'Ocultar' : 'Mostrar' }}
              </button>
              <template v-if="confirming === e.id">
                <button type="button" class="font-semibold text-danger hover:underline" :disabled="busy === e.id" @click="remove(e)">Sí, eliminar</button>
                <button type="button" class="text-fg/60 hover:underline" @click="confirming = null">Cancelar</button>
              </template>
              <button v-else type="button" class="text-danger hover:underline" @click="confirming = e.id">Eliminar</button>
            </template>
          </span>
        </div>
      </li>
    </ul>
    <p class="text-xs text-fg/50">Cada vez que se abre una evidencia queda registrado en la bitácora.</p>
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
  </section>
</template>
