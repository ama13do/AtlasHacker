<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminCommentsService, type CommentFilters } from '@admin/services/comments.service'
import type { ApiComentarioStaff, PaginaMeta } from '@admin/types/api'
import CommentRow from '@admin/components/CommentRow.vue'
import Pagination from '@admin/components/Pagination.vue'

const PAGE_SIZE = 25

const TABS = [
  { key: 'pendientes', label: 'Por revisar', filters: { estado: 'pendiente' } },
  { key: 'publicados', label: 'Publicados', filters: { estado: 'aprobado', activo: 'true' } },
  { key: 'ocultos', label: 'Ocultos', filters: { activo: 'false' } },
  { key: 'rechazados', label: 'Rechazados', filters: { estado: 'rechazado' } },
  { key: 'todos', label: 'Todos', filters: {} },
] as const
type TabKey = (typeof TABS)[number]['key']

const route = useRoute()
const router = useRouter()

const q = (key: string) => (typeof route.query[key] === 'string' ? (route.query[key] as string) : '')
const tab = computed<TabKey>(() => (TABS.some((t) => t.key === q('tab')) ? (q('tab') as TabKey) : 'pendientes'))
const page = computed(() => Math.max(1, Number(q('pagina')) || 1))
const testimonyId = computed(() => q('testimonio'))

const rows = ref<ApiComentarioStaff[]>([])
const meta = ref<PaginaMeta | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')

async function load() {
  status.value = 'loading'
  try {
    const filters: CommentFilters = {
      ...(TABS.find((t) => t.key === tab.value)!.filters as Partial<CommentFilters>),
      testimonio_id: testimonyId.value || undefined,
      pagina: page.value,
      por_pagina: PAGE_SIZE,
    }
    const result = await adminCommentsService.list(filters)
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
    if (route.name === 'admin-comments') load()
  },
  { immediate: true },
)

function goPage(p: number) {
  router.push({ query: { ...route.query, pagina: String(p) } })
}

function onRemoved(id: string) {
  rows.value = rows.value.filter((r) => r.id !== id)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Comentarios</h1>
      <p class="text-sm text-fg/60">Moderación de los comentarios en los testimonios públicos.</p>
    </div>

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

    <p v-if="testimonyId" class="flex flex-wrap items-center gap-3 rounded-xl bg-fg/5 px-4 py-2 text-sm">
      Solo comentarios de un testimonio.
      <RouterLink :to="{ name: 'admin-testimony', params: { id: testimonyId } }" class="font-semibold text-accent-ink hover:underline">
        Ver testimonio
      </RouterLink>
      <RouterLink :to="{ query: { tab } }" class="text-fg/60 hover:underline">Quitar filtro</RouterLink>
    </p>

    <div v-if="status === 'loading'" class="space-y-2" aria-hidden="true">
      <div v-for="n in 5" :key="n" class="h-24 animate-pulse rounded-2xl bg-fg/10" />
    </div>
    <div v-else-if="status === 'error'" class="space-y-2 rounded-2xl border border-fg/15 p-6" role="alert">
      <p class="font-semibold">No pudimos cargar los comentarios.</p>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
    </div>
    <p v-else-if="!rows.length" class="rounded-2xl border border-dashed border-fg/20 p-8 text-center text-sm text-fg/60">
      {{
        tab === 'pendientes'
          ? 'No hay comentarios por revisar. (Si la configuración no exige moderación, los comentarios se publican directo.)'
          : 'No hay comentarios aquí.'
      }}
    </p>
    <template v-else>
      <p class="text-right text-sm text-fg/60 tabular-nums">{{ meta?.total }} comentarios</p>
      <ul class="space-y-2">
        <li v-for="c in rows" :key="c.id">
          <CommentRow :comment="c" @removed="onRemoved" />
        </li>
      </ul>
      <Pagination v-if="meta" :page="page" :pages="meta.paginas" @go="goPage" />
    </template>
  </div>
</template>
