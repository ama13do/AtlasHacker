<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useEvidenceUpload } from '@testimonies/composables/useEvidenceUpload'
import { EVIDENCE_LABELS } from '@testimonies/data/categories'
import { participantService } from '@testimonies/services/participant.service'
import type { LoadStatus } from '@testimonies/stores/testimonies'
import type { EvidenceAttachment, MyEvidence } from '@testimonies/types/testimony'
import EvidenceFiles from '@testimonies/components/form/EvidenceFiles.vue'
import UploadProgress from '@testimonies/components/UploadProgress.vue'

// Evidencias de un testimonio propio: ver, eliminar y agregar
const props = defineProps<{ testimonyId: string; folio: string }>()
const emit = defineEmits<{ changed: [] }>()

const items = ref<MyEvidence[]>([])
const status = ref<LoadStatus>('idle')
const confirming = ref<string | null>(null)
const deleting = ref<string | null>(null)
const error = ref<string | null>(null)

const attachments = ref<EvidenceAttachment[]>([])
const upload = useEvidenceUpload()

async function load() {
  status.value = 'loading'
  try {
    items.value = (await participantService.listEvidence(props.folio, props.testimonyId)).filter((e) => e.active)
    status.value = 'ready'
  } catch (e) {
    console.error(e)
    status.value = 'error'
  }
}

async function remove(id: string) {
  deleting.value = id
  error.value = null
  try {
    await participantService.deleteEvidence(props.folio, props.testimonyId, id)
    items.value = items.value.filter((e) => e.id !== id)
    emit('changed')
  } catch (e) {
    console.error(e)
    error.value = 'No se pudo eliminar. Intenta de nuevo.'
  } finally {
    deleting.value = null
    confirming.value = null
  }
}

async function uploadNew() {
  const files = attachments.value
  attachments.value = []
  await upload.start(props.testimonyId, props.folio, files)
}

// Al terminar las subidas se recarga la lista
watch(upload.busy, (busy, wasBusy) => {
  if (wasBusy && !busy) {
    load()
    emit('changed')
  }
})

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`
}

onMounted(load)
</script>

<template>
  <div class="@container space-y-4">
    <p v-if="status === 'loading'" class="text-sm text-fg/60" role="status">Cargando evidencias…</p>
    <div v-else-if="status === 'error'" class="flex items-center gap-3 text-sm" role="alert">
      <span class="text-fg/70">No pudimos cargar tus evidencias.</span>
      <button type="button" class="font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
    </div>
    <template v-else-if="status === 'ready'">
      <p v-if="!items.length" class="text-sm text-fg/50">Este testimonio aún no tiene evidencias.</p>
      <ul v-else class="space-y-2">
        <li
          v-for="e in items"
          :key="e.id"
          class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-fg/15 px-3 py-2 text-sm"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{{ e.name }}</span>
            <span class="block text-xs text-fg/50">
              {{ EVIDENCE_LABELS[e.type] }} · {{ formatSize(e.size) }} · {{ e.folio }}
              · {{ !e.uploaded ? 'Subida incompleta' : e.public ? 'Pública' : 'Solo documentación' }}
            </span>
          </span>
          <span v-if="confirming === e.id" class="flex items-center gap-3 text-xs">
            <span class="text-fg/70">¿Eliminar?</span>
            <button
              type="button"
              class="font-semibold text-danger hover:underline disabled:opacity-50"
              :disabled="deleting === e.id"
              @click="remove(e.id)"
            >
              {{ deleting === e.id ? 'Eliminando…' : 'Sí, eliminar' }}
            </button>
            <button type="button" class="text-fg/60 hover:underline" @click="confirming = null">Cancelar</button>
          </span>
          <button v-else type="button" class="text-xs font-semibold text-fg/60 hover:text-fg hover:underline" @click="confirming = e.id">
            Eliminar
          </button>
        </li>
      </ul>
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    </template>

    <UploadProgress :upload="upload" />

    <div class="space-y-3">
      <EvidenceFiles v-model="attachments" :evidence="[]" hint="Los límites cuentan también los archivos que ya subiste." />
      <button
        v-if="attachments.length"
        type="button"
        class="rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-surface transition hover:bg-neon-lime hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50"
        :disabled="upload.busy.value"
        @click="uploadNew"
      >
        Subir {{ attachments.length }} {{ attachments.length === 1 ? 'archivo' : 'archivos' }}
      </button>
    </div>
  </div>
</template>
