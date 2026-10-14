<script setup lang="ts">
import { ref, watch } from 'vue'
import type { EvidenceFile } from '@testimonies/types/testimony'
import MediaThumb from '@testimonies/components/media/MediaThumb.vue'
import MediaViewer from '@testimonies/components/media/MediaViewer.vue'

// Carrete de evidencias (fotos, videos, audios y documentos) del testimonio abierto. Toca una para verla en grande
defineProps<{ files: EvidenceFile[]; title?: string; size?: 'sm' | 'md' }>()
// Avisa al abrir y cerrar el visor (las historias se pausan mientras tanto)
const emit = defineEmits<{ viewer: [open: boolean] }>()

const open = ref<number | null>(null)
watch(open, (value, before) => {
  if ((value === null) !== (before === null)) emit('viewer', value !== null)
})
</script>

<template>
  <div>
    <ul class="flex snap-x gap-2.5 overflow-x-auto px-0.5 pt-1 pb-2 [scrollbar-width:thin]" aria-label="Evidencias del testimonio">
      <li v-for="(file, i) in files" :key="file.id" class="shrink-0 snap-start">
        <button
          type="button"
          class="block rounded-2xl shadow-[3px_3px_0_0_#000] transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
          :aria-label="`Ver evidencia ${i + 1}: ${file.description || file.name}`"
          @click="open = i"
        >
          <MediaThumb :file="file" :size="size" />
        </button>
      </li>
    </ul>
    <MediaViewer v-if="open !== null" :files="files" :index="open" :title="title" @update:index="open = $event" @close="open = null" />
  </div>
</template>
