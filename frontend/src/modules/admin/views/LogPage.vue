<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { systemService } from '@admin/services/system.service'
import { usersService } from '@admin/services/users.service'
import type { ApiEventoBitacora, ApiUsuarioStaff, PaginaMeta } from '@admin/types/api'
import { LOG_GROUPS } from '@admin/data/logActions'
import LogEntry from '@admin/components/LogEntry.vue'
import Pagination from '@admin/components/Pagination.vue'

const PAGE_SIZE = 50

const route = useRoute()
const router = useRouter()
const q = (key: string) => (typeof route.query[key] === 'string' ? (route.query[key] as string) : '')
const page = computed(() => Math.max(1, Number(q('pagina')) || 1))

const form = reactive({ accion: '', usuario: '', entidad_id: '', desde: '', hasta: '' })
const users = ref<ApiUsuarioStaff[]>([])
const rows = ref<ApiEventoBitacora[]>([])
const meta = ref<PaginaMeta | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')

async function load() {
  status.value = 'loading'
  try {
    const r = await systemService.log({
      accion: q('accion') || undefined,
      usuario_id: q('usuario') || undefined,
      entidad_id: q('entidad_id') || undefined,
      desde: q('desde') || undefined,
      hasta: q('hasta') || undefined,
      pagina: page.value,
      por_pagina: PAGE_SIZE,
    })
    rows.value = r.rows
    meta.value = r.meta
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

watch(
  () => route.query,
  () => {
    if (route.name !== 'admin-log') return
    Object.assign(form, { accion: q('accion'), usuario: q('usuario'), entidad_id: q('entidad_id'), desde: q('desde'), hasta: q('hasta') })
    load()
  },
  { immediate: true },
)

function apply() {
  router.push({ query: Object.fromEntries(Object.entries(form).filter(([, v]) => v)) })
}

onMounted(async () => {
  try {
    users.value = await usersService.list()
  } catch {
    // El filtro por usuario queda vacío
  }
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Bitácora</h1>
      <p class="text-sm text-fg/60">Registro de solo agregar: quién hizo qué y cuándo, con el antes y el después.</p>
    </div>

    <form class="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto]" @submit.prevent="apply">
      <select v-model="form.accion" class="field-input text-sm md:py-2" aria-label="Tipo de acción">
        <option v-for="g in LOG_GROUPS" :key="g.value" :value="g.value">{{ g.label }}</option>
      </select>
      <select v-model="form.usuario" class="field-input text-sm md:py-2" aria-label="Usuario">
        <option value="">Cualquier usuario</option>
        <option v-for="u in users" :key="u.id" :value="u.id">{{ u.email }}</option>
      </select>
      <input v-model="form.desde" type="date" class="field-input text-sm md:py-2" aria-label="Desde" />
      <input v-model="form.hasta" type="date" class="field-input text-sm md:py-2" aria-label="Hasta" />
      <button type="submit" class="rounded-full bg-fg px-4 py-2 text-sm font-semibold text-surface">Filtrar</button>
    </form>
    <p v-if="q('entidad_id')" class="flex flex-wrap items-center gap-3 rounded-xl bg-fg/5 px-4 py-2 text-sm">
      Historial de un solo elemento.
      <RouterLink :to="{ query: { ...route.query, entidad_id: undefined } }" class="text-fg/60 hover:underline">Quitar filtro</RouterLink>
    </p>

    <div v-if="status === 'loading'" class="space-y-2" aria-hidden="true">
      <div v-for="n in 6" :key="n" class="h-12 animate-pulse rounded-2xl bg-fg/10" />
    </div>
    <div v-else-if="status === 'error'" class="space-y-2 rounded-2xl border border-fg/15 p-6" role="alert">
      <p class="font-semibold">No pudimos cargar la bitácora.</p>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
    </div>
    <p v-else-if="!rows.length" class="rounded-2xl border border-dashed border-fg/20 p-8 text-center text-sm text-fg/60">Sin eventos.</p>
    <template v-else>
      <p class="text-right text-sm text-fg/60 tabular-nums">{{ meta?.total }} eventos</p>
      <ul class="space-y-2">
        <li v-for="e in rows" :key="e.id"><LogEntry :entry="e" /></li>
      </ul>
      <Pagination v-if="meta" :page="page" :pages="meta.paginas" @go="router.push({ query: { ...route.query, pagina: String($event) } })" />
    </template>
  </div>
</template>
