<script setup lang="ts">
import { useId } from 'vue'
import type { EvidenceUpload } from '@testimonies/composables/useEvidenceUpload'
import { EVIDENCE_LABELS } from '@testimonies/data/categories'
import type { UploadItem } from '@testimonies/types/testimony'

// Progreso de subida de evidencias (las subidas las maneja quien usa useEvidenceUpload)
const props = defineProps<{ upload: EvidenceUpload }>()
const { items: uploads, busy: uploading, uploaded, failed } = props.upload
const titleId = useId()

function uploadStatus(item: UploadItem) {
  switch (item.status) {
    case 'pendiente':
      return 'En espera'
    case 'subiendo':
      return `Subiendo ${Math.round(item.progress * 100)} %`
    case 'confirmando':
      return 'Verificando…'
    case 'lista':
      return item.folio ? `Lista · ${item.folio}` : 'Lista'
    case 'error':
      return item.error ?? 'No se pudo subir'
  }
}
</script>

<template>
  <section v-if="uploads.length" class="space-y-3 rounded-2xl border border-fg/15 p-4 text-left" :aria-labelledby="titleId">
    <header class="flex items-baseline justify-between gap-3">
      <h3 :id="titleId" class="text-sm font-semibold">Evidencias</h3>
      <p class="text-xs text-fg/60 tabular-nums" aria-live="polite">
        {{ uploaded }} de {{ uploads.length }} {{ uploads.length === 1 ? 'archivo subido' : 'archivos subidos' }}
      </p>
    </header>
    <ul class="space-y-3">
      <li v-for="item in uploads" :key="item.id" class="space-y-1.5">
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span class="min-w-0 truncate">{{ item.name }}</span>
          <span class="shrink-0 text-xs text-fg/50">{{ EVIDENCE_LABELS[item.type] }}</span>
        </div>
        <div
          class="h-1.5 overflow-hidden rounded-full bg-fg/10"
          role="progressbar"
          :aria-label="`Progreso de ${item.name}`"
          :aria-valuenow="Math.round(item.progress * 100)"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full rounded-full transition-[width]"
            :class="item.status === 'error' ? 'bg-brand-orange' : item.status === 'lista' ? 'bg-neon-green' : 'bg-neon-lime'"
            :style="{ width: `${(item.status === 'error' ? 1 : item.progress) * 100}%` }"
          />
        </div>
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs" :class="item.status === 'error' ? 'text-danger' : 'text-fg/60'">{{ uploadStatus(item) }}</p>
          <button
            v-if="item.status === 'error'"
            type="button"
            class="shrink-0 text-xs font-semibold text-accent-ink hover:underline disabled:opacity-50"
            :disabled="uploading"
            @click="upload.retry(item.id)"
          >
            Reintentar
          </button>
        </div>
      </li>
    </ul>
    <p v-if="uploading" class="text-xs text-fg/60">No cierres esta página hasta que terminen las subidas.</p>
    <p v-else-if="failed" class="text-xs text-fg/60">
      Si no se pueden subir ahora, guarda tu folio: podrás agregarlos después.
    </p>
  </section>
</template>
