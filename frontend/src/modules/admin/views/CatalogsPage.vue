<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { categoryStyle, useCategoriesStore } from '@/modules/testimonies'
import { catalogsService } from '@admin/services/catalogs.service'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiCategoriaStaff, ApiExpedienteStaff } from '@admin/types/api'

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const COLOR = /^#[0-9a-fA-F]{6}$/
const CODE = /^[A-Z0-9]+(\/[A-Z0-9]+)*$/

const auth = useAuthStore()
const publicCategories = useCategoriesStore()
const canEdit = computed(() => auth.can('admin'))

const categories = ref<ApiCategoriaStaff[]>([])
const cases = ref<ApiExpedienteStaff[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const message = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

async function load() {
  status.value = 'loading'
  try {
    ;[categories.value, cases.value] = await Promise.all([catalogsService.categories(), catalogsService.cases()])
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

function fail(e: unknown, fallback: string) {
  const err = e as Partial<ApiError>
  message.value = { kind: 'error', text: err.status === 409 ? (err.message ?? 'Ya existe.') : (err.message ?? fallback) }
}

// --- Categorías (alta y edición comparten formulario) ---
const catForm = reactive({ id: null as string | null, slug: '', nombre: '', descripcion: '', color: '', orden: 0 })
const catOpen = ref(false)
const catError = computed(() => {
  if (!catForm.nombre.trim() || catForm.nombre.trim().length < 2) return 'El nombre necesita al menos 2 caracteres.'
  if (!SLUG.test(catForm.slug.trim())) return 'El identificador solo admite minúsculas, números y guiones (p. ej. agua-y-territorio).'
  if (catForm.color && !COLOR.test(catForm.color)) return 'El color debe tener el formato #RRGGBB.'
  return null
})

function editCategory(c?: ApiCategoriaStaff) {
  Object.assign(catForm, c
    ? { id: c.id, slug: c.slug, nombre: c.nombre, descripcion: c.descripcion ?? '', color: c.color ?? '', orden: c.orden }
    : { id: null, slug: '', nombre: '', descripcion: '', color: '', orden: categories.value.length + 1 })
  catOpen.value = true
}

async function saveCategory() {
  if (catError.value) return
  message.value = null
  const input = {
    slug: catForm.slug.trim(),
    nombre: catForm.nombre.trim(),
    descripcion: catForm.descripcion.trim() || undefined,
    color: catForm.color || undefined,
    orden: Number(catForm.orden) || 0,
  }
  try {
    const saved = catForm.id ? await catalogsService.updateCategory(catForm.id, input) : await catalogsService.createCategory(input)
    categories.value = catForm.id ? categories.value.map((c) => (c.id === saved.id ? saved : c)) : [...categories.value, saved]
    catOpen.value = false
    message.value = { kind: 'ok', text: 'Categoría guardada.' }
    publicCategories.reload().catch(() => {})
  } catch (e) {
    fail(e, 'No se pudo guardar la categoría.')
  }
}

async function toggleCategory(c: ApiCategoriaStaff) {
  try {
    const saved = await catalogsService.updateCategory(c.id, { activo: !c.activo })
    categories.value = categories.value.map((x) => (x.id === saved.id ? saved : x))
    publicCategories.reload().catch(() => {})
  } catch (e) {
    fail(e, 'No se pudo cambiar.')
  }
}

// --- Expedientes ---
const caseForm = reactive({ id: null as string | null, codigo: '', titulo: '', materia: '', descripcion: '' })
const caseOpen = ref(false)
const caseError = computed(() => {
  if (!CODE.test(caseForm.codigo.trim().toUpperCase())) return 'El código debe verse como FUTURO/002.'
  if (caseForm.titulo.trim().length < 2) return 'El título necesita al menos 2 caracteres.'
  if (caseForm.materia.trim().length < 2) return 'La materia necesita al menos 2 caracteres.'
  return null
})

function editCase(e?: ApiExpedienteStaff) {
  Object.assign(caseForm, e
    ? { id: e.id, codigo: e.codigo, titulo: e.titulo, materia: e.materia ?? '', descripcion: e.descripcion ?? '' }
    : { id: null, codigo: '', titulo: '', materia: '', descripcion: '' })
  caseOpen.value = true
}

async function saveCase() {
  if (caseError.value) return
  message.value = null
  const input = {
    codigo: caseForm.codigo.trim().toUpperCase(),
    titulo: caseForm.titulo.trim(),
    materia: caseForm.materia.trim(),
    descripcion: caseForm.descripcion.trim() || undefined,
  }
  try {
    const saved = caseForm.id ? await catalogsService.updateCase(caseForm.id, input) : await catalogsService.createCase(input)
    cases.value = caseForm.id ? cases.value.map((x) => (x.id === saved.id ? saved : x)) : [...cases.value, saved]
    caseOpen.value = false
    message.value = { kind: 'ok', text: 'Expediente guardado.' }
  } catch (e) {
    fail(e, 'No se pudo guardar el expediente.')
  }
}

async function toggleCase(e: ApiExpedienteStaff) {
  try {
    const saved = await catalogsService.updateCase(e.id, { activo: !e.activo })
    cases.value = cases.value.map((x) => (x.id === saved.id ? saved : x))
  } catch (err) {
    fail(err, 'No se pudo cambiar.')
  }
}

const link = 'text-xs font-semibold hover:underline'
onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Catálogos</h1>
      <p class="text-sm text-fg/60">Categorías de los testimonios y expedientes del Tribunal.</p>
    </div>

    <p v-if="message" class="rounded-xl px-4 py-2 text-sm" :class="message.kind === 'error' ? 'bg-brand-orange/15 text-danger' : 'bg-fg/5'" role="status">
      {{ message.text }}
    </p>

    <div v-if="status === 'loading'" class="h-40 animate-pulse rounded-2xl bg-fg/10" aria-hidden="true" />
    <div v-else-if="status === 'error'" class="space-y-2 rounded-2xl border border-fg/15 p-6" role="alert">
      <p class="font-semibold">No pudimos cargar los catálogos.</p>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
    </div>

    <template v-else>
      <!-- Categorías -->
      <section class="space-y-3" aria-labelledby="cat-title">
        <div class="flex items-center justify-between gap-3">
          <h2 id="cat-title" class="text-lg font-semibold">Categorías</h2>
          <button v-if="canEdit && !catOpen" type="button" class="rounded-full border border-fg/25 px-4 py-1.5 text-sm font-semibold hover:border-fg" @click="editCategory()">
            Nueva categoría
          </button>
        </div>

        <form v-if="catOpen" class="space-y-3 rounded-2xl border border-fg/15 p-4" @submit.prevent="saveCategory">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-1 text-sm"><span class="font-semibold">Nombre</span><input v-model="catForm.nombre" type="text" maxlength="120" class="field-input text-sm md:py-2" /></label>
            <label class="space-y-1 text-sm">
              <span class="font-semibold">Identificador (slug)</span>
              <input v-model="catForm.slug" type="text" maxlength="80" class="field-input font-mono text-sm md:py-2" placeholder="agua-y-territorio" />
            </label>
          </div>
          <label class="block space-y-1 text-sm"><span class="font-semibold">Descripción</span><textarea v-model="catForm.descripcion" rows="2" maxlength="1000" class="field-input text-sm" /></label>
          <div class="flex flex-wrap gap-4 text-sm">
            <label class="flex items-center gap-2">Orden <input v-model.number="catForm.orden" type="number" min="0" max="1000" class="field-input w-20 text-sm md:py-1.5" /></label>
            <label class="flex items-center gap-2">
              Color en la API
              <input v-model="catForm.color" type="text" maxlength="7" class="field-input w-28 font-mono text-sm md:py-1.5" placeholder="#RRGGBB" />
            </label>
          </div>
          <p class="text-xs text-fg/50">
            El mapa usa los colores de la marca por identificador; una categoría nueva recibe uno automático. Cambiar el identificador de una
            existente le cambia el color y el ícono.
          </p>
          <p v-if="catError" class="text-xs text-danger">{{ catError }}</p>
          <div class="flex gap-3">
            <button type="submit" class="rounded-full bg-fg px-5 py-2 text-sm font-semibold text-surface disabled:opacity-50" :disabled="!!catError">Guardar</button>
            <button type="button" class="text-sm text-fg/60 hover:underline" @click="catOpen = false">Cancelar</button>
          </div>
        </form>

        <ul class="space-y-2">
          <li v-for="c in categories" :key="c.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-fg/15 p-3 text-sm" :class="{ 'opacity-60': !c.activo }">
            <span class="size-3 shrink-0 rounded-full" :class="categoryStyle(c.slug).bg" aria-hidden="true" />
            <span class="font-semibold">{{ c.nombre }}</span>
            <span class="font-mono text-xs text-fg/50">{{ c.slug }}</span>
            <span v-if="!c.activo" class="rounded-full border border-fg/25 px-2 text-xs">Inactiva</span>
            <span class="text-xs text-fg/50">orden {{ c.orden }}</span>
            <span v-if="canEdit" class="ml-auto flex gap-4">
              <button type="button" :class="link" @click="editCategory(c)">Editar</button>
              <button type="button" :class="link" @click="toggleCategory(c)">{{ c.activo ? 'Desactivar' : 'Activar' }}</button>
            </span>
            <p v-if="c.descripcion" class="w-full text-xs text-fg/60">{{ c.descripcion }}</p>
          </li>
        </ul>
      </section>

      <!-- Expedientes -->
      <section class="space-y-3" aria-labelledby="case-title">
        <div class="flex items-center justify-between gap-3">
          <h2 id="case-title" class="text-lg font-semibold">Expedientes</h2>
          <button v-if="canEdit && !caseOpen" type="button" class="rounded-full border border-fg/25 px-4 py-1.5 text-sm font-semibold hover:border-fg" @click="editCase()">
            Nuevo expediente
          </button>
        </div>

        <form v-if="caseOpen" class="space-y-3 rounded-2xl border border-fg/15 p-4" @submit.prevent="saveCase">
          <div class="grid gap-3 sm:grid-cols-3">
            <label class="space-y-1 text-sm"><span class="font-semibold">Código</span><input v-model="caseForm.codigo" type="text" maxlength="40" class="field-input font-mono text-sm uppercase md:py-2" placeholder="FUTURO/002" /></label>
            <label class="space-y-1 text-sm sm:col-span-2"><span class="font-semibold">Título</span><input v-model="caseForm.titulo" type="text" maxlength="200" class="field-input text-sm md:py-2" /></label>
          </div>
          <label class="block space-y-1 text-sm"><span class="font-semibold">Materia</span><input v-model="caseForm.materia" type="text" maxlength="200" class="field-input text-sm md:py-2" placeholder="Sistema Energético Nacional" /></label>
          <label class="block space-y-1 text-sm"><span class="font-semibold">Descripción</span><textarea v-model="caseForm.descripcion" rows="2" maxlength="2000" class="field-input text-sm" /></label>
          <p v-if="caseError" class="text-xs text-danger">{{ caseError }}</p>
          <div class="flex gap-3">
            <button type="submit" class="rounded-full bg-fg px-5 py-2 text-sm font-semibold text-surface disabled:opacity-50" :disabled="!!caseError">Guardar</button>
            <button type="button" class="text-sm text-fg/60 hover:underline" @click="caseOpen = false">Cancelar</button>
          </div>
        </form>

        <ul class="space-y-2">
          <li v-for="e in cases" :key="e.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-fg/15 p-3 text-sm" :class="{ 'opacity-60': !e.activo }">
            <span class="font-mono font-semibold">{{ e.codigo }}</span>
            <span>{{ e.titulo }}</span>
            <span v-if="e.materia" class="text-xs text-fg/50">· {{ e.materia }}</span>
            <span v-if="!e.activo" class="rounded-full border border-fg/25 px-2 text-xs">Inactivo</span>
            <span v-if="canEdit" class="ml-auto flex gap-4">
              <button type="button" :class="link" @click="editCase(e)">Editar</button>
              <button type="button" :class="link" @click="toggleCase(e)">{{ e.activo ? 'Desactivar' : 'Activar' }}</button>
            </span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
