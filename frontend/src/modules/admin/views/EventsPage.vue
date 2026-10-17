<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { SITE_HOST, SITE_URL } from '@/core/config/brand'
import { eventsService } from '@admin/services/events.service'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiConteo, ApiEvento, ApiEventos } from '@admin/types/api'
import BarChart30d from '@admin/components/BarChart30d.vue'
import KpiTile from '@admin/components/KpiTile.vue'

// Un solo QR para todos los eventos: atlashacker.hxnf.mx/ir. Las visitas se guardan por hora y cada evento
// (nombre + horario) toma las que caen dentro; se puede registrar después del evento
const LINK = `${SITE_URL}/ir`
const LINK_LABEL = `${SITE_HOST}/ir`

const auth = useAuthStore()
const canEdit = computed(() => auth.can('admin'))
const canDelete = computed(() => auth.perms.remove)

const data = ref<ApiEventos | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const message = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

const nf = new Intl.NumberFormat('es-MX')
const fmt = (n: number) => nf.format(n)

async function load() {
  status.value = data.value ? 'ready' : 'loading'
  try {
    data.value = await eventsService.summary(30)
    status.value = 'ready'
  } catch (e) {
    console.error(e)
    if (!data.value) status.value = 'error'
  }
}

const days = computed(() => (data.value?.serie ?? []).map((d) => ({ fecha: d.dia, recibidos: d.total, aprobados: d.unicos })))

// --- Copiar el enlace ---
const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(LINK)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Sin portapapeles: el enlace está a la vista para copiarlo a mano
  }
}

// --- Fechas: <input type="datetime-local"> trabaja en la hora local del navegador ---
const pad = (n: number) => String(n).padStart(2, '0')
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v: string) => new Date(v).toISOString()

const dayFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' })
function when(e: Pick<ApiEvento, 'inicio' | 'fin'>) {
  const a = new Date(e.inicio)
  const b = new Date(e.fin)
  return a.toDateString() === b.toDateString()
    ? `${dayFmt.format(a)} · ${timeFmt.format(a)} a ${timeFmt.format(b)}`
    : `${dayFmt.format(a)} ${timeFmt.format(a)} al ${dayFmt.format(b)} ${timeFmt.format(b)}`
}

const now = ref(Date.now())
function phase(e: ApiEvento): 'live' | 'next' | null {
  if (new Date(e.inicio).getTime() <= now.value && now.value < new Date(e.fin).getTime()) return 'live'
  if (new Date(e.inicio).getTime() > now.value) return 'next'
  return null
}

// --- Alta y edición (mismo formulario) ---
const form = reactive({ id: null as string | null, nombre: '', lugar: '', inicio: '', fin: '' })
const formOpen = ref(false)
const saving = ref(false)
const formError = computed(() => {
  if (form.nombre.trim().length < 2) return 'Ponle un nombre al evento (p. ej. Feria de energía CDMX).'
  if (!form.inicio || !form.fin) return 'Indica cuándo empieza y cuándo termina.'
  if (new Date(form.fin) <= new Date(form.inicio)) return 'El evento debe terminar después de empezar.'
  return null
})

function openForm(e?: ApiEvento) {
  message.value = null
  if (e) {
    Object.assign(form, { id: e.id, nombre: e.nombre, lugar: e.lugar ?? '', inicio: toLocalInput(new Date(e.inicio)), fin: toLocalInput(new Date(e.fin)) })
  } else {
    // Propuesta: hoy de 10:00 a 18:00
    const start = new Date()
    start.setHours(10, 0, 0, 0)
    const end = new Date(start)
    end.setHours(18)
    Object.assign(form, { id: null, nombre: '', lugar: '', inicio: toLocalInput(start), fin: toLocalInput(end) })
  }
  formOpen.value = true
}

async function save() {
  if (formError.value || saving.value) return
  saving.value = true
  message.value = null
  const input = { nombre: form.nombre.trim(), lugar: form.lugar.trim(), inicio: fromLocalInput(form.inicio), fin: fromLocalInput(form.fin) }
  try {
    if (form.id) await eventsService.update(form.id, input)
    else await eventsService.create(input)
    formOpen.value = false
    message.value = { kind: 'ok', text: form.id ? 'Evento actualizado.' : 'Evento registrado. Sus visitas ya aparecen abajo.' }
    hours.value = {}
    await load()
  } catch (e) {
    message.value = { kind: 'error', text: (e as Partial<ApiError>).message ?? 'No se pudo guardar el evento.' }
  } finally {
    saving.value = false
  }
}

// --- Borrar (solo superadmin; las visitas se conservan y pasan a «fuera de evento») ---
const confirming = ref<string | null>(null)
async function remove(e: ApiEvento) {
  try {
    await eventsService.remove(e.id)
    confirming.value = null
    message.value = { kind: 'ok', text: `Se borró «${e.nombre}». Sus visitas quedan como fuera de evento.` }
    await load()
  } catch (err) {
    message.value = { kind: 'error', text: (err as Partial<ApiError>).message ?? 'No se pudo borrar.' }
  }
}

// --- Visitas por hora de un evento (se cargan al abrirlo) ---
const hours = ref<Record<string, ({ hora: string } & ApiConteo)[] | 'loading' | 'error'>>({})
const openHours = ref<string | null>(null)
async function toggleHours(e: ApiEvento) {
  if (openHours.value === e.id) {
    openHours.value = null
    return
  }
  openHours.value = e.id
  if (Array.isArray(hours.value[e.id])) return
  hours.value[e.id] = 'loading'
  try {
    hours.value[e.id] = await eventsService.hours(e.id)
  } catch {
    hours.value[e.id] = 'error'
  }
}
const hourFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
const maxOf = (rows: ApiConteo[]) => Math.max(1, ...rows.map((r) => r.total))

const link = 'text-xs font-semibold hover:underline'
onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-black uppercase"><span class="hl-box hl-blue" style="--hl-rot: -1deg">Eventos</span></h1>
        <p class="mt-2 text-sm font-semibold opacity-65">Cuántas personas entraron con el QR de la lona, evento por evento.</p>
      </div>
      <button v-if="status === 'ready'" type="button" class="btn-hxnf btn-paper btn-sm" @click="load(); now = Date.now()">Actualizar</button>
    </div>

    <!-- El enlace del QR -->
    <section class="space-y-3 rounded-[22px] border-2 border-ink bg-neon-lime p-4 text-black shadow-brut on-light md:p-5" aria-labelledby="link-title">
      <h2 id="link-title" class="text-sm font-black uppercase">El enlace de tu QR</h2>
      <div class="flex flex-wrap items-center gap-3">
        <a :href="LINK" target="_blank" rel="noopener" class="min-w-0 font-mono text-lg font-black break-all hover:underline md:text-2xl">{{ LINK_LABEL }}</a>
        <button type="button" class="btn-hxnf btn-ink btn-sm ml-auto" @click="copyLink">{{ copied ? '¡Copiado!' : 'Copiar enlace' }}</button>
      </div>
      <p class="text-xs font-semibold opacity-75">
        Un solo QR para todos los eventos: no cambia nunca. Lleva a la portada del Atlas y cuenta la visita. Para saber de qué evento vino
        cada visita, registra el evento con su horario (también puedes hacerlo después).
      </p>
    </section>

    <p v-if="message" class="rounded-xl px-4 py-2 text-sm" :class="message.kind === 'error' ? 'bg-brand-orange/15 text-danger' : 'bg-fg/5'" role="status">
      {{ message.text }}
    </p>

    <div v-if="status === 'loading'" class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
      <div v-for="n in 4" :key="n" class="h-28 animate-pulse rounded-2xl bg-fg/10" />
    </div>
    <div v-else-if="status === 'error'" class="space-y-2 rounded-[22px] border-2 border-ink bg-card p-6 shadow-brut" role="alert">
      <p class="font-semibold">No pudimos cargar las visitas.</p>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
    </div>

    <template v-else-if="data">
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Visitas al enlace">
        <KpiTile label="Personas" :value="fmt(data.total.unicos)" :detail="`${fmt(data.total.total)} escaneos en total`" />
        <KpiTile label="Hoy" :value="fmt(data.hoy.unicos)" :detail="`personas · ${fmt(data.hoy.total)} escaneos`" />
        <KpiTile label="Eventos" :value="fmt(data.eventos.length)" detail="registrados" />
        <KpiTile label="Fuera de evento" :value="fmt(data.fuera_de_evento.unicos)" :detail="`personas · ${fmt(data.fuera_de_evento.total)} escaneos`" />
      </section>

      <section class="min-w-0 rounded-[22px] border-2 border-ink bg-card p-4 shadow-brut md:p-5">
        <BarChart30d :days="days" :labels="['Escaneos', 'Personas']" subject="Visitas al enlace /ir" />
      </section>

      <!-- Eventos -->
      <section class="space-y-3" aria-labelledby="events-title">
        <div class="flex items-center justify-between gap-3">
          <h2 id="events-title" class="text-lg font-semibold">Tus eventos</h2>
          <button v-if="canEdit && !formOpen" type="button" class="btn-hxnf btn-paper btn-sm" @click="openForm()">Registrar evento</button>
        </div>

        <form v-if="formOpen" class="space-y-3 rounded-[22px] border-2 border-ink bg-card p-4 shadow-brut" @submit.prevent="save">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-1 text-sm">
              <span class="font-semibold">Nombre</span>
              <input v-model="form.nombre" type="text" maxlength="160" class="field-input text-sm md:py-2" placeholder="Feria de energía CDMX" />
            </label>
            <label class="space-y-1 text-sm">
              <span class="font-semibold">Lugar <span class="font-normal opacity-60">(opcional)</span></span>
              <input v-model="form.lugar" type="text" maxlength="200" class="field-input text-sm md:py-2" placeholder="Zócalo, CDMX" />
            </label>
            <label class="space-y-1 text-sm">
              <span class="font-semibold">Empieza</span>
              <input v-model="form.inicio" type="datetime-local" class="field-input text-sm md:py-2" />
            </label>
            <label class="space-y-1 text-sm">
              <span class="font-semibold">Termina</span>
              <input v-model="form.fin" type="datetime-local" class="field-input text-sm md:py-2" />
            </label>
          </div>
          <p class="text-xs text-fg/55">Cuentan las visitas desde la hora en que empieza (si empieza 10:30, desde las 10:00) hasta que termina.</p>
          <p v-if="formError" class="text-xs text-danger">{{ formError }}</p>
          <div class="flex gap-3">
            <button type="submit" class="btn-hxnf btn-ink btn-sm" :disabled="!!formError || saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
            <button type="button" class="text-sm text-fg/60 hover:underline" @click="formOpen = false">Cancelar</button>
          </div>
        </form>

        <p v-if="!data.eventos.length" class="rounded-[20px] border-2 border-dashed border-ink/40 px-4 py-3 text-sm text-fg/70">
          Aún no hay eventos. Registra el primero con su horario y verás cuántas personas escanearon la lona ahí.
        </p>

        <ul class="space-y-2">
          <li v-for="e in data.eventos" :key="e.id" class="rounded-[20px] border-2 border-ink bg-card p-3 text-sm shadow-brut-sm">
            <div class="flex flex-wrap items-start gap-x-4 gap-y-2">
              <div class="min-w-0 flex-1 basis-56">
                <p class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold">{{ e.nombre }}</span>
                  <span v-if="phase(e) === 'live'" class="chip border-black bg-neon-green text-black">En curso</span>
                  <span v-else-if="phase(e) === 'next'" class="chip bg-card">Próximo</span>
                </p>
                <p class="text-xs text-fg/60">{{ when(e) }}<template v-if="e.lugar"> · {{ e.lugar }}</template></p>
              </div>
              <dl class="flex shrink-0 gap-5 text-right">
                <div>
                  <dt class="text-[11px] font-black tracking-wider uppercase opacity-60">Personas</dt>
                  <dd class="font-wide text-2xl leading-none font-black tabular-nums">{{ fmt(e.unicos) }}</dd>
                </div>
                <div>
                  <dt class="text-[11px] font-black tracking-wider uppercase opacity-60">Escaneos</dt>
                  <dd class="font-wide text-2xl leading-none font-black tabular-nums opacity-70">{{ fmt(e.total) }}</dd>
                </div>
              </dl>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-4">
              <button v-if="e.total" type="button" :class="link" :aria-expanded="openHours === e.id" @click="toggleHours(e)">
                {{ openHours === e.id ? 'Ocultar horas' : 'Ver por hora' }}
              </button>
              <template v-if="canEdit">
                <button type="button" :class="link" @click="openForm(e)">Editar</button>
                <template v-if="canDelete">
                  <button v-if="confirming !== e.id" type="button" :class="[link, 'text-danger']" @click="confirming = e.id">Borrar</button>
                  <span v-else class="flex items-center gap-3 text-xs">
                    ¿Borrar el evento? Sus visitas se conservan.
                    <button type="button" class="font-semibold text-danger hover:underline" @click="remove(e)">Sí, borrar</button>
                    <button type="button" class="hover:underline" @click="confirming = null">No</button>
                  </span>
                </template>
              </template>
            </div>

            <div v-if="openHours === e.id" class="mt-3 border-t border-fg/10 pt-3">
              <p v-if="hours[e.id] === 'loading'" class="text-xs text-fg/50">Cargando…</p>
              <p v-else-if="hours[e.id] === 'error'" class="text-xs text-danger">No se pudieron cargar las horas.</p>
              <ul v-else-if="Array.isArray(hours[e.id])" class="space-y-1">
                <li v-for="h in hours[e.id] as ({ hora: string } & ApiConteo)[]" :key="h.hora" class="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-xs">
                  <span class="text-fg/65">{{ hourFmt.format(new Date(h.hora)) }}</span>
                  <span class="h-2.5 rounded-full bg-fg/10" aria-hidden="true">
                    <span class="block h-full rounded-full" :style="{ width: `${(h.total / maxOf(hours[e.id] as ApiConteo[])) * 100}%`, background: 'var(--chart-1)' }" />
                  </span>
                  <span class="tabular-nums"><b>{{ fmt(h.unicos) }}</b> <span class="text-fg/55">pers. · {{ fmt(h.total) }}</span></span>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </section>

      <p class="text-xs text-fg/55">
        <b>Personas</b>: cada celular en la misma red cuenta una vez al día (si escanea varias veces, no se repite).
        <b>Escaneos</b>: todas las veces que se abrió el enlace. Las vistas previas de WhatsApp y los robots no cuentan.
      </p>
    </template>
  </div>
</template>
