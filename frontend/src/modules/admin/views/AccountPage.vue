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
const done = ref(false)

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
  const wasMandatory = mandatory.value
  try {
    // La API cierra todas las sesiones; el store vuelve a entrar con la nueva
    const renewed = await auth.changePasswordAndRelogin(current.value, next.value)
    current.value = next.value = confirm.value = ''
    if (renewed) {
      done.value = true
      // Primera vez: ya puede usar el panel
      if (wasMandatory) await router.replace({ name: 'admin-home' })
    } else {
      // Cambio hecho, pero no se pudo renovar la sesión: entrar a mano
      await router.replace({ name: 'admin-login', query: { cambio: '1' } })
      auth.endSession()
    }
  } catch (e) {
    const err = e as Partial<ApiError>
    error.value =
      err.status === 401
        ? 'La contraseña actual no es correcta.'
        : err.status === 400
          ? (err.message ?? 'La nueva contraseña no cumple las reglas.')
          : err.status === 429 || err.status === 423
            ? 'Demasiados intentos. Espera unos minutos antes de volver a intentar.'
            : 'No pudimos cambiar la contraseña. Intenta de nuevo.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="max-w-md space-y-6" :class="{ 'mx-auto md:pt-6': mandatory }">
    <div>
      <h1 class="text-3xl font-black uppercase"><span class="hl-box hl-green" style="--hl-rot: -1deg">{{ mandatory ? 'Crea tu contraseña' : 'Mi cuenta' }}</span></h1>
      <p v-if="auth.user" class="text-sm text-fg/60">{{ auth.user.email }}</p>
    </div>

    <p v-if="mandatory" class="rounded-xl bg-neon-lime/15 px-4 py-3 text-sm light:bg-neon-lime/40" role="status">
      Entraste con una contraseña temporal. Elige una nueva para usar el panel.
    </p>
    <p v-else-if="done" class="rounded-xl bg-neon-green/15 px-4 py-3 text-sm light:bg-neon-green/30" role="status">
      Contraseña actualizada. Se cerraron tus otras sesiones.
    </p>

    <form class="border-2 border-ink bg-card shadow-brut space-y-4 rounded-[22px] p-5" @submit.prevent="submit">
      <h2 v-if="!mandatory" class="font-semibold">Cambiar contraseña</h2>
      <div class="space-y-1.5">
        <label :for="ids.current" class="text-sm font-semibold">{{ mandatory ? 'Contraseña temporal' : 'Contraseña actual' }}</label>
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
      <p class="text-xs text-fg/50">Al cambiarla se cierran tus sesiones en otros dispositivos.</p>

      <button
        type="submit"
        class="btn-hxnf btn-ink w-full"
        :disabled="!valid || sending"
      >
        {{ sending ? 'Guardando…' : mandatory ? 'Guardar y entrar al panel' : 'Cambiar contraseña' }}
      </button>
    </form>
  </div>
</template>
