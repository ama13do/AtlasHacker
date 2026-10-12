<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { EVIDENCE_LABELS } from '@testimonies/data/categories'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { EvidenceAttachment, EvidenceType } from '@testimonies/types/testimony'

// Límites por defecto de la API; los reales vienen de /api/config
const DEFAULT_LIMITS = {
  maxFiles: 5,
  maxBytes: 20 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'audio/mpeg', 'audio/mp4', 'video/mp4'],
}

// Tipos que se pueden declarar para documentos (las fotos, videos y audios se deducen del archivo)
const DOCUMENT_TYPES: EvidenceType[] = ['recibo_factura', 'documento_oficial', 'estudio', 'datos', 'mapa', 'otro']

// `hint`: cuándo se suben (en el formulario, al enviar; en Mi folio, al pulsar Subir)
const props = withDefaults(defineProps<{ evidence: EvidenceType[]; hint?: string }>(), {
  hint: 'Se subirán al enviar tu testimonio.',
})
const model = defineModel<EvidenceAttachment[]>({ required: true })

const categories = useCategoriesStore()
const limits = computed(() => categories.config?.limits ?? DEFAULT_LIMITS)
const accept = computed(() => limits.value.mimeTypes.join(','))

const input = ref<HTMLInputElement | null>(null)
const message = ref<string | null>(null)

const usedBytes = computed(() => model.value.reduce((sum, a) => sum + a.file.size, 0))

// URLs de vista previa ligadas a cada archivo; se liberan al quitarlo o al salir
const previews = new Map<string, string>()

const items = computed(() =>
  model.value.map((attachment) => {
    if (!previews.has(attachment.id)) previews.set(attachment.id, URL.createObjectURL(attachment.file))
    return { attachment, url: previews.get(attachment.id)!, kind: attachment.file.type.split('/')[0] }
  }),
)

watch(model, (attachments) => {
  for (const [id, url] of previews) {
    if (!attachments.some((a) => a.id === id)) {
      URL.revokeObjectURL(url)
      previews.delete(id)
    }
  }
})

onBeforeUnmount(() => previews.forEach((url) => URL.revokeObjectURL(url)))

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`
}

// Foto, video y audio salen del archivo; para documentos se propone uno según lo marcado arriba
function typeFor(file: File): EvidenceType {
  if (file.type.startsWith('image/')) return 'foto'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return DOCUMENT_TYPES.find((t) => props.evidence.includes(t)) ?? 'documento_oficial'
}

const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

function onChange(e: Event) {
  const selected = Array.from((e.target as HTMLInputElement).files ?? [])
  const problems: string[] = []
  const added: EvidenceAttachment[] = []
  let bytes = usedBytes.value

  for (const file of selected) {
    if (!limits.value.mimeTypes.includes(file.type)) {
      problems.push(`${file.name}: formato no permitido.`)
    } else if (model.value.length + added.length >= limits.value.maxFiles) {
      problems.push(`Solo puedes adjuntar ${limits.value.maxFiles} archivos.`)
      break
    } else if (bytes + file.size > limits.value.maxBytes) {
      problems.push(`${file.name}: se pasa del máximo de ${formatSize(limits.value.maxBytes)} en total.`)
    } else {
      bytes += file.size
      added.push({ id: newId(), file, type: typeFor(file) })
    }
  }

  message.value = problems.length ? problems.join(' ') : null
  model.value = [...model.value, ...added]
  if (input.value) input.value.value = ''
}

function remove(id: string) {
  model.value = model.value.filter((a) => a.id !== id)
}

function setType(id: string, type: EvidenceType) {
  model.value = model.value.map((a) => (a.id === id ? { ...a, type } : a))
}
</script>

<template>
  <div class="space-y-3">
    <div class="space-y-1.5">
      <div class="flex items-baseline justify-between gap-3">
        <p class="text-sm font-semibold">Adjuntar archivos <span class="text-xs font-normal text-fg/40">(opcional)</span></p>
        <span class="text-xs text-fg/40 tabular-nums">
          {{ model.length }}/{{ limits.maxFiles }} · {{ formatSize(usedBytes) }} de {{ formatSize(limits.maxBytes) }}
        </span>
      </div>
      <p class="text-xs text-fg/50">
        Fotos (JPG, PNG, WebP), video, audio o PDF. Máximo {{ formatSize(limits.maxBytes) }} en total. {{ hint }}
      </p>
    </div>

    <ul v-if="items.length" class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <li
        v-for="item in items"
        :key="item.attachment.id"
        class="relative flex flex-col overflow-hidden rounded-xl border border-fg/20 bg-fg/5"
      >
        <img v-if="item.kind === 'image'" :src="item.url" :alt="item.attachment.file.name" class="aspect-square w-full object-cover" />
        <video v-else-if="item.kind === 'video'" :src="item.url" class="aspect-square w-full object-cover" muted />
        <div v-else class="grid aspect-square w-full place-items-center p-3 text-center">
          <span class="text-xs font-semibold text-fg/80 uppercase">{{ item.kind === 'audio' ? 'Audio' : 'PDF' }}</span>
        </div>
        <div class="space-y-1 bg-surface/90 px-2 py-1.5">
          <p class="truncate text-xs">{{ item.attachment.file.name }}</p>
          <p class="text-[10px] text-fg/60">{{ formatSize(item.attachment.file.size) }}</p>
          <!-- Documentos: la persona elige qué tipo es -->
          <select
            v-if="DOCUMENT_TYPES.includes(item.attachment.type)"
            :value="item.attachment.type"
            class="w-full rounded-md border border-fg/20 bg-surface px-1.5 py-1 text-xs text-fg focus:border-neon-lime focus:outline-none light:focus:border-fg"
            :aria-label="`Tipo de ${item.attachment.file.name}`"
            @change="setType(item.attachment.id, ($event.target as HTMLSelectElement).value as EvidenceType)"
          >
            <option v-for="t in DOCUMENT_TYPES" :key="t" :value="t">{{ EVIDENCE_LABELS[t] }}</option>
          </select>
          <p v-else class="text-[10px] text-fg/60">{{ EVIDENCE_LABELS[item.attachment.type] }}</p>
        </div>
        <button
          type="button"
          class="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-surface/80 hover:bg-surface focus-visible:outline-2 focus-visible:outline-fg"
          :aria-label="`Quitar ${item.attachment.file.name}`"
          @click="remove(item.attachment.id)"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </li>
    </ul>

    <label
      v-if="model.length < limits.maxFiles"
      class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-fg/30 px-4 py-4 text-sm lg:flex-col lg:py-10 font-semibold transition hover:border-neon-lime hover:text-accent-ink has-focus-visible:outline-2 has-focus-visible:outline-fg"
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
      </svg>
      Elegir archivos
      <input ref="input" type="file" class="sr-only" multiple :accept="accept" @change="onChange" />
    </label>

    <p v-if="message" role="status" class="text-sm text-danger">{{ message }}</p>
  </div>
</template>
