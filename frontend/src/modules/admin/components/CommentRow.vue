<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { adminCommentsService } from '@admin/services/comments.service'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiComentarioStaff, EstadoModeracion } from '@admin/types/api'
import { fmtDate } from '@admin/data/labels'

// Un comentario con sus acciones de moderación (los cambios se aplican sobre la fila)
const props = defineProps<{ comment: ApiComentarioStaff }>()
const emit = defineEmits<{ removed: [id: string] }>()

const auth = useAuthStore()
const canModerate = computed(() => auth.can('admin', 'moderador'))
const c = computed(() => props.comment)

const busy = ref(false)
const error = ref<string | null>(null)
const editing = ref(false)
const draft = ref('')
const confirmingDelete = ref(false)

const STATUS: Record<EstadoModeracion, { label: string; class: string }> = {
  pendiente: { label: 'Por revisar', class: 'bg-neon-lime text-black' },
  aprobado: { label: 'Publicado', class: 'bg-neon-green text-black' },
  rechazado: { label: 'Rechazado', class: 'bg-brand-orange text-black' },
}

async function apply(changes: { estado?: EstadoModeracion; activo?: boolean; contenido?: string }) {
  busy.value = true
  error.value = null
  const before = { ...c.value }
  Object.assign(c.value, changes) // Optimista: se revierte si falla
  try {
    await adminCommentsService.update(c.value.id, changes)
    editing.value = false
  } catch (e) {
    Object.assign(c.value, before)
    error.value = (e as Partial<ApiError>).message ?? 'No se pudo actualizar.'
  } finally {
    busy.value = false
  }
}

function startEdit() {
  draft.value = c.value.contenido
  editing.value = true
}

async function remove() {
  busy.value = true
  error.value = null
  try {
    await adminCommentsService.remove(c.value.id)
    emit('removed', c.value.id)
  } catch (e) {
    error.value = (e as Partial<ApiError>).message ?? 'No se pudo eliminar.'
  } finally {
    busy.value = false
  }
}

const link = 'text-xs font-semibold hover:underline disabled:opacity-50'
</script>

<template>
  <article class="border-2 border-ink bg-card shadow-brut space-y-2 rounded-[22px] p-4" :class="{ 'opacity-60': !c.activo }">
    <header class="flex flex-wrap items-center gap-2 text-xs">
      <span class="rounded-full px-2 py-0.5 font-semibold" :class="STATUS[c.estado].class">{{ STATUS[c.estado].label }}</span>
      <span v-if="!c.activo" class="chip bg-card">Oculto</span>
      <span class="font-semibold">{{ c.autor_nombre || 'Anónimo' }}</span>
      <span class="text-fg/50">{{ fmtDate(c.created_at, true) }}</span>
      <span class="text-fg/50">· {{ c.likes_conteo }} me gusta</span>
      <RouterLink
        :to="{ name: 'admin-testimony', params: { id: c.testimonio_id } }"
        class="ml-auto font-mono text-fg/60 hover:text-fg hover:underline"
      >
        {{ c.testimonio_folio }}
      </RouterLink>
    </header>

    <div v-if="editing" class="space-y-2">
      <textarea v-model="draft" rows="3" maxlength="2000" class="field-input text-sm" aria-label="Texto del comentario" />
      <div class="flex gap-3">
        <button type="button" :class="[link, 'text-accent-ink']" :disabled="busy || !draft.trim()" @click="apply({ contenido: draft.trim() })">
          Guardar
        </button>
        <button type="button" :class="[link, 'text-fg/60']" @click="editing = false">Cancelar</button>
      </div>
    </div>
    <p v-else class="text-sm whitespace-pre-line text-fg/85">{{ c.contenido }}</p>

    <footer v-if="canModerate && !editing" class="flex flex-wrap items-center gap-4">
      <template v-if="c.estado === 'pendiente'">
        <button type="button" :class="[link, 'text-accent-ink']" :disabled="busy" @click="apply({ estado: 'aprobado' })">Aprobar</button>
        <button type="button" :class="[link, 'text-danger']" :disabled="busy" @click="apply({ estado: 'rechazado' })">Rechazar</button>
      </template>
      <button v-else-if="c.estado === 'rechazado'" type="button" :class="link" :disabled="busy" @click="apply({ estado: 'aprobado' })">
        Aprobar
      </button>
      <button type="button" :class="link" :disabled="busy" @click="apply({ activo: !c.activo })">{{ c.activo ? 'Ocultar' : 'Mostrar' }}</button>
      <button type="button" :class="link" :disabled="busy" @click="startEdit">Editar</button>
      <template v-if="auth.can('admin')">
        <span v-if="confirmingDelete" class="ml-auto flex gap-3 text-xs">
          <span class="text-fg/70">¿Eliminar para siempre?</span>
          <button type="button" :class="[link, 'text-danger']" :disabled="busy" @click="remove">Sí, eliminar</button>
          <button type="button" :class="[link, 'text-fg/60']" @click="confirmingDelete = false">Cancelar</button>
        </span>
        <button v-else type="button" :class="[link, 'ml-auto text-danger']" @click="confirmingDelete = true">Eliminar</button>
      </template>
    </footer>
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
  </article>
</template>
