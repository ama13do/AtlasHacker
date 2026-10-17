<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { EVIDENCE_LABELS } from '@testimonies/data/categories'
import type { EvidenceFile } from '@testimonies/types/testimony'
import PdfViewer from '@testimonies/components/media/PdfViewer.vue'

// Visor de evidencias a pantalla completa: flechas (o ← →) para pasar, Esc para cerrar
const props = defineProps<{ files: EvidenceFile[]; index: number; title?: string }>()
const emit = defineEmits<{ close: []; 'update:index': [index: number] }>()

const file = computed(() => props.files[props.index])
const kind = computed(() => {
  const mime = file.value?.mime ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf') return 'pdf'
  return 'doc'
})

function go(delta: number) {
  const n = props.files.length
  emit('update:index', (props.index + delta + n) % n)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  } else if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
}

const closeButton = ref<HTMLButtonElement | null>(null)
const previousFocus = document.activeElement as HTMLElement | null
onMounted(async () => {
  window.addEventListener('keydown', onKey, true)
  await nextTick()
  closeButton.value?.focus()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  previousFocus?.focus?.()
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[60] flex flex-col bg-black/92 text-white" role="dialog" aria-modal="true" :aria-label="`Evidencia ${index + 1} de ${files.length}`">
      <header class="flex items-center gap-3 px-4 py-3">
        <div class="min-w-0 flex-1">
          <p v-if="title" class="truncate text-xs opacity-70">{{ title }}</p>
          <p class="truncate text-sm font-bold">
            {{ EVIDENCE_LABELS[file.type] }} · {{ file.description || file.name }}
            <span class="font-normal opacity-60">· {{ index + 1 }}/{{ files.length }}</span>
          </p>
        </div>
        <a :href="file.url" target="_blank" rel="noopener noreferrer" class="btn-hxnf btn-paper btn-sm hidden border-white sm:inline-flex">Abrir original ↗</a>
        <button ref="closeButton" type="button" class="icon-btn border-white" aria-label="Cerrar visor" @click="emit('close')">
          <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>

      <div class="relative grid min-h-0 flex-1 place-items-center px-4 pb-4" @click.self="emit('close')">
        <img v-if="kind === 'image'" :key="file.id" :src="file.url" :alt="file.description || file.name" class="max-h-full max-w-full rounded-xl border-2 border-white object-contain" />
        <video v-else-if="kind === 'video'" :key="file.id" :src="file.url" controls autoplay playsinline class="max-h-full max-w-full rounded-xl border-2 border-white" />
        <div v-else-if="kind === 'audio'" class="w-full max-w-md space-y-4 rounded-[22px] border-2 border-white bg-white/10 p-6 text-center">
          <p class="font-bold">{{ file.description || file.name }}</p>
          <audio :key="file.id" :src="file.url" controls autoplay class="w-full" />
        </div>
        <PdfViewer v-else-if="kind === 'pdf'" :key="file.id" :url="file.url" :name="file.name" />
        <div v-else class="space-y-3 text-center">
          <p class="font-bold">{{ file.name }}</p>
          <a :href="file.url" target="_blank" rel="noopener noreferrer" class="btn-hxnf btn-lime">Descargar</a>
        </div>

        <template v-if="files.length > 1">
          <button type="button" class="icon-btn absolute top-1/2 left-3 -translate-y-1/2 border-white" aria-label="Evidencia anterior" @click="go(-1)">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" class="icon-btn absolute top-1/2 right-3 -translate-y-1/2 border-white" aria-label="Evidencia siguiente" @click="go(1)">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>
