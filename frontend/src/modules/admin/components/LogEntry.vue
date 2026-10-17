<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { ApiEventoBitacora } from '@admin/types/api'
import { LOG_ACTIONS } from '@admin/data/logActions'
import { ROLE_LABELS, fmtDate } from '@admin/data/labels'

// Un evento de la bitácora: quién (y con qué rol), qué hizo, a qué folio, cuándo y desde dónde.
// "Ver cambios" muestra el antes → después campo por campo y el detalle
const props = defineProps<{ entry: ApiEventoBitacora }>()
const open = ref(false)
const e = computed(() => props.entry)

const who = computed(() =>
  e.value.actor_tipo === 'usuario'
    ? (e.value.usuario_nombre ?? e.value.usuario_email ?? 'Usuario')
    : e.value.actor_tipo === 'participante'
      ? 'Persona (folio)'
      : e.value.actor_tipo === 'sistema'
        ? 'Sistema'
        : 'Anónimo',
)
const role = computed(() => (e.value.usuario_rol ? ROLE_LABELS[e.value.usuario_rol] ?? e.value.usuario_rol : null))

// Enlace a la entidad cuando el dashboard tiene su vista
const target = computed<RouteLocationRaw | null>(() => {
  if (!e.value.entidad_id) return null
  if (e.value.entidad === 'testimonio') return { name: 'admin-testimony', params: { id: e.value.entidad_id } }
  if (e.value.entidad === 'participante') return { name: 'admin-person', params: { id: e.value.entidad_id } }
  return null
})

// Navegador y sistema a partir del user agent (aproximado, solo para leerlo de un vistazo)
const device = computed(() => {
  const ua = e.value.user_agent
  if (!ua) return null
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null
  if (!browser && !os) return null
  return [browser, os].filter(Boolean).join(' en ') + (/Mobile/.test(ua) ? ' (celular)' : '')
})

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const has = (v: unknown) => v !== null && v !== undefined && !(typeof v === 'object' && !Object.keys(v as object).length)
const json = (v: unknown) => JSON.stringify(v, null, 2)
const show = (v: unknown) => (v === null || v === undefined ? '—' : v === true ? 'Sí' : v === false ? 'No' : typeof v === 'object' ? JSON.stringify(v) : String(v))
const label = (k: string) => k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')

// Antes y después como filas campo → valor (si ambos son objetos)
const changes = computed(() => {
  const a = e.value.antes
  const d = e.value.despues
  if ((has(a) && !isObject(a)) || (has(d) && !isObject(d))) return null
  const before = isObject(a) ? a : {}
  const after = isObject(d) ? d : {}
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  return keys.map((k) => ({ key: k, before: k in before ? show(before[k]) : '—', after: k in after ? show(after[k]) : '—' }))
})
const hasDetails = computed(() => has(e.value.antes) || has(e.value.despues) || has(e.value.detalle) || !!e.value.user_agent)
</script>

<template>
  <article class="border-2 border-ink bg-card shadow-brut space-y-2 rounded-[22px] p-3 text-sm">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <time :datetime="e.created_at" class="text-xs text-fg/60 tabular-nums">{{ fmtDate(e.created_at, true) }}</time>
      <span class="font-semibold">{{ who }}</span>
      <span v-if="role" class="chip bg-card">{{ role }}</span>
      <span>{{ LOG_ACTIONS[e.accion] ?? e.accion }}</span>
      <RouterLink v-if="e.folio && e.entidad === 'testimonio' && target" :to="target" class="font-mono text-xs font-semibold text-accent-ink hover:underline">
        {{ e.folio }}
      </RouterLink>
      <RouterLink v-else-if="e.folio" :to="{ query: { folio: e.folio } }" class="font-mono text-xs font-semibold text-accent-ink hover:underline">
        {{ e.folio }}
      </RouterLink>
      <RouterLink v-else-if="target" :to="target" class="text-xs font-semibold text-accent-ink hover:underline">Ver {{ e.entidad }}</RouterLink>
      <button v-if="hasDetails" type="button" class="ml-auto text-xs font-semibold hover:underline" :aria-expanded="open" @click="open = !open">
        {{ open ? 'Ocultar' : 'Ver cambios' }}
      </button>
    </div>
    <p v-if="e.ip || device || e.usuario_email" class="flex flex-wrap gap-x-3 text-xs text-fg/60">
      <span v-if="e.usuario_email && e.usuario_nombre">{{ e.usuario_email }}</span>
      <span v-if="e.ip">Desde IP <span class="font-mono">{{ e.ip }}</span></span>
      <span v-if="device">{{ device }}</span>
    </p>

    <div v-if="open" class="space-y-2">
      <div v-if="changes?.length" class="overflow-x-auto rounded-xl bg-fg/5">
        <table class="w-full text-left text-xs">
          <thead class="text-fg/60">
            <tr>
              <th scope="col" class="px-2 py-1.5 font-semibold">Campo</th>
              <th scope="col" class="px-2 py-1.5 font-semibold">Antes</th>
              <th scope="col" class="px-2 py-1.5 font-semibold">Después</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in changes" :key="c.key" class="border-t border-fg/10 align-top">
              <th scope="row" class="px-2 py-1.5 font-semibold whitespace-nowrap">{{ label(c.key) }}</th>
              <td class="px-2 py-1.5 break-all text-fg/70">{{ c.before }}</td>
              <td class="px-2 py-1.5 break-all">{{ c.after }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="has(e.antes) || has(e.despues)" class="grid gap-2 md:grid-cols-2">
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
        <template v-if="e.user_agent"> · {{ e.user_agent }}</template>
      </p>
    </div>
  </article>
</template>
