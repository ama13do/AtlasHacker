<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import type { ApiError } from '@/core/http/client'
import { categoryStyle, useCategoriesStore } from '@/modules/testimonies'
import { adminTestimoniesService, type StaffFilters } from '@admin/services/testimonies.service'
import { useAuthStore } from '@admin/stores/auth'
import type { AccionModeracion, ApiTestimonioStaffFila, PaginaMeta } from '@admin/types/api'
import { ORIGEN_LABELS, fmtDate } from '@admin/data/labels'
import ModerationStatus from '@admin/components/ModerationStatus.vue'
import Pagination from '@admin/components/Pagination.vue'

const PAGE_SIZE = 25

// Pestañas = combinaciones de estado/activo
const TABS = [
  { key: 'pendientes', label: 'Por revisar', filters: { estado: 'pendiente', activo: 'true' } },
  { key: 'aprobados', label: 'Aprobados', filters: { estado: 'aprobado', activo: 'true' } },
  { key: 'rechazados', label: 'Rechazados', filters: { estado: 'rechazado' } },
  { key: 'baja', label: 'Dados de baja', filters: { activo: 'false' } },
  { key: 'todos', label: 'Todos', filters: {} },
] as const
type TabKey = (typeof TABS)[number]['key']

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const categories = useCategoriesStore()
const canModerate = computed(() => auth.can('admin', 'moderador'))

// El estado de los filtros vive en la URL (se puede compartir y volver atrás)
const q = (key: string) => (typeof route.query[key] === 'string' ? (route.query[key] as string) : '')
const tab = computed<TabKey>(() => (TABS.some((t) => t.key === q('tab')) ? (q('tab') as TabKey) : 'pendientes'))
const page = computed(() => Math.max(1, Number(q('pagina')) || 1))

// Campos del formulario de filtros (se aplican al enviar)
const form = reactive({ q: '', categoria: '', sensibles: '', origen: '', desde: '', hasta: '' })
function syncForm() {
  Object.assign(form, { q: q('q'), categoria: q('categoria'), sensibles: q('sensibles'), origen: q('origen'), desde: q('desde'), hasta: q('hasta') })
}

function go(query: LocationQuery) {
  router.push({ query: Object.fromEntries(Object.entries({ ...route.query, ...query }).filter(([, v]) => v !== '' && v != null)) })
}
function applyFilters() {
  go({ ...form, pagina: '' })
}
function clearFilters() {
  router.push({ query: { tab: tab.value } })
}
const hasFilters = computed(() => ['q', 'categoria', 'sensibles', 'origen', 'desde', 'hasta'].some((k) => q(k)))

const rows = ref<ApiTestimonioStaffFila[]>([])
// Seleccionados para moderar por lote (se limpia en cada carga)
const selected = ref<string[]>([])
const meta = ref<PaginaMeta | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')

async function load() {
  status.value = 'loading'
  selected.value = []
  const tabFilters = TABS.find((t) => t.key === tab.value)!.filters
  // Un folio de testimonio se busca exacto; el resto, como texto completo
  const search = q('q').trim()
  const isFolio = /^[A-Z]+\/\d+-T[0-9A-Z]+$/i.test(search)
  const filters: StaffFilters = {
    ...tabFilters,
    q: !isFolio ? search || undefined : undefined,
    folio: isFolio ? search : undefined,
    categoria: q('categoria') || undefined,
    info_sensible: q('sensibles') || undefined,
    origen: q('origen') || undefined,
    desde: q('desde') || undefined,
    hasta: q('hasta') || undefined,
    pagina: page.value,
    por_pagina: PAGE_SIZE,
  }
  try {
    const result = await adminTestimoniesService.list(filters)
    rows.value = result.rows
    meta.value = result.meta
    status.value = 'ready'
  } catch (e) {
    console.error(e)
    status.value = 'error'
  }
}

watch(
  () => route.query,
  () => {
    if (route.name !== 'admin-testimonies') return // Al salir de la vista
    syncForm()
    load()
  },
  { immediate: true },
)

onMounted(() => categories.load().catch(() => {}))

// --- Selección y moderación por lote ---
const allSelected = computed(() => rows.value.length > 0 && selected.value.length === rows.value.length)
function toggleAll() {
  selected.value = allSelected.value ? [] : rows.value.map((r) => r.id)
}

const BATCH_ACTIONS: Record<TabKey, { action: AccionModeracion; label: string }[]> = {
  pendientes: [
    { action: 'aprobar', label: 'Aprobar' },
    { action: 'rechazar', label: 'Rechazar' },
  ],
  aprobados: [
    { action: 'desaprobar', label: 'Regresar a revisión' },
    { action: 'desactivar', label: 'Dar de baja' },
  ],
  rechazados: [{ action: 'desaprobar', label: 'Regresar a revisión' }],
  baja: [{ action: 'activar', label: 'Reactivar' }],
  todos: [
    { action: 'aprobar', label: 'Aprobar' },
    { action: 'desactivar', label: 'Dar de baja' },
  ],
}

const batch = reactive({ action: null as AccionModeracion | null, motivo: '', running: false, result: '' })
function startBatch(action: AccionModeracion) {
  Object.assign(batch, { action, motivo: '', result: '' })
  if (action !== 'rechazar') runBatch()
}
async function runBatch() {
  if (!batch.action) return
  if (batch.action === 'rechazar' && !batch.motivo.trim()) return
  batch.running = true
  try {
    const r = await adminTestimoniesService.moderateBatch(selected.value, batch.action, batch.motivo.trim() || undefined)
    const fallidos = r.procesados - r.correctos
    batch.result = `${r.correctos} de ${r.procesados} actualizados${fallidos ? ` · ${fallidos} con error` : ''}.`
    batch.action = null
    await load()
  } catch (e) {
    batch.result = (e as Partial<ApiError>).message ?? 'No se pudo aplicar la acción.'
  } finally {
    batch.running = false
  }
}

const rangeText = computed(() => {
  if (!meta.value || !meta.value.total) return ''
  const from = (meta.value.pagina - 1) * meta.value.por_pagina + 1
  const to = Math.min(meta.value.total, from + rows.value.length - 1)
  return `${from}–${to} de ${meta.value.total}`
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Testimonios</h1>
      <p class="text-sm text-fg/60">
        {{ auth.user?.rol === 'facilitador' ? 'Los testimonios que capturaste.' : 'Cola de moderación y consulta.' }}
      </p>
    </div>

    <!-- Pestañas -->
    <nav class="flex gap-1 overflow-x-auto border-b border-fg/10 [scrollbar-width:none]" aria-label="Estado">
      <RouterLink
        v-for="t in TABS"
        :key="t.key"
        :to="{ query: { ...route.query, tab: t.key, pagina: undefined } }"
        class="-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition"
        :class="tab === t.key ? 'border-fg text-fg' : 'border-transparent text-fg/60 hover:text-fg'"
        :aria-current="tab === t.key ? 'page' : undefined"
      >
        {{ t.label }}
      </RouterLink>
    </nav>

    <!-- Filtros (una fila) -->
    <form class="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]" @submit.prevent="applyFilters">
      <input v-model="form.q" type="search" class="field-input text-sm md:py-2" placeholder="Buscar en el texto o folio…" aria-label="Buscar" />
      <select v-model="form.categoria" class="field-input text-sm md:py-2" aria-label="Categoría">
        <option value="">Todas las categorías</option>
        <option v-for="c in categories.categories" :key="c.slug" :value="c.slug">{{ c.label }}</option>
      </select>
      <select v-model="form.origen" class="field-input text-sm md:py-2" aria-label="Origen">
        <option value="">Cualquier origen</option>
        <option v-for="(label, key) in ORIGEN_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <select v-model="form.sensibles" class="field-input text-sm md:py-2" aria-label="Información sensible">
        <option value="">Sensibles: todos</option>
        <option value="true">Solo con información sensible</option>
        <option value="false">Sin información sensible</option>
      </select>
      <div class="flex gap-2">
        <button type="submit" class="rounded-full bg-fg px-4 py-2 text-sm font-semibold text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg">
          Filtrar
        </button>
        <button v-if="hasFilters" type="button" class="rounded-full px-3 py-2 text-sm text-fg/70 hover:text-fg hover:underline" @click="clearFilters">
          Limpiar
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-sm sm:col-span-2 lg:col-span-5">
        <label class="text-fg/60" for="desde">Recibidos del</label>
        <input id="desde" v-model="form.desde" type="date" class="field-input w-auto text-sm md:py-1.5" />
        <label class="text-fg/60" for="hasta">al</label>
        <input id="hasta" v-model="form.hasta" type="date" class="field-input w-auto text-sm md:py-1.5" />
      </div>
    </form>

    <!-- Barra de lote -->
    <div
      v-if="canModerate && selected.length"
      class="sticky top-16 z-[5] flex flex-wrap items-center gap-2 rounded-2xl border border-fg/15 bg-surface px-4 py-3 shadow-lg"
      role="region"
      aria-label="Acciones para la selección"
    >
      <span class="text-sm font-semibold">{{ selected.length }} seleccionados</span>
      <template v-if="batch.action === 'rechazar'">
        <input v-model="batch.motivo" type="text" maxlength="1000" class="field-input min-w-0 flex-1 text-sm md:py-1.5" placeholder="Motivo del rechazo (lo verá la persona)" aria-label="Motivo del rechazo" />
        <button type="button" class="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-50" :disabled="!batch.motivo.trim() || batch.running" @click="runBatch">
          Rechazar {{ selected.length }}
        </button>
        <button type="button" class="text-sm text-fg/60 hover:underline" @click="batch.action = null">Cancelar</button>
      </template>
      <template v-else>
        <button
          v-for="b in BATCH_ACTIONS[tab]"
          :key="b.action"
          type="button"
          class="rounded-full border border-fg/25 px-4 py-1.5 text-sm font-semibold hover:border-fg disabled:opacity-50"
          :disabled="batch.running"
          @click="startBatch(b.action)"
        >
          {{ b.label }}
        </button>
        <button type="button" class="ml-auto text-sm text-fg/60 hover:underline" @click="selected = []">Quitar selección</button>
      </template>
    </div>
    <p v-if="batch.result" class="text-sm text-fg/70" role="status">{{ batch.result }}</p>

    <!-- Lista -->
    <div v-if="status === 'loading'" class="space-y-2" aria-hidden="true">
      <div v-for="n in 6" :key="n" class="h-20 animate-pulse rounded-2xl bg-fg/10" />
    </div>
    <div v-else-if="status === 'error'" class="space-y-2 rounded-2xl border border-fg/15 p-6" role="alert">
      <p class="font-semibold">No pudimos cargar los testimonios.</p>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
    </div>
    <p v-else-if="!rows.length" class="rounded-2xl border border-dashed border-fg/20 p-8 text-center text-sm text-fg/60">
      {{ hasFilters ? 'Ningún testimonio coincide con los filtros.' : 'No hay testimonios aquí.' }}
    </p>

    <template v-else>
      <div class="flex items-center justify-between gap-3 text-sm text-fg/60">
        <label v-if="canModerate" class="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" class="size-4 accent-neon-lime" :checked="allSelected" @change="toggleAll" />
          Seleccionar página
        </label>
        <span class="ml-auto tabular-nums">{{ rangeText }}</span>
      </div>

      <ul class="space-y-2">
        <li
          v-for="r in rows"
          :key="r.id"
          class="flex gap-3 rounded-2xl border p-4 transition"
          :class="selected.includes(r.id) ? 'border-fg/50 bg-fg/5' : 'border-fg/15 hover:border-fg/30'"
        >
          <input
            v-if="canModerate"
            v-model="selected"
            :value="r.id"
            type="checkbox"
            class="mt-1 size-4 shrink-0 accent-neon-lime"
            :aria-label="`Seleccionar ${r.folio}`"
          />
          <RouterLink :to="{ name: 'admin-testimony', params: { id: r.id } }" class="min-w-0 flex-1 space-y-1.5 focus-visible:outline-2 focus-visible:outline-fg">
            <div class="flex flex-wrap items-center gap-2">
              <ModerationStatus :estado="r.estado" :activo="r.activo" :publico="r.es_publico" />
              <span class="inline-flex items-center gap-1.5 text-xs text-fg/70">
                <span class="size-2 rounded-full" :class="categoryStyle(r.categoria_slug).bg" aria-hidden="true" />
                {{ categories.bySlug(r.categoria_slug).label }}
              </span>
              <span
                v-if="r.info_sensible"
                class="rounded-full bg-brand-orange/15 px-2 py-0.5 text-xs font-semibold text-danger light:bg-brand-orange/30"
              >
                ⚠ Sensible
              </span>
              <span class="ml-auto text-xs text-fg/50 tabular-nums">{{ fmtDate(r.created_at, true) }}</span>
            </div>
            <p class="font-semibold leading-snug">{{ r.titulo || 'Sin título' }}</p>
            <p class="line-clamp-2 text-sm text-fg/70">{{ r.relato_resumen }}</p>
            <p class="text-xs text-fg/50">
              {{ r.folio }} · {{ r.lugar_territorio || [r.municipio, r.entidad].filter(Boolean).join(', ') || 'Sin lugar' }} ·
              {{ ORIGEN_LABELS[r.origen] }}<template v-if="r.evidencias_conteo"> · {{ r.evidencias_conteo }} evidencias</template>
            </p>
          </RouterLink>
        </li>
      </ul>

      <Pagination v-if="meta" :page="page" :pages="meta.paginas" @go="go({ pagina: String($event) })" />
    </template>
  </div>
</template>
