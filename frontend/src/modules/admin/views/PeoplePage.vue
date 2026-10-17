<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ApiError } from '@/core/http/client'
import { adminPeopleService } from '@admin/services/people.service'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiParticipanteResumen, PaginaMeta } from '@admin/types/api'
import { fmtDate } from '@admin/data/labels'
import OneTimeFolio from '@admin/components/OneTimeFolio.vue'
import Pagination from '@admin/components/Pagination.vue'

const PAGE_SIZE = 25

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canManage = computed(() => auth.perms.admin)

const q = (key: string) => (typeof route.query[key] === 'string' ? (route.query[key] as string) : '')
const page = computed(() => Math.max(1, Number(q('pagina')) || 1))

// La búsqueda va por índice ciego: correo o teléfono exactos, o los últimos 4 del folio.
// Correo y teléfono NO van en la URL (son datos personales): solo viven en el formulario
const form = reactive({ correo: '', telefono: '', pista: '' })
const searched = reactive({ correo: '', telefono: '' })

const rows = ref<ApiParticipanteResumen[]>([])
const meta = ref<PaginaMeta | null>(null)
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const error = ref<string | null>(null)

async function load() {
  if (!canManage.value) return
  status.value = 'loading'
  error.value = null
  try {
    const result = await adminPeopleService.search({
      correo: searched.correo || undefined,
      telefono: searched.telefono || undefined,
      folio_pista: q('pista') || undefined,
      pagina: page.value,
      por_pagina: PAGE_SIZE,
    })
    rows.value = result.rows
    meta.value = result.meta
    status.value = 'ready'
  } catch (e) {
    const err = e as Partial<ApiError>
    error.value = err.status === 400 ? 'Revisa el formato: correo válido, teléfono o exactamente 4 caracteres del folio.' : 'No pudimos buscar.'
    status.value = 'error'
  }
}

function search() {
  Object.assign(searched, { correo: form.correo.trim(), telefono: form.telefono.trim() })
  const pista = form.pista.trim().toUpperCase()
  // Si la URL no cambia, el watcher no se dispara: se carga a mano
  if (pista === q('pista') && page.value === 1) load()
  else router.push({ query: { pista: pista || undefined } })
}

function clear() {
  Object.assign(form, { correo: '', telefono: '', pista: '' })
  search()
}

watch(
  () => route.query,
  () => {
    if (route.name !== 'admin-people') return
    form.pista = q('pista')
    load()
  },
  { immediate: true },
)

function open(p: ApiParticipanteResumen) {
  // El resumen (sin datos personales) viaja en el estado de navegación para no descifrar al abrir
  router.push({ name: 'admin-person', params: { id: p.id }, state: { resumen: JSON.parse(JSON.stringify(p)) } })
}

// --- Nueva persona (también facilitador) ---
const creating = ref(false)
const newPerson = reactive({ nombre: '', correo: '', telefono: '' })
const createdFolio = ref<string | null>(null)
const createError = ref<string | null>(null)
const saving = ref(false)

async function create() {
  saving.value = true
  createError.value = null
  try {
    const contacto = { correo: newPerson.correo.trim() || undefined, telefono: newPerson.telefono.trim() || undefined }
    const r = await adminPeopleService.create({
      nombre: newPerson.nombre.trim() || undefined,
      contacto: contacto.correo || contacto.telefono ? contacto : undefined,
    })
    createdFolio.value = r.folio
    Object.assign(newPerson, { nombre: '', correo: '', telefono: '' })
    if (canManage.value) load()
  } catch (e) {
    createError.value = (e as Partial<ApiError>).message ?? 'No se pudo crear.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-black uppercase"><span class="hl-box hl-blue" style="--hl-rot: -1deg">Personas</span></h1>
        <p class="text-sm text-fg/60">Quienes aportan testimonios, identificadas por su folio.</p>
      </div>
      <button
        type="button"
        class="btn-hxnf btn-ink btn-sm"
        @click="(creating = !creating), (createdFolio = null)"
      >
        {{ creating ? 'Cerrar' : 'Nueva persona' }}
      </button>
    </div>

    <!-- Alta -->
    <section v-if="creating" class="border-2 border-ink bg-card shadow-brut space-y-3 rounded-[22px] p-4" aria-label="Nueva persona">
      <OneTimeFolio v-if="createdFolio" :folio="createdFolio" title="Folio de la nueva persona" />
      <form v-else class="space-y-3" @submit.prevent="create">
        <p class="text-sm text-fg/60">Para dar un folio a alguien antes de capturar su ficha. Todo es opcional y se guarda cifrado.</p>
        <div class="grid gap-3 sm:grid-cols-3">
          <input v-model="newPerson.nombre" type="text" maxlength="150" class="field-input text-sm md:py-2" placeholder="Nombre" aria-label="Nombre" />
          <input v-model="newPerson.correo" type="email" class="field-input text-sm md:py-2" placeholder="Correo" aria-label="Correo" />
          <input v-model="newPerson.telefono" type="tel" maxlength="25" class="field-input text-sm md:py-2" placeholder="Teléfono" aria-label="Teléfono" />
        </div>
        <p v-if="createError" class="text-sm text-danger" role="alert">{{ createError }}</p>
        <button type="submit" class="btn-hxnf btn-lime btn-sm" :disabled="saving">
          {{ saving ? 'Creando…' : 'Crear y emitir folio' }}
        </button>
      </form>
    </section>

    <template v-if="canManage">
      <!-- Búsqueda -->
      <form class="space-y-2" @submit.prevent="search">
        <div class="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input v-model="form.correo" type="email" class="field-input text-sm md:py-2" placeholder="Correo exacto" aria-label="Correo" autocomplete="off" />
          <input v-model="form.telefono" type="tel" class="field-input text-sm md:py-2" placeholder="Teléfono" aria-label="Teléfono" autocomplete="off" />
          <input
            v-model="form.pista"
            type="text"
            maxlength="4"
            class="field-input font-mono text-sm uppercase md:py-2"
            placeholder="Últimos 4 del folio"
            aria-label="Últimos 4 caracteres del folio"
          />
          <div class="flex gap-2">
            <button type="submit" class="btn-hxnf btn-ink btn-sm">Buscar</button>
            <button type="button" class="rounded-full px-3 py-2 text-sm text-fg/70 hover:underline" @click="clear">Todas</button>
          </div>
        </div>
        <p class="text-xs text-fg/50">
          Para recuperar un folio perdido: busca a la persona por correo, teléfono o los últimos 4 caracteres de su folio y usa
          «Emitir folio nuevo». Las búsquedas no descifran datos.
        </p>
      </form>

      <div v-if="status === 'loading'" class="space-y-2" aria-hidden="true">
        <div v-for="n in 5" :key="n" class="h-16 animate-pulse rounded-2xl bg-fg/10" />
      </div>
      <p v-else-if="status === 'error'" class="rounded-[20px] border-2 border-ink bg-card shadow-brut-sm p-4 text-sm text-danger" role="alert">{{ error }}</p>
      <p v-else-if="status === 'ready' && !rows.length" class="rounded-[20px] border-2 border-dashed border-ink/40 p-8 text-center text-sm text-fg/60">
        Nadie coincide con la búsqueda.
      </p>
      <template v-else-if="status === 'ready'">
        <p class="text-right text-sm text-fg/60 tabular-nums">{{ meta?.total }} personas</p>
        <ul class="space-y-2">
          <li v-for="p in rows" :key="p.id">
            <button
              type="button"
              class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] border-2 border-ink bg-card shadow-brut-sm p-4 text-left text-sm transition card-lift focus-visible:outline-3 focus-visible:outline-brand-blue"
              :class="{ 'opacity-60': !p.activo }"
              @click="open(p)"
            >
              <span class="font-mono font-semibold">P-…-{{ p.folio_pista }}</span>
              <span class="text-fg/70">{{ p.testimonios }} testimonios · {{ p.aprobados }} publicados</span>
              <span class="flex flex-wrap gap-1 text-xs">
                <span v-if="p.dejo_nombre" class="rounded-full border border-fg/20 px-2">nombre</span>
                <span v-if="p.dejo_correo" class="rounded-full border border-fg/20 px-2">correo</span>
                <span v-if="p.dejo_telefono" class="rounded-full border border-fg/20 px-2">teléfono</span>
                <span v-if="p.perfil_publico" class="rounded-full bg-neon-green px-2 font-semibold text-black">perfil público</span>
                <span v-if="!p.activo" class="chip bg-card">folio desactivado</span>
                <span v-if="p.datos_cancelados_at" class="chip bg-card">datos cancelados</span>
              </span>
              <span class="ml-auto text-xs text-fg/50">Alta {{ fmtDate(p.created_at) }}</span>
            </button>
          </li>
        </ul>
        <Pagination v-if="meta" :page="page" :pages="meta.paginas" @go="router.push({ query: { ...route.query, pagina: String($event) } })" />
      </template>
    </template>
  </div>
</template>
