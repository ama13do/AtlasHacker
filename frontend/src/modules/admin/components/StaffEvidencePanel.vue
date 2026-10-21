<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ApiError } from '@/core/http/client'
import { adminTestimoniesService, staffEvidenceService } from '@admin/services/testimonies.service'
import { useEvidenceUpload } from '@testimonies/composables/useEvidenceUpload'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { EvidenceAttachment, EvidenceFile, EvidenceType } from '@testimonies/types/testimony'
import MediaViewer from '@testimonies/components/media/MediaViewer.vue'
import UploadProgress from '@testimonies/components/UploadProgress.vue'
import { EVIDENCE_OPTIONS } from '@testimonies/data/categories'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiEnlaceEvidencia, ApiEvidenciaStaff } from '@admin/types/api'
import { EVIDENCIA_LABELS } from '@admin/data/labels'

// Evidencias de un testimonio (archivos y links): ver (URL temporal); hacerlas públicas/privadas: administración o quien
// capturó la ficha (ownCapture); ocultar, administración; borrar, solo superadmin. Subir: administración o quien capturó la ficha
const props = defineProps<{ testimonyId: string; items: ApiEvidenciaStaff[]; links?: ApiEnlaceEvidencia[]; ownCapture?: boolean }>()
const emit = defineEmits<{ changed: [items: ApiEvidenciaStaff[]]; 'links-changed': [links: ApiEnlaceEvidencia[]] }>()

const auth = useAuthStore()
const canModerate = computed(() => auth.perms.admin)
const canPublish = computed(() => auth.perms.admin || (!!props.ownCapture && auth.perms.capture))

const busy = ref<string | null>(null)
const confirming = ref<string | null>(null)
const error = ref<string | null>(null)

// --- Subir archivos ---
const canUpload = computed(() => auth.perms.admin || (!!props.ownCapture && auth.perms.capture))
const categoriesStore = useCategoriesStore()
categoriesStore.load().catch(() => {})
const limits = computed(() => categoriesStore.config?.limits)
const upload = useEvidenceUpload(staffEvidenceService)
const pending = ref<EvidenceAttachment[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const TYPES = EVIDENCE_OPTIONS

function guessType(file: File): EvidenceType {
  if (file.type.startsWith('image/')) return 'foto'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type === 'application/pdf') return 'documento_oficial'
  if (/csv|spreadsheet|excel/.test(file.type)) return 'datos'
  return 'otro'
}

function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  error.value = null
  const allowed = limits.value?.mimeTypes
  const accepted = files.filter((f) => !allowed?.length || allowed.includes(f.type))
  if (accepted.length < files.length) error.value = 'Algunos archivos no tienen un formato permitido y se omitieron.'
  pending.value = [...pending.value, ...accepted.map((file) => ({ id: crypto.randomUUID(), file, type: guessType(file) }))]
}

function startUpload() {
  if (!pending.value.length) return
  upload.start(props.testimonyId, '', pending.value)
  pending.value = []
}

// Al terminar, la lista se vuelve a pedir (con estado y folio de cada archivo)
watch(upload.busy, async (busyNow, was) => {
  if (!was || busyNow) return
  try {
    emit('changed', await adminTestimoniesService.evidence(props.testimonyId))
  } catch {
    // La lista se actualiza al recargar la ficha
  }
})

const size = (b: number) => (b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`)

// Fotos, videos, audios y PDF se ven aquí mismo (el PDF con el visor propio: en el celular abrirlo en otra
// pestaña lo descarga); lo demás (hojas de cálculo, documentos) se abre en otra pestaña
const PREVIEWABLE = /^(image|video|audio)\/|^application\/pdf$/
const viewing = ref<EvidenceFile | null>(null)

async function view(e: ApiEvidenciaStaff) {
  busy.value = e.id
  error.value = null
  if (PREVIEWABLE.test(e.mime)) {
    try {
      const url = await adminTestimoniesService.evidenceUrl(e.id)
      viewing.value = { id: e.id, folio: e.folio, type: e.tipo as EvidenceType, mime: e.mime, name: e.nombre_original, url, description: e.descripcion }
    } catch (err) {
      error.value = (err as Partial<ApiError>).message ?? 'No se pudo abrir la evidencia.'
    } finally {
      busy.value = null
    }
    return
  }
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

async function publishLink(l: ApiEnlaceEvidencia) {
  busy.value = l.url
  error.value = null
  try {
    emit('links-changed', await adminTestimoniesService.publishLink(props.testimonyId, l.url, !l.publica))
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
  <section class="border-2 border-ink bg-card shadow-brut space-y-3 rounded-[22px] p-4" aria-labelledby="ev-title">
    <h2 id="ev-title" class="text-sm font-black uppercase">Evidencias <span class="font-normal text-fg/50">({{ items.length }})</span></h2>
    <p v-if="!items.length" class="text-sm text-fg/50">Sin archivos.</p>
    <ul v-else class="space-y-2">
      <li
        v-for="e in items"
        :key="e.id"
        class="space-y-2 rounded-2xl border-2 border-ink/25 p-3 text-sm"
        :class="{ 'opacity-60': !e.activo }"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <span class="min-w-0 truncate font-semibold">{{ e.nombre_original }}</span>
          <span class="text-xs text-fg/50">{{ EVIDENCIA_LABELS[e.tipo] ?? e.tipo }} · {{ size(e.bytes) }} · {{ e.folio }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span v-if="e.estado_subida !== 'subida'" class="chip bg-card">Subida incompleta</span>
          <span v-else-if="!e.activo" class="chip bg-card">Oculta</span>
          <span v-else-if="e.publica" class="rounded-full bg-neon-green px-2 py-0.5 font-semibold text-black">Pública</span>
          <span v-else class="chip bg-card">Privada</span>

          <span class="ml-auto flex flex-wrap gap-3">
            <button v-if="e.estado_subida === 'subida'" type="button" class="font-semibold text-accent-ink hover:underline disabled:opacity-50" :disabled="busy === e.id" @click="view(e)">
              Ver
            </button>
            <button
              v-if="canPublish && e.activo && e.estado_subida === 'subida'"
              type="button"
              class="hover:underline disabled:opacity-50"
              :disabled="busy === e.id"
              @click="update(e, { publica: !e.publica })"
            >
              {{ e.publica ? 'Hacer privada' : 'Hacer pública' }}
            </button>
            <template v-if="canModerate">
              <button type="button" class="hover:underline disabled:opacity-50" :disabled="busy === e.id" @click="update(e, { activo: !e.activo })">
                {{ e.activo ? 'Ocultar' : 'Mostrar' }}
              </button>
              <template v-if="auth.perms.remove">
                <template v-if="confirming === e.id">
                  <button type="button" class="font-semibold text-danger hover:underline" :disabled="busy === e.id" @click="remove(e)">Sí, eliminar</button>
                  <button type="button" class="text-fg/60 hover:underline" @click="confirming = null">Cancelar</button>
                </template>
                <button v-else type="button" class="text-danger hover:underline" @click="confirming = e.id">Eliminar</button>
              </template>
            </template>
          </span>
        </div>
      </li>
    </ul>
    <!-- Links de evidencia (publicaciones, videos, notas…): se publican igual que las fotos -->
    <template v-if="links?.length">
      <h3 class="text-xs font-black uppercase">Links <span class="font-normal text-fg/50">({{ links.length }})</span></h3>
      <ul class="space-y-2">
        <li v-for="l in links" :key="l.url" class="space-y-2 rounded-2xl border-2 border-ink/25 p-3 text-sm">
          <a :href="l.url" target="_blank" rel="noopener noreferrer" class="block break-all font-semibold underline">{{ l.url }}</a>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span v-if="l.publica" class="rounded-full bg-neon-green px-2 py-0.5 font-semibold text-black">Público</span>
            <span v-else class="chip bg-card">Privado</span>
            <button v-if="canPublish" type="button" class="ml-auto hover:underline disabled:opacity-50" :disabled="busy === l.url" @click="publishLink(l)">
              {{ l.publica ? 'Hacer privado' : 'Hacer público' }}
            </button>
          </div>
        </li>
      </ul>
    </template>
    <!-- Subir archivos -->
    <div v-if="canUpload" class="space-y-3 rounded-2xl border-2 border-dashed border-ink/50 p-3">
      <div class="flex flex-wrap items-center gap-2">
        <input ref="fileInput" type="file" multiple class="sr-only" :accept="limits?.mimeTypes.join(',')" @change="onFiles" />
        <button type="button" class="btn-hxnf btn-paper btn-sm" :disabled="upload.busy.value" @click="fileInput?.click()">Agregar archivos</button>
        <button v-if="pending.length" type="button" class="btn-hxnf btn-lime btn-sm" :disabled="upload.busy.value" @click="startUpload">
          Subir {{ pending.length }} {{ pending.length === 1 ? 'archivo' : 'archivos' }}
        </button>
        <span v-if="limits" class="text-xs opacity-60">Máx. {{ limits.maxFiles }} archivos · {{ Math.round(limits.maxBytes / 1048576) }} MB en total</span>
      </div>
      <ul v-if="pending.length" class="space-y-2">
        <li v-for="(p, i) in pending" :key="p.id" class="flex flex-wrap items-center gap-2 text-sm">
          <span class="min-w-0 flex-1 truncate font-semibold">{{ p.file.name }}</span>
          <select v-model="p.type" class="field-input w-auto py-1 text-xs" :aria-label="`Tipo de ${p.file.name}`">
            <option v-for="t in TYPES" :key="t" :value="t">{{ EVIDENCIA_LABELS[t] }}</option>
          </select>
          <button type="button" class="text-xs font-bold underline" @click="pending.splice(i, 1)">Quitar</button>
        </li>
      </ul>
      <UploadProgress v-if="upload.items.value.length" :upload="upload" />
    </div>

    <p class="text-xs text-fg/50">Cada vez que se abre una evidencia queda registrado en la bitácora.</p>
    <MediaViewer v-if="viewing" :files="[viewing]" :index="0" :title="viewing.folio" @close="viewing = null" />
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
  </section>
</template>
