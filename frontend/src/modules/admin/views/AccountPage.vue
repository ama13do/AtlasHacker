<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useRouter } from 'vue-router'
import type { ApiError } from '@/core/http/client'
import { useAuthStore } from '@admin/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const ids = { current: useId(), next: useId(), confirm: useId(), rules: useId() }
const current = ref('')
const next = ref('')
const confirm = ref('')
const sending = ref(false)
const error = ref<string | null>(null)

// Misma regla que la API: 12+ caracteres con mayúsculas, minúsculas y números
const rules = computed(() => [
  { ok: next.value.length >= 12, label: 'Al menos 12 caracteres' },
  { ok: /[A-ZÁÉÍÓÚÑ]/.test(next.value), label: 'Una mayúscula' },
  { ok: /[a-záéíóúñ]/.test(next.value), label: 'Una minúscula' },
  { ok: /\d/.test(next.value), label: 'Un número' },
])
const valid = computed(() => rules.value.every((r) => r.ok) && next.value === confirm.value && !!current.value)
const mandatory = computed(() => !!auth.user?.debe_cambiar_password)

async function submit() {
  if (!valid.value) return
  sending.value = true
  error.value = null
  try {
    await auth.changePassword(current.value, next.value)
    // La API cerró todas las sesiones: se vuelve a entrar con la nueva
    await router.replace({ name: 'admin-login', query: { cambio: '1' } })
    auth.endSession()
  } catch (e) {
    const err = e as Partial<ApiError>
    error.value =
      err.status === 401 || err.status === 400
        ? (err.message ?? 'La contraseña actual no es correcta.')
        : 'No pudimos cambiar la contraseña. Intenta de nuevo.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="max-w-md space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Mi cuenta</h1>
      <p v-if="auth.user" class="text-sm text-fg/60">{{ auth.user.email }}</p>
    </div>

    <p v-if="mandatory" class="rounded-xl bg-neon-lime/15 px-4 py-3 text-sm light:bg-neon-lime/40" role="status">
      Tu contraseña es temporal. Cámbiala para continuar.
    </p>

    <form class="space-y-4 rounded-2xl border border-fg/15 p-5" @submit.prevent="submit">
      <h2 class="font-semibold">Cambiar contraseña</h2>
      <div class="space-y-1.5">
        <label :for="ids.current" class="text-sm font-semibold">Contraseña actual</label>
        <input :id="ids.current" v-model="current" type="password" class="field-input" autocomplete="current-password" required />
      </div>
      <div class="space-y-1.5">
        <label :for="ids.next" class="text-sm font-semibold">Nueva contraseña</label>
        <input
          :id="ids.next"
          v-model="next"
          type="password"
          class="field-input"
          autocomplete="new-password"
          :aria-describedby="ids.rules"
          required
        />
        <ul :id="ids.rules" class="grid grid-cols-2 gap-1 text-xs">
          <li v-for="r in rules" :key="r.label" class="flex items-center gap-1.5" :class="r.ok ? 'text-fg' : 'text-fg/50'">
            <span aria-hidden="true">{{ r.ok ? '✓' : '·' }}</span>
            {{ r.label }}<span class="sr-only">{{ r.ok ? ' (cumple)' : ' (pendiente)' }}</span>
          </li>
        </ul>
      </div>
      <div class="space-y-1.5">
        <label :for="ids.confirm" class="text-sm font-semibold">Repite la nueva contraseña</label>
        <input :id="ids.confirm" v-model="confirm" type="password" class="field-input" autocomplete="new-password" required />
        <p v-if="confirm && confirm !== next" class="text-xs text-danger">No coincide.</p>
      </div>

      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <p class="text-xs text-fg/50">Al cambiarla se cerrarán todas tus sesiones y tendrás que volver a entrar.</p>

      <button
        type="submit"
        class="w-full rounded-full bg-fg py-2.5 font-semibold text-surface transition hover:bg-neon-lime hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50 disabled:hover:bg-fg disabled:hover:text-surface"
        :disabled="!valid || sending"
      >
        {{ sending ? 'Guardando…' : 'Cambiar contraseña' }}
      </button>
    </form>
  </div>
</template>
