<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { categoryStyle, useCategoriesStore } from '@/modules/testimonies'
import { adminPeopleService } from '@admin/services/people.service'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiParticipanteDetalle, ApiParticipanteResumen, ApiTestimonioStaffFila, PaginaMeta } from '@admin/types/api'
import { fmtDate } from '@admin/data/labels'
import ModerationStatus from '@admin/components/ModerationStatus.vue'
import OneTimeFolio from '@admin/components/OneTimeFolio.vue'
import Pagination from '@admin/components/Pagination.vue'

const props = defineProps<{ id: string }>()

const auth = useAuthStore()
const categories = useCategoriesStore()

// Resumen sin datos personales: viene de la lista (estado de navegación). Si se llegó por enlace,
// se completa al pedir los datos (lo que sí queda en la bitácora)
const summary = ref<ApiParticipanteResumen | null>((window.history.state?.resumen as ApiParticipanteResumen) ?? null)
const personal = ref<ApiParticipanteDetalle['datos_personales'] | null>(null)
const revealing = ref(false)
const message = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

const fail = (e: unknown, fallback: string) =>
  (message.value = { kind: 'error', text: (e as Partial<ApiError>).message ?? fallback })

async function reveal() {
  revealing.value = true
  message.value = null
  try {
    const d = await adminPeopleService.get(props.id)
    const { datos_personales, ...rest } = d
    summary.value = rest
    personal.value = datos_personales
    Object.assign(form, { nombre: datos_personales.nombre ?? '', correo: datos_personales.correo ?? '', telefono: datos_personales.telefono ?? '' })
    form.nombre_publico = rest.nombre_publico ?? ''
    form.perfil_publico = rest.perfil_publico
  } catch (e) {
    fail(e, 'No se pudieron cargar los datos.')
  } finally {
    revealing.value = false
  }
}

// --- Rectificación ---
const form = reactive({ nombre: '', correo: '', telefono: '', perfil_publico: false, nombre_publico: '' })
const saving = ref(false)

async function save() {
  if (!personal.value || !summary.value) return
  const p = personal.value
  const changes: Record<string, unknown> = {}
  // Vacío = borrar el dato (null)
  for (const [key, before] of [['nombre', p.nombre], ['correo', p.correo], ['telefono', p.telefono]] as const) {
    const now = form[key].trim()
    if (now !== (before ?? '')) changes[key] = now || null
  }
  if (form.perfil_publico !== summary.value.perfil_publico) changes.perfil_publico = form.perfil_publico
  if (form.nombre_publico.trim() !== (summary.value.nombre_publico ?? '')) changes.nombre_publico = form.nombre_publico.trim() || null
  if (!Object.keys(changes).length) return (message.value = { kind: 'ok', text: 'No hay cambios.' })
  saving.value = true
  try {
    summary.value = await adminPeopleService.update(props.id, changes)
    personal.value = { nombre: form.nombre.trim() || null, correo: form.correo.trim() || null, telefono: form.telefono.trim() || null }
    message.value = { kind: 'ok', text: 'Datos rectificados.' }
  } catch (e) {
    fail(e, 'No se pudo guardar.')
  } finally {
    saving.value = false
  }
}

async function toggleActive() {
  if (!summary.value) return
  try {
    summary.value = await adminPeopleService.update(props.id, { activo: !summary.value.activo })
    message.value = { kind: 'ok', text: summary.value.activo ? 'Folio reactivado.' : 'Folio desactivado: ya no puede subir ni editar.' }
  } catch (e) {
    fail(e, 'No se pudo cambiar.')
  }
}

// --- Folio nuevo ---
const confirmingRotate = ref(false)
const newFolio = ref<string | null>(null)
async function rotate() {
  try {
    newFolio.value = await adminPeopleService.rotateFolio(props.id)
    confirmingRotate.value = false
    if (summary.value) summary.value.folio_pista = newFolio.value.slice(-4)
  } catch (e) {
    fail(e, 'No se pudo emitir el folio.')
  }
}

// --- Cancelación (solo admin) ---
const cancel = reactive({ open: false, anonymize: true, confirm: '', busy: false })
async function cancelData() {
  if (cancel.confirm.trim().toUpperCase() !== 'CANCELAR') return
  cancel.busy = true
  try {
    await adminPeopleService.cancelData(props.id, cancel.anonymize)
    personal.value = { nombre: null, correo: null, telefono: null }
    Object.assign(form, { nombre: '', correo: '', telefono: '', perfil_publico: false, nombre_publico: '' })
    if (summary.value) Object.assign(summary.value, { dejo_nombre: false, dejo_correo: false, dejo_telefono: false, perfil_publico: false, nombre_publico: null, datos_cancelados_at: new Date().toISOString() })
    Object.assign(cancel, { open: false, confirm: '' })
    message.value = { kind: 'ok', text: 'Datos personales cancelados.' }
  } catch (e) {
    fail(e, 'No se pudieron cancelar los datos.')
  } finally {
    cancel.busy = false
  }
}

// --- Sus testimonios ---
const testimonies = ref<ApiTestimonioStaffFila[]>([])
const tMeta = ref<PaginaMeta | null>(null)
const tPage = ref(1)
async function loadTestimonies(p = 1) {
  tPage.value = p
  try {
    const r = await adminPeopleService.testimonies(props.id, p)
    testimonies.value = r.rows
    tMeta.value = r.meta
  } catch (e) {
    fail(e, 'No se pudieron cargar sus testimonios.')
  }
}

onMounted(() => {
  loadTestimonies()
  categories.load().catch(() => {})
})

const hint = computed(() => summary.value?.folio_pista ?? '')
const btn = 'rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
</script>

<template>
  <div class="space-y-6">
    <RouterLink :to="{ name: 'admin-people' }" class="inline-flex items-center gap-1.5 text-sm text-fg/70 hover:text-fg">
      <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      Personas
    </RouterLink>

    <header class="space-y-1">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <h1 class="font-mono text-2xl font-semibold">{{ hint ? `P-…-${hint}` : 'Persona' }}</h1>
        <RouterLink v-if="auth.can('admin')" :to="{ name: 'admin-log', query: { entidad_id: id } }" class="text-sm font-semibold text-accent-ink hover:underline">
          Historial
        </RouterLink>
      </div>
      <p v-if="summary" class="text-sm text-fg/60">
        {{ summary.testimonios }} testimonios · {{ summary.aprobados }} publicados · alta {{ fmtDate(summary.created_at) }}
        <template v-if="!summary.activo"> · <span class="font-semibold">folio desactivado</span></template>
        <template v-if="summary.datos_cancelados_at"> · datos cancelados {{ fmtDate(summary.datos_cancelados_at) }}</template>
      </p>
    </header>

    <p v-if="message" class="rounded-xl px-4 py-2 text-sm" :class="message.kind === 'error' ? 'bg-brand-orange/15 text-danger' : 'bg-fg/5'" role="status">
      {{ message.text }}
    </p>

    <OneTimeFolio v-if="newFolio" :folio="newFolio" title="Folio nuevo" />

    <div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <!-- Datos personales -->
      <section class="min-w-0 space-y-4 rounded-2xl border border-fg/15 p-5" aria-labelledby="pii-title">
        <h2 id="pii-title" class="font-semibold">Datos personales</h2>
        <template v-if="!personal">
          <p class="text-sm text-fg/60">
            Se guardan cifrados y no se muestran por defecto. Al verlos, la consulta queda registrada en la bitácora (quién y cuándo).
          </p>
          <ul v-if="summary" class="flex flex-wrap gap-2 text-xs">
            <li class="rounded-full border border-fg/20 px-2.5 py-1">Nombre: {{ summary.dejo_nombre ? 'guardado' : 'no' }}</li>
            <li class="rounded-full border border-fg/20 px-2.5 py-1">Correo: {{ summary.dejo_correo ? 'guardado' : 'no' }}</li>
            <li class="rounded-full border border-fg/20 px-2.5 py-1">Teléfono: {{ summary.dejo_telefono ? 'guardado' : 'no' }}</li>
          </ul>
          <button type="button" :class="[btn, 'border border-fg/25 hover:border-fg']" :disabled="revealing" @click="reveal">
            {{ revealing ? 'Cargando…' : 'Ver y rectificar datos personales' }}
          </button>
        </template>

        <form v-else class="space-y-3" @submit.prevent="save">
          <p class="text-xs text-fg/50">Deja un campo vacío para borrarlo.</p>
          <div class="grid gap-3 sm:grid-cols-3">
            <label class="space-y-1 text-sm"><span class="font-semibold">Nombre</span><input v-model="form.nombre" type="text" maxlength="150" class="field-input text-sm md:py-2" /></label>
            <label class="space-y-1 text-sm"><span class="font-semibold">Correo</span><input v-model="form.correo" type="email" class="field-input text-sm md:py-2" /></label>
            <label class="space-y-1 text-sm"><span class="font-semibold">Teléfono</span><input v-model="form.telefono" type="tel" maxlength="25" class="field-input text-sm md:py-2" /></label>
          </div>
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <input v-model="form.perfil_publico" type="checkbox" class="size-4 accent-neon-lime" />
            Perfil público (aparece en la lista de colaboradores)
          </label>
          <input
            v-if="form.perfil_publico"
            v-model="form.nombre_publico"
            type="text"
            maxlength="150"
            class="field-input text-sm md:py-2"
            placeholder="Nombre a mostrar"
            aria-label="Nombre a mostrar"
          />
          <button type="submit" :class="[btn, 'bg-fg text-surface']" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar rectificación' }}</button>
        </form>
      </section>

      <!-- Acceso y derechos -->
      <aside class="min-w-0 space-y-4">
        <section class="space-y-3 rounded-2xl border border-fg/15 p-4 text-sm" aria-labelledby="access-title">
          <h2 id="access-title" class="font-semibold">Acceso con folio</h2>
          <p class="text-fg/60">Si la persona perdió su folio, emite uno nuevo y entrégaselo por un canal seguro.</p>
          <div v-if="confirmingRotate" class="space-y-2 rounded-xl bg-fg/5 p-3">
            <p>El folio anterior dejará de funcionar. ¿Continuar?</p>
            <div class="flex gap-2">
              <button type="button" :class="[btn, 'bg-neon-lime text-black']" @click="rotate">Emitir folio nuevo</button>
              <button type="button" class="text-sm text-fg/60 hover:underline" @click="confirmingRotate = false">Cancelar</button>
            </div>
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <button type="button" :class="[btn, 'border border-fg/25 hover:border-fg']" @click="(confirmingRotate = true), (newFolio = null)">
              Emitir folio nuevo
            </button>
            <button v-if="summary" type="button" :class="[btn, 'border border-fg/25 hover:border-fg']" @click="toggleActive">
              {{ summary.activo ? 'Desactivar folio' : 'Reactivar folio' }}
            </button>
          </div>
        </section>

        <section v-if="auth.can('admin')" class="space-y-3 rounded-2xl border border-fg/15 p-4 text-sm" aria-labelledby="arco-title">
          <h2 id="arco-title" class="font-semibold">Cancelar datos personales</h2>
          <p class="text-fg/60">Derecho de cancelación: borra nombre, correo y teléfono. Los testimonios no se eliminan.</p>
          <button v-if="!cancel.open" type="button" :class="[btn, 'text-danger hover:underline']" @click="cancel.open = true">
            Cancelar datos…
          </button>
          <div v-else class="space-y-2 rounded-xl border border-brand-orange/50 p-3">
            <label class="flex cursor-pointer items-center gap-2">
              <input v-model="cancel.anonymize" type="checkbox" class="size-4 accent-neon-lime" />
              También anonimizar sus testimonios (sin nombre y con ubicación aproximada)
            </label>
            <p>Escribe <span class="font-mono font-semibold">CANCELAR</span> para confirmar:</p>
            <input v-model="cancel.confirm" type="text" class="field-input font-mono text-sm md:py-2" aria-label="Confirmación" />
            <div class="flex gap-2">
              <button
                type="button"
                :class="[btn, 'bg-brand-orange text-black']"
                :disabled="cancel.busy || cancel.confirm.trim().toUpperCase() !== 'CANCELAR'"
                @click="cancelData"
              >
                Cancelar datos personales
              </button>
              <button type="button" class="text-sm text-fg/60 hover:underline" @click="cancel.open = false">No</button>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <!-- Sus testimonios -->
    <section class="space-y-3" aria-labelledby="mine-title">
      <h2 id="mine-title" class="font-semibold">Sus testimonios</h2>
      <p v-if="tMeta && !testimonies.length" class="text-sm text-fg/50">Sin testimonios.</p>
      <ul class="space-y-2">
        <li v-for="t in testimonies" :key="t.id">
          <RouterLink
            :to="{ name: 'admin-testimony', params: { id: t.id } }"
            class="flex flex-wrap items-center gap-2 rounded-2xl border border-fg/15 p-3 text-sm transition hover:border-fg/40"
          >
            <ModerationStatus :estado="t.estado" :activo="t.activo" :publico="t.es_publico" />
            <span class="size-2 rounded-full" :class="categoryStyle(t.categoria_slug).bg" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate font-semibold">{{ t.titulo || 'Sin título' }}</span>
            <span class="font-mono text-xs text-fg/50">{{ t.folio }}</span>
          </RouterLink>
        </li>
      </ul>
      <Pagination v-if="tMeta" :page="tPage" :pages="tMeta.paginas" @go="loadTestimonies" />
    </section>
  </div>
</template>
