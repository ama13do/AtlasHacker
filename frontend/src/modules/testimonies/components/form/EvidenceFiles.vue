<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const MAX_FILES = 5
const MAX_SIZE = 20 * 1024 * 1024
const ACCEPT = 'image/*,video/*,audio/*,application/pdf'

const model = defineModel<File[]>({ required: true })

const input = ref<HTMLInputElement | null>(null)
const message = ref<string | null>(null)

// URLs de vista previa ligadas a cada File; se liberan al quitarlo o al salir
const previews = new Map<File, string>()

const items = computed(() =>
  model.value.map((file) => {
    if (!previews.has(file)) previews.set(file, URL.createObjectURL(file))
    return { file, url: previews.get(file)!, kind: file.type.split('/')[0] }
  }),
)

watch(model, (files) => {
  for (const [file, url] of previews) {
    if (!files.includes(file)) {
      URL.revokeObjectURL(url)
      previews.delete(file)
    }
  }
})

onBeforeUnmount(() => previews.forEach((url) => URL.revokeObjectURL(url)))

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function onChange(e: Event) {
  const selected = Array.from((e.target as HTMLInputElement).files ?? [])
  const tooBig = selected.filter((f) => f.size > MAX_SIZE)
  const valid = selected.filter((f) => f.size <= MAX_SIZE)
  const room = MAX_FILES - model.value.length

  message.value = tooBig.length
    ? `${tooBig.map((f) => f.name).join(', ')} supera${tooBig.length > 1 ? 'n' : ''} 20 MB.`
    : valid.length > room
      ? `Solo puedes adjuntar ${MAX_FILES} archivos.`
      : null

  model.value = [...model.value, ...valid.slice(0, room)]
  if (input.value) input.value.value = ''
}

function remove(file: File) {
  model.value = model.value.filter((f) => f !== file)
}
</script>

<template>
  <div class="space-y-3">
    <div class="space-y-1.5">
      <div class="flex items-baseline justify-between">
        <p class="text-sm font-semibold">Adjuntar archivos <span class="text-xs font-normal text-fg/40">(opcional)</span></p>
        <span class="text-xs text-fg/40 tabular-nums">{{ model.length }}/{{ MAX_FILES }}</span>
      </div>
      <p class="text-xs text-fg/50">Fotos, video, audio o PDF. Máximo 20 MB por archivo.</p>
    </div>

    <!-- TODO etapa 3: subir a R2 (reservar → PUT → confirmar) con el folio -->
    <p class="rounded-xl bg-fg/5 px-3 py-2 text-xs text-fg/70" role="note">
      Por ahora los archivos no se envían con el testimonio. Podrás agregarlos después con tu folio.
    </p>

    <ul v-if="items.length" class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <li v-for="item in items" :key="item.url" class="relative overflow-hidden rounded-xl border border-fg/20 bg-fg/5">
        <img v-if="item.kind === 'image'" :src="item.url" :alt="item.file.name" class="aspect-square w-full object-cover" />
        <video v-else-if="item.kind === 'video'" :src="item.url" class="aspect-square w-full object-cover" muted />
        <div v-else class="grid aspect-square w-full place-items-center p-3 text-center">
          <span class="text-xs font-semibold text-fg/80 uppercase">{{ item.kind === 'audio' ? 'Audio' : 'PDF' }}</span>
        </div>
        <div class="absolute inset-x-0 bottom-0 bg-surface/80 px-2 py-1">
          <p class="truncate text-xs">{{ item.file.name }}</p>
          <p class="text-[10px] text-fg/60">{{ formatSize(item.file.size) }}</p>
        </div>
        <button
          type="button"
          class="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-surface/80 hover:bg-surface focus-visible:outline-2 focus-visible:outline-fg"
          :aria-label="`Quitar ${item.file.name}`"
          @click="remove(item.file)"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </li>
    </ul>

    <label
      v-if="model.length < MAX_FILES"
      class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-fg/30 px-4 py-4 text-sm lg:flex-col lg:py-10 font-semibold transition hover:border-neon-lime hover:text-accent-ink has-focus-visible:outline-2 has-focus-visible:outline-fg"
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
      </svg>
      Elegir archivos
      <input ref="input" type="file" class="sr-only" multiple :accept="ACCEPT" @change="onChange" />
    </label>

    <p v-if="message" role="status" class="text-sm text-danger">{{ message }}</p>
  </div>
</template>
