<script setup lang="ts">
import { computed } from 'vue'
import { EVIDENCE_LABELS } from '@testimonies/data/categories'
import type { EvidenceFile } from '@testimonies/types/testimony'

// Miniatura de una evidencia pública: la imagen o el primer cuadro del video; audio y documentos con su ícono
const props = defineProps<{ file: EvidenceFile; size?: 'sm' | 'md' }>()

const kind = computed(() => {
  if (props.file.mime.startsWith('image/')) return 'image'
  if (props.file.mime.startsWith('video/')) return 'video'
  if (props.file.mime.startsWith('audio/')) return 'audio'
  return 'doc'
})
</script>

<template>
  <span class="relative block overflow-hidden rounded-2xl border-2 border-black bg-white" :class="size === 'sm' ? 'size-20' : 'size-28'">
    <img v-if="kind === 'image'" :src="file.url" :alt="file.description || file.name" class="size-full object-cover" loading="lazy" decoding="async" />
    <template v-else-if="kind === 'video'">
      <!-- #t=0.1: el navegador pinta un cuadro como portada -->
      <video :src="`${file.url}#t=0.1`" class="size-full object-cover" muted playsinline preload="metadata" aria-hidden="true" />
      <span class="absolute inset-0 grid place-items-center" aria-hidden="true">
        <span class="grid size-9 place-items-center rounded-full border-2 border-black bg-neon-lime text-black">
          <svg viewBox="0 0 24 24" class="ml-0.5 size-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </span>
    </template>
    <span v-else class="grid size-full place-items-center bg-neon-lime/40 text-black" aria-hidden="true">
      <svg v-if="kind === 'audio'" viewBox="0 0 24 24" class="size-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
      <svg v-else viewBox="0 0 24 24" class="size-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" />
      </svg>
    </span>
    <span class="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">{{ EVIDENCE_LABELS[file.type] }}</span>
  </span>
</template>
