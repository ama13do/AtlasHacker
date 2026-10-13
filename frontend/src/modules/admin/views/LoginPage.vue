<script setup lang="ts">
import { ref, useId } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ApiError } from '@/core/http/client'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'
import { useAuthStore } from '@admin/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const ids = { email: useId(), password: useId(), error: useId() }
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const sending = ref(false)
const error = ref<string | null>(null)

// Solo rutas internas del dashboard como destino tras entrar
function nextRoute() {
  const next = route.query.next
  return typeof next === 'string' && next.startsWith('/admin') ? next : { name: 'admin-home' }
}

async function submit() {
  sending.value = true
  error.value = null
  try {
    await auth.login(email.value.trim(), password.value)
    password.value = ''
    router.replace(nextRoute())
  } catch (e) {
    const err = e as Partial<ApiError>
    error.value =
      err.status === 401 || err.status === 400
        ? 'Correo o contraseña incorrectos.'
        : err.status === 429 || err.status === 423
          ? 'Demasiados intentos. Espera unos minutos antes de volver a intentar.'
          : err.status === 403
            ? 'Este sitio no está autorizado para iniciar sesión en la API (origen no permitido). Pide al equipo del back que lo agregue.'
            : err.status === null
              ? 'No hay conexión con el servidor.'
              : (err.message ?? 'No pudimos iniciar sesión.')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <main class="grid min-h-dvh place-items-center bg-surface px-4 py-10">
    <div class="absolute top-4 right-4"><ThemeToggle /></div>

    <form class="w-full max-w-sm space-y-6" @submit.prevent="submit">
      <div class="space-y-1 text-center">
        <p class="text-2xl font-semibold tracking-tight">AtlasHacker<span class="text-neon-green light:text-fg">_</span></p>
        <h1 class="text-sm text-fg/60">Panel del equipo · Tribunal Popular FUTURO/001</h1>
      </div>

      <p v-if="route.query.cambio" class="rounded-xl bg-neon-green/15 px-4 py-3 text-sm light:bg-neon-green/30" role="status">
        Tu contraseña se actualizó. Entra con la nueva.
      </p>
      <p v-else-if="auth.expired" class="rounded-xl bg-fg/5 px-4 py-3 text-sm" role="status">
        Tu sesión expiró. Vuelve a entrar.
      </p>

      <div class="space-y-4">
        <div class="space-y-1.5">
          <label :for="ids.email" class="text-sm font-semibold">Correo</label>
          <input
            :id="ids.email"
            v-model="email"
            type="email"
            class="field-input"
            autocomplete="username"
            required
            :aria-invalid="!!error"
            :aria-describedby="error ? ids.error : undefined"
          />
        </div>
        <div class="space-y-1.5">
          <label :for="ids.password" class="text-sm font-semibold">Contraseña</label>
          <div class="relative">
            <input
              :id="ids.password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="field-input pr-12"
              autocomplete="current-password"
              required
              :aria-invalid="!!error"
              :aria-describedby="error ? ids.error : undefined"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 grid w-11 place-items-center text-fg/60 hover:text-fg focus-visible:outline-2 focus-visible:outline-fg"
              :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                <path v-if="showPassword" d="M3 3l18 18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <p v-if="error" :id="ids.error" role="alert" class="text-sm text-danger">{{ error }}</p>

      <button
        type="submit"
        class="w-full rounded-full bg-neon-lime py-3 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-60"
        :disabled="sending || !email.trim() || !password"
      >
        {{ sending ? 'Entrando…' : 'Entrar' }}
      </button>

      <p class="text-center text-xs text-fg/50">
        <RouterLink :to="{ name: 'home' }" class="hover:underline">Volver al mapa público</RouterLink>
      </p>
    </form>
  </main>
</template>
