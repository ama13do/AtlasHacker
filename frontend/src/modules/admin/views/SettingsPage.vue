<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { settingsService } from '@admin/services/settings.service'
import type { ApiConfiguracion, ModoPublicacion } from '@admin/types/api'

const MB = 1024 * 1024

const MODES: { value: ModoPublicacion; label: string; description: string }[] = [
  { value: 'revisar_todo', label: 'Revisar todo', description: 'Nada aparece en el mapa hasta que alguien del equipo lo aprueba.' },
  {
    value: 'auto_si_no_sensible',
    label: 'Automática salvo sensibles',
    description: 'Se publica al instante si la persona autorizó publicarlo y no marcó información sensible.',
  },
  { value: 'auto_todo', label: 'Automática', description: 'Se publica al instante todo lo que tenga autorización pública.' },
]

const MIME_OPTIONS: { value: string; label: string }[] = [
  { value: 'image/jpeg', label: 'JPG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
  { value: 'application/pdf', label: 'PDF' },
  { value: 'audio/mpeg', label: 'MP3' },
  { value: 'audio/mp4', label: 'M4A' },
  { value: 'audio/ogg', label: 'OGG' },
  { value: 'audio/wav', label: 'WAV' },
  { value: 'audio/webm', label: 'Audio WebM' },
  { value: 'video/mp4', label: 'MP4' },
  { value: 'video/webm', label: 'Video WebM' },
  { value: 'video/quicktime', label: 'MOV' },
]

type Toggle = { key: keyof ApiConfiguracion; label: string; hint?: string }
const PARTICIPATION: Toggle[] = [
  { key: 'comentarios_habilitados', label: 'Comentarios habilitados' },
  { key: 'comentarios_requieren_moderacion', label: 'Los comentarios requieren aprobación', hint: 'Si está apagado, se publican al instante.' },
  { key: 'reacciones_habilitadas', label: 'Reacciones habilitadas' },
  { key: 'participantes_pueden_editar', label: 'Las personas pueden editar sus testimonios' },
  { key: 'participantes_pueden_eliminar', label: 'Las personas pueden dar de baja sus testimonios' },
  { key: 'edicion_requiere_revision', label: 'Las ediciones vuelven a revisión' },
  { key: 'mapa_tiempo_real', label: 'Mapa en tiempo real', hint: 'Los testimonios publicados aparecen sin recargar.' },
]
const SECURITY: Toggle[] = [
  { key: 'captcha_requerido', label: 'Pedir captcha al subir y comentar' },
  { key: 'auditoria_envio_activa', label: 'Guardar auditoría del envío (IP cifrada, navegador, GPS)' },
]

// Cambios que alteran lo que ve el público o la protección anti-spam: piden confirmación
const SENSITIVE_KEYS: (keyof ApiConfiguracion)[] = ['modo_publicacion', 'captcha_requerido']

const saved = ref<ApiConfiguracion | null>(null)
const form = ref<ApiConfiguracion | null>(null)
const maxMb = ref(0)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const saving = ref(false)
const confirming = ref(false)
const message = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

function reset(c: ApiConfiguracion) {
  saved.value = c
  form.value = structuredClone(c)
  maxMb.value = Math.round((c.max_bytes_totales_por_testimonio / MB) * 10) / 10
}

async function load() {
  status.value = 'loading'
  try {
    reset(await settingsService.get())
    status.value = 'ready'
  } catch (e) {
    console.error(e)
    status.value = 'error'
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Solo lo que cambió
const changes = computed<Partial<ApiConfiguracion>>(() => {
  if (!form.value || !saved.value) return {}
  const next = { ...form.value, max_bytes_totales_por_testimonio: Math.round(maxMb.value * MB) }
  const s = saved.value
  return Object.fromEntries(
    (Object.keys(next) as (keyof ApiConfiguracion)[]).filter((k) => !same(next[k], s[k])).map((k) => [k, next[k]]),
  ) as Partial<ApiConfiguracion>
})
const dirty = computed(() => Object.keys(changes.value).length > 0)
const needsConfirm = computed(() => SENSITIVE_KEYS.some((k) => k in changes.value))

function toggleMime(value: string) {
  if (!form.value) return
  const list = form.value.tipos_mime_permitidos
  form.value.tipos_mime_permitidos = list.includes(value) ? list.filter((m) => m !== value) : [...list, value]
}

async function save() {
  if (!dirty.value) return
  if (form.value && !form.value.tipos_mime_permitidos.length) {
    message.value = { kind: 'error', text: 'Deja al menos un tipo de archivo permitido.' }
    return
  }
  if (needsConfirm.value && !confirming.value) {
    confirming.value = true
    return
  }
  saving.value = true
  message.value = null
  try {
    reset(await settingsService.update(changes.value))
    confirming.value = false
    message.value = { kind: 'ok', text: 'Configuración guardada. Puede tardar hasta 15 segundos en aplicarse.' }
  } catch (e) {
    message.value = { kind: 'error', text: (e as Partial<ApiError>).message ?? 'No se pudo guardar.' }
  } finally {
    saving.value = false
  }
}

function discard() {
  if (saved.value) reset(saved.value)
  confirming.value = false
  message.value = null
}

onMounted(load)
</script>

<template>
  <div class="max-w-3xl space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Configuración</h1>
      <p class="text-sm text-fg/60">Cada cambio queda registrado en la bitácora.</p>
    </div>

    <div v-if="status === 'loading'" class="space-y-3" aria-hidden="true">
      <div v-for="n in 3" :key="n" class="h-32 animate-pulse rounded-2xl bg-fg/10" />
    </div>
    <div v-else-if="status === 'error'" class="space-y-2 rounded-2xl border border-fg/15 p-6" role="alert">
      <p class="font-semibold">No pudimos cargar la configuración.</p>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
    </div>

    <form v-else-if="form" class="space-y-5" @submit.prevent="save">
      <!-- Publicación -->
      <fieldset class="space-y-3 rounded-2xl border border-fg/15 p-5">
        <legend class="px-1 font-semibold">Publicación en el mapa</legend>
        <label
          v-for="m in MODES"
          :key="m.value"
          class="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition"
          :class="form.modo_publicacion === m.value ? 'border-fg bg-fg/5' : 'border-fg/15 hover:border-fg/40'"
        >
          <input v-model="form.modo_publicacion" type="radio" name="modo" :value="m.value" class="mt-1 size-4 accent-neon-lime" />
          <span>
            <span class="block text-sm font-semibold">{{ m.label }}</span>
            <span class="block text-xs text-fg/60">{{ m.description }}</span>
          </span>
        </label>
        <p class="text-xs text-fg/60">
          En cualquier modo, «solo documentación interna», «no autorizo» y la información sensible marcada para revisión o uso interno
          nunca se publican solos. Los testimonios que ya están pendientes no cambian: hay que aprobarlos.
        </p>
      </fieldset>

      <!-- Participación -->
      <fieldset class="space-y-2 rounded-2xl border border-fg/15 p-5">
        <legend class="px-1 font-semibold">Participación</legend>
        <label v-for="t in PARTICIPATION" :key="t.key" class="flex cursor-pointer items-start gap-3 py-1 text-sm">
          <input v-model="(form as Record<string, unknown>)[t.key]" type="checkbox" class="mt-0.5 size-4 accent-neon-lime" />
          <span>{{ t.label }}<span v-if="t.hint" class="block text-xs text-fg/50">{{ t.hint }}</span></span>
        </label>
      </fieldset>

      <!-- Seguridad -->
      <fieldset class="space-y-2 rounded-2xl border border-fg/15 p-5">
        <legend class="px-1 font-semibold">Seguridad y privacidad</legend>
        <label v-for="t in SECURITY" :key="t.key" class="flex cursor-pointer items-start gap-3 py-1 text-sm">
          <input v-model="(form as Record<string, unknown>)[t.key]" type="checkbox" class="mt-0.5 size-4 accent-neon-lime" />
          <span>{{ t.label }}</span>
        </label>
        <label class="flex flex-wrap items-center gap-3 pt-2 text-sm">
          Conservar la auditoría
          <input v-model.number="form.auditoria_retencion_dias" type="number" min="1" max="3650" class="field-input w-24 text-sm md:py-1.5" />
          días
        </label>
      </fieldset>

      <!-- Archivos -->
      <fieldset class="space-y-3 rounded-2xl border border-fg/15 p-5">
        <legend class="px-1 font-semibold">Evidencias</legend>
        <div class="flex flex-wrap gap-4 text-sm">
          <label class="flex items-center gap-2">
            Máximo de archivos
            <input v-model.number="form.max_archivos_por_testimonio" type="number" min="0" max="50" class="field-input w-20 text-sm md:py-1.5" />
          </label>
          <label class="flex items-center gap-2">
            MB en total por testimonio
            <input v-model.number="maxMb" type="number" min="0" max="500" step="0.5" class="field-input w-24 text-sm md:py-1.5" />
          </label>
        </div>
        <div class="space-y-1.5">
          <p class="text-sm font-semibold">Tipos permitidos</p>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="m in MIME_OPTIONS"
              :key="m.value"
              class="flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition"
              :class="form.tipos_mime_permitidos.includes(m.value) ? 'border-fg bg-fg/10 font-semibold' : 'border-fg/20 text-fg/60'"
            >
              <input type="checkbox" class="sr-only" :checked="form.tipos_mime_permitidos.includes(m.value)" @change="toggleMime(m.value)" />
              {{ m.label }}
            </label>
          </div>
        </div>
      </fieldset>

      <!-- Consentimiento -->
      <fieldset class="space-y-2 rounded-2xl border border-fg/15 p-5">
        <legend class="px-1 font-semibold">Consentimiento</legend>
        <label class="flex flex-wrap items-center gap-3 text-sm">
          Versión vigente del aviso
          <input v-model="form.consentimiento_version_actual" type="text" maxlength="40" class="field-input w-32 text-sm md:py-1.5" />
        </label>
      </fieldset>

      <!-- Guardar -->
      <div class="sticky bottom-0 space-y-3 border-t border-fg/10 bg-surface/95 py-4 backdrop-blur">
        <p v-if="confirming" class="rounded-xl bg-brand-orange/15 px-4 py-3 text-sm light:bg-brand-orange/30" role="alert">
          Esto cambia
          {{ 'modo_publicacion' in changes ? 'qué ve el público en el mapa' : '' }}{{ 'modo_publicacion' in changes && 'captcha_requerido' in changes ? ' y ' : '' }}{{ 'captcha_requerido' in changes ? 'la protección anti-spam' : '' }}
          al instante. ¿Confirmas?
        </p>
        <p v-if="message" class="text-sm" :class="message.kind === 'error' ? 'text-danger' : 'text-fg/70'" role="status">{{ message.text }}</p>
        <div class="flex flex-wrap gap-3">
          <button
            type="submit"
            class="rounded-full px-6 py-2.5 text-sm font-semibold transition disabled:opacity-50"
            :class="confirming ? 'bg-brand-orange text-black' : 'bg-fg text-surface'"
            :disabled="!dirty || saving"
          >
            {{ saving ? 'Guardando…' : confirming ? 'Sí, guardar' : 'Guardar cambios' }}
          </button>
          <button v-if="dirty" type="button" class="text-sm text-fg/60 hover:underline" @click="discard">Descartar</button>
        </div>
      </div>
    </form>
  </div>
</template>
