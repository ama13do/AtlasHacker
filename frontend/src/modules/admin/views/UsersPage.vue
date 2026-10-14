<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { usersService } from '@admin/services/users.service'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiUsuarioStaff, Rol } from '@admin/types/api'
import { fmtDate } from '@admin/data/labels'
import OneTimeSecret from '@admin/components/OneTimeSecret.vue'

const ROLES: { value: Rol; label: string; description: string }[] = [
  { value: 'admin', label: 'Administración', description: 'Todo, incluidos usuarios, configuración y bitácora.' },
  { value: 'moderador', label: 'Moderación', description: 'Aprobar, rechazar y editar testimonios, comentarios y personas.' },
  { value: 'facilitador', label: 'Facilitación', description: 'Captura fichas en papel y ve solo lo que capturó.' },
  { value: 'lector', label: 'Lectura', description: 'Solo consulta.' },
]
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label])) as Record<Rol, string>

const auth = useAuthStore()
const users = ref<ApiUsuarioStaff[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const message = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)
// Contraseña temporal recién emitida (una sola vez)
const secret = ref<{ title: string; value: string } | null>(null)

async function load() {
  status.value = 'loading'
  try {
    users.value = await usersService.list()
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

const fail = (e: unknown, fallback: string) => (message.value = { kind: 'error', text: (e as Partial<ApiError>).message ?? fallback })

// --- Alta ---
const creating = ref(false)
const form = reactive({ email: '', nombre: '', rol: 'moderador' as Rol })
const saving = ref(false)
async function create() {
  saving.value = true
  message.value = null
  try {
    const r = await usersService.create({ email: form.email.trim(), nombre: form.nombre.trim(), rol: form.rol })
    users.value = [r.usuario, ...users.value]
    if (r.password_temporal) secret.value = { title: `Contraseña temporal de ${r.usuario.email}`, value: r.password_temporal }
    Object.assign(form, { email: '', nombre: '', rol: 'moderador' })
    creating.value = false
  } catch (e) {
    fail(e, 'No se pudo crear el usuario.')
  } finally {
    saving.value = false
  }
}

// --- Edición y acciones por fila ---
const editing = ref<string | null>(null)
const edit = reactive({ nombre: '', email: '', rol: 'lector' as Rol })
const confirming = ref<{ id: string; action: 'reset' | 'sessions' } | null>(null)
const busy = ref<string | null>(null)

function startEdit(u: ApiUsuarioStaff) {
  editing.value = u.id
  Object.assign(edit, { nombre: u.nombre ?? '', email: u.email, rol: u.rol })
}

function replace(u: ApiUsuarioStaff) {
  users.value = users.value.map((x) => (x.id === u.id ? u : x))
}

async function run(id: string, fn: () => Promise<void>) {
  busy.value = id
  message.value = null
  try {
    await fn()
  } catch (e) {
    fail(e, 'No se pudo completar la acción.')
  } finally {
    busy.value = null
  }
}

const saveEdit = (u: ApiUsuarioStaff) =>
  run(u.id, async () => {
    const changes: Record<string, unknown> = {}
    if (edit.nombre.trim() !== (u.nombre ?? '')) changes.nombre = edit.nombre.trim()
    if (edit.email.trim() !== u.email) changes.email = edit.email.trim()
    if (edit.rol !== u.rol) changes.rol = edit.rol
    if (Object.keys(changes).length) replace(await usersService.update(u.id, changes))
    editing.value = null
  })

const toggleActive = (u: ApiUsuarioStaff) =>
  run(u.id, async () => {
    replace(await usersService.update(u.id, { activo: !u.activo }))
    message.value = { kind: 'ok', text: u.activo ? `${u.email} desactivado: sus sesiones se cerraron.` : `${u.email} reactivado.` }
  })

const resetPassword = (u: ApiUsuarioStaff) =>
  run(u.id, async () => {
    const value = await usersService.resetPassword(u.id)
    secret.value = { title: `Contraseña temporal de ${u.email}`, value }
    confirming.value = null
    replace({ ...u, debe_cambiar_password: true })
  })

const closeSessions = (u: ApiUsuarioStaff) =>
  run(u.id, async () => {
    await usersService.closeSessions(u.id)
    confirming.value = null
    message.value = { kind: 'ok', text: `Se cerraron las sesiones de ${u.email}.` }
  })

const blocked = (u: ApiUsuarioStaff) => !!u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()
const link = 'text-xs font-semibold hover:underline disabled:opacity-50'

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-black uppercase"><span class="hl-box hl-lime" style="--hl-rot: -1deg">Usuarios</span></h1>
        <p class="text-sm text-fg/60">Cuentas del equipo y sus roles.</p>
      </div>
      <button type="button" class="btn-hxnf btn-ink btn-sm" @click="creating = !creating">
        {{ creating ? 'Cerrar' : 'Nuevo usuario' }}
      </button>
    </div>

    <OneTimeSecret
      v-if="secret"
      :title="secret.title"
      :value="secret.value"
      hint="Cópiala y entrégala por un canal seguro: no se mostrará otra vez. Se le pedirá cambiarla al entrar."
    />
    <p v-if="message" class="rounded-xl px-4 py-2 text-sm" :class="message.kind === 'error' ? 'bg-brand-orange/15 text-danger' : 'bg-fg/5'" role="status">
      {{ message.text }}
    </p>

    <!-- Alta -->
    <form v-if="creating" class="border-2 border-ink bg-card shadow-brut space-y-3 rounded-[22px] p-4" @submit.prevent="create">
      <div class="grid gap-3 sm:grid-cols-2">
        <input v-model="form.nombre" type="text" required minlength="2" maxlength="120" class="field-input text-sm md:py-2" placeholder="Nombre" aria-label="Nombre" />
        <input v-model="form.email" type="email" required class="field-input text-sm md:py-2" placeholder="Correo" aria-label="Correo" />
      </div>
      <fieldset class="grid gap-2 sm:grid-cols-2">
        <legend class="mb-1 text-sm font-semibold">Rol</legend>
        <label
          v-for="r in ROLES"
          :key="r.value"
          class="flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm"
          :class="form.rol === r.value ? 'border-fg bg-fg/5' : 'border-fg/15'"
        >
          <input v-model="form.rol" type="radio" :value="r.value" class="mt-1 size-4 accent-neon-lime" />
          <span><span class="font-semibold">{{ r.label }}</span><span class="block text-xs text-fg/60">{{ r.description }}</span></span>
        </label>
      </fieldset>
      <p class="text-xs text-fg/50">Se genera una contraseña temporal que verás una sola vez.</p>
      <button type="submit" class="btn-hxnf btn-lime btn-sm" :disabled="saving">
        {{ saving ? 'Creando…' : 'Crear usuario' }}
      </button>
    </form>

    <div v-if="status === 'loading'" class="space-y-2" aria-hidden="true">
      <div v-for="n in 4" :key="n" class="h-16 animate-pulse rounded-2xl bg-fg/10" />
    </div>
    <div v-else-if="status === 'error'" class="border-2 border-ink bg-card shadow-brut space-y-2 rounded-[22px] p-6" role="alert">
      <p class="font-semibold">No pudimos cargar los usuarios.</p>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
    </div>

    <ul v-else class="space-y-2">
      <li v-for="u in users" :key="u.id" class="space-y-2 rounded-[20px] border-2 border-ink bg-card shadow-brut-sm p-4 text-sm" :class="{ 'opacity-60': !u.activo }">
        <!-- Edición en línea -->
        <form v-if="editing === u.id" class="space-y-2" @submit.prevent="saveEdit(u)">
          <div class="grid gap-2 sm:grid-cols-3">
            <input v-model="edit.nombre" type="text" minlength="2" maxlength="120" class="field-input text-sm md:py-1.5" aria-label="Nombre" />
            <input v-model="edit.email" type="email" class="field-input text-sm md:py-1.5" aria-label="Correo" />
            <select v-model="edit.rol" class="field-input text-sm md:py-1.5" aria-label="Rol" :disabled="u.id === auth.user?.id">
              <option v-for="r in ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </div>
          <div class="flex gap-3">
            <button type="submit" :class="[link, 'text-accent-ink']" :disabled="busy === u.id">Guardar</button>
            <button type="button" :class="[link, 'text-fg/60']" @click="editing = null">Cancelar</button>
          </div>
        </form>

        <template v-else>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="font-semibold">{{ u.nombre || u.email }}</span>
            <span class="text-fg/60">{{ u.email }}</span>
            <span class="chip bg-card">{{ ROLE_LABEL[u.rol] }}</span>
            <span v-if="u.id === auth.user?.id" class="text-xs text-fg/50">(tú)</span>
            <span v-if="!u.activo" class="chip bg-card">Desactivado</span>
            <span v-if="blocked(u)" class="rounded-full bg-brand-orange px-2 py-0.5 text-xs font-semibold text-black">
              Bloqueado hasta {{ fmtDate(u.bloqueado_hasta, true) }}
            </span>
            <span v-if="u.debe_cambiar_password" class="text-xs text-fg/60">· debe cambiar contraseña</span>
            <span class="ml-auto text-xs text-fg/50">Último acceso: {{ fmtDate(u.ultimo_login_at, true) }}</span>
          </div>

          <div v-if="confirming?.id === u.id" class="flex flex-wrap items-center gap-3 rounded-xl bg-fg/5 px-3 py-2 text-xs">
            <span>{{ confirming.action === 'reset' ? 'Se generará una contraseña temporal y se cerrarán sus sesiones.' : 'Se cerrarán todas sus sesiones.' }}</span>
            <button
              type="button"
              :class="[link, 'text-accent-ink']"
              :disabled="busy === u.id"
              @click="confirming.action === 'reset' ? resetPassword(u) : closeSessions(u)"
            >
              Confirmar
            </button>
            <button type="button" :class="[link, 'text-fg/60']" @click="confirming = null">Cancelar</button>
          </div>
          <div v-else class="flex flex-wrap gap-4">
            <button type="button" :class="link" @click="startEdit(u)">Editar</button>
            <button v-if="u.id !== auth.user?.id" type="button" :class="link" :disabled="busy === u.id" @click="toggleActive(u)">
              {{ u.activo ? 'Desactivar' : 'Reactivar' }}
            </button>
            <button type="button" :class="link" @click="confirming = { id: u.id, action: 'reset' }">Restablecer contraseña</button>
            <button type="button" :class="link" @click="confirming = { id: u.id, action: 'sessions' }">Cerrar sesiones</button>
          </div>
        </template>
      </li>
    </ul>
  </div>
</template>
