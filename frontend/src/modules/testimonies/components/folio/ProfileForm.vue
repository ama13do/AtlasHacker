<script setup lang="ts">
import { reactive, ref, useId } from 'vue'
import type { ApiError } from '@/core/http/client'
import { participantService, type ProfileChanges } from '@testimonies/services/participant.service'
import type { ParticipantProfile } from '@testimonies/types/testimony'

// Datos opcionales de la persona (se guardan cifrados) y su perfil público.
// Nunca se muestran sin pedirlo: "Ver mis datos" los descifra y la consulta queda registrada
const props = defineProps<{ folio: string; profile: ParticipantProfile }>()
const emit = defineEmits<{ updated: [profile: ParticipantProfile] }>()

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[\d\s().-]{7,25}$/

type Field = 'name' | 'email' | 'phone'
const FIELDS: { key: Field; api: 'nombre' | 'correo' | 'telefono'; label: string; has: keyof ParticipantProfile; type: string; autocomplete: string }[] = [
  { key: 'name', api: 'nombre', label: 'Nombre', has: 'hasName', type: 'text', autocomplete: 'name' },
  { key: 'email', api: 'correo', label: 'Correo', has: 'hasEmail', type: 'email', autocomplete: 'email' },
  { key: 'phone', api: 'telefono', label: 'Teléfono', has: 'hasPhone', type: 'tel', autocomplete: 'tel' },
]

const ids = Object.fromEntries(FIELDS.map((f) => [f.key, useId()])) as Record<Field, string>
const values = reactive<Record<Field, string>>({ name: '', email: '', phone: '' })
const errors = reactive<Partial<Record<Field, string>>>({})
const publicProfile = ref(props.profile.publicProfile)
const publicName = ref(props.profile.publicName ?? '')

const revealing = ref(false)
const revealed = ref(false)
const saving = ref(false)
const message = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

async function reveal() {
  revealing.value = true
  message.value = null
  try {
    const data = await participantService.getPersonalData(props.folio)
    values.name = data.name ?? ''
    values.email = data.email ?? ''
    values.phone = data.phone ?? ''
    revealed.value = true
  } catch (e) {
    console.error(e)
    message.value = { kind: 'error', text: 'No pudimos mostrar tus datos.' }
  } finally {
    revealing.value = false
  }
}

function validate() {
  errors.email = values.email.trim() && !EMAIL.test(values.email.trim()) ? 'Correo no válido.' : undefined
  errors.phone = values.phone.trim() && !PHONE.test(values.phone.trim()) ? 'Teléfono no válido.' : undefined
  return !errors.email && !errors.phone
}

async function send(changes: ProfileChanges, ok: string) {
  saving.value = true
  message.value = null
  try {
    emit('updated', await participantService.updateProfile(props.folio, changes))
    message.value = { kind: 'ok', text: ok }
  } catch (e) {
    console.error(e)
    message.value = { kind: 'error', text: (e as Partial<ApiError>).message ?? 'No se pudo guardar.' }
  } finally {
    saving.value = false
  }
}

// Solo se mandan los campos escritos (vacío = no cambiar); para borrar está "Borrar"
async function save() {
  if (!validate()) return
  const changes: ProfileChanges = {}
  for (const f of FIELDS) if (values[f.key].trim()) changes[f.api] = values[f.key].trim()
  if (publicProfile.value !== props.profile.publicProfile) changes.perfil_publico = publicProfile.value
  if (publicName.value.trim() !== (props.profile.publicName ?? '')) changes.nombre_publico = publicName.value.trim() || null
  if (!Object.keys(changes).length) {
    message.value = { kind: 'ok', text: 'No hay cambios que guardar.' }
    return
  }
  await send(changes, 'Guardamos tus datos.')
}

async function clear(f: (typeof FIELDS)[number]) {
  values[f.key] = ''
  await send({ [f.api]: null }, `Borramos tu ${f.label.toLowerCase()}.`)
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <div class="space-y-1">
      <h2 class="text-lg font-semibold">Mi perfil</h2>
      <p class="text-sm text-fg/60">
        Son opcionales y se guardan cifrados. Sirven para que el equipo pueda ayudarte a recuperar tu folio.
      </p>
    </div>

    <ul class="flex flex-wrap gap-2 text-xs">
      <li v-for="f in FIELDS" :key="f.key" class="rounded-full border border-fg/20 px-2.5 py-1">
        {{ f.label }}: <span class="font-semibold">{{ profile[f.has] ? 'guardado' : 'no' }}</span>
      </li>
    </ul>

    <div v-if="!revealed" class="flex flex-wrap items-center gap-3 rounded-xl bg-fg/5 px-4 py-3 text-sm">
      <span class="text-fg/70">Por seguridad tus datos no se muestran. Si los ves, la consulta queda registrada.</span>
      <button type="button" class="font-semibold text-accent-ink hover:underline disabled:opacity-50" :disabled="revealing" @click="reveal">
        {{ revealing ? 'Cargando…' : 'Ver mis datos' }}
      </button>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <div v-for="f in FIELDS" :key="f.key" class="space-y-1.5">
        <div class="flex items-baseline justify-between gap-2">
          <label :for="ids[f.key]" class="text-sm font-semibold">{{ f.label }}</label>
          <button
            v-if="profile[f.has]"
            type="button"
            class="text-xs text-fg/60 hover:text-fg hover:underline disabled:opacity-50"
            :disabled="saving"
            @click="clear(f)"
          >
            Borrar
          </button>
        </div>
        <input
          :id="ids[f.key]"
          v-model="values[f.key]"
          :type="f.type"
          class="field-input text-sm"
          :autocomplete="f.autocomplete"
          :placeholder="profile[f.has] && !revealed ? 'Guardado · escribe para cambiarlo' : ''"
          :aria-invalid="!!errors[f.key]"
        />
        <p v-if="errors[f.key]" class="text-xs text-danger">{{ errors[f.key] }}</p>
      </div>
    </div>

    <div class="border-2 border-ink bg-card shadow-brut space-y-3 rounded-xl p-4">
      <label class="flex cursor-pointer items-start gap-3 text-sm">
        <input v-model="publicProfile" type="checkbox" class="mt-0.5 size-5 accent-neon-lime" />
        <span>
          <span class="font-semibold">Perfil público</span>
          <span class="block text-xs text-fg/60">Aparecer en la lista de colaboradores con el nombre que elijas.</span>
        </span>
      </label>
      <input
        v-if="publicProfile"
        v-model="publicName"
        type="text"
        maxlength="150"
        class="field-input text-sm"
        placeholder="Nombre a mostrar"
        aria-label="Nombre a mostrar en tu perfil público"
      />
    </div>

    <div class="flex flex-wrap items-center justify-end gap-3">
      <p v-if="message" role="status" class="mr-auto text-sm" :class="message.kind === 'error' ? 'text-danger' : 'text-fg/60'">
        {{ message.text }}
      </p>
      <button
        type="submit"
        class="btn-hxnf btn-ink btn-sm"
        :disabled="saving"
      >
        {{ saving ? 'Guardando…' : 'Guardar' }}
      </button>
    </div>
  </form>
</template>
