<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { ApiEventoBitacora } from '@admin/types/api'
import { LOG_ACTIONS } from '@admin/data/logActions'
import { fmtDate } from '@admin/data/labels'

// Un evento de la bitácora; "Ver cambios" muestra antes/después, detalle, IP y navegador
const props = defineProps<{ entry: ApiEventoBitacora }>()
const open = ref(false)
const e = computed(() => props.entry)

const who = computed(() =>
  e.value.actor_tipo === 'usuario'
    ? (e.value.usuario_email ?? 'Usuario')
    : e.value.actor_tipo === 'participante'
      ? 'Persona (folio)'
      : e.value.actor_tipo === 'sistema'
        ? 'Sistema'
        : 'Anónimo',
)

// Enlace a la entidad cuando el dashboard tiene su vista
const target = computed<RouteLocationRaw | null>(() => {
  if (!e.value.entidad_id) return null
  if (e.value.entidad === 'testimonio') return { name: 'admin-testimony', params: { id: e.value.entidad_id } }
  if (e.value.entidad === 'participante') return { name: 'admin-person', params: { id: e.value.entidad_id } }
  return null
})

const has = (v: unknown) => v !== null && v !== undefined && !(typeof v === 'object' && !Object.keys(v as object).length)
const json = (v: unknown) => JSON.stringify(v, null, 2)
</script>

<template>
  <article class="space-y-2 rounded-2xl border border-fg/15 p-3 text-sm">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <time :datetime="e.created_at" class="text-xs text-fg/50 tabular-nums">{{ fmtDate(e.created_at, true) }}</time>
      <span class="font-semibold">{{ who }}</span>
      <span>{{ LOG_ACTIONS[e.accion] ?? e.accion }}</span>
      <RouterLink v-if="target" :to="target" class="text-xs font-semibold text-accent-ink hover:underline">Ver {{ e.entidad }}</RouterLink>
      <span v-else-if="e.entidad" class="text-xs text-fg/50">{{ e.entidad }}</span>
      <button type="button" class="ml-auto text-xs font-semibold hover:underline" :aria-expanded="open" @click="open = !open">
        {{ open ? 'Ocultar' : 'Ver cambios' }}
      </button>
    </div>
    <div v-if="open" class="space-y-2">
      <div v-if="has(e.antes) || has(e.despues)" class="grid gap-2 md:grid-cols-2">
        <div>
          <p class="text-xs font-semibold text-fg/50 uppercase">Antes</p>
          <pre class="max-h-64 overflow-auto rounded-xl bg-fg/5 p-2 text-xs whitespace-pre-wrap">{{ has(e.antes) ? json(e.antes) : '—' }}</pre>
        </div>
        <div>
          <p class="text-xs font-semibold text-fg/50 uppercase">Después</p>
          <pre class="max-h-64 overflow-auto rounded-xl bg-fg/5 p-2 text-xs whitespace-pre-wrap">{{ has(e.despues) ? json(e.despues) : '—' }}</pre>
        </div>
      </div>
      <div v-if="has(e.detalle)">
        <p class="text-xs font-semibold text-fg/50 uppercase">Detalle</p>
        <pre class="max-h-48 overflow-auto rounded-xl bg-fg/5 p-2 text-xs whitespace-pre-wrap">{{ json(e.detalle) }}</pre>
      </div>
      <p class="text-xs break-all text-fg/50">
        <code>{{ e.accion }}</code><template v-if="e.entidad_id"> · {{ e.entidad }} {{ e.entidad_id }}</template>
        <template v-if="e.ip"> · IP {{ e.ip }}</template><template v-if="e.user_agent"> · {{ e.user_agent }}</template>
      </p>
    </div>
  </article>
</template>
