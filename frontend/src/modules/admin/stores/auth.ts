import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authService } from '@admin/services/auth.service'
import type { ApiSesion, ApiUsuario, Rol } from '@admin/types/api'

// Renovar el access token este tiempo antes de que expire
const REFRESH_MARGIN_MS = 60_000

// Sesión del dashboard. El access token vive SOLO en memoria (nunca en localStorage);
// la continuidad entre recargas la da la cookie httpOnly de refresh
export const useAuthStore = defineStore('admin/auth', () => {
  const token = ref<string | null>(null)
  const user = ref<ApiUsuario | null>(null)
  const status = ref<'unknown' | 'authenticated' | 'anonymous'>('unknown')
  // La sesión se perdió (refresh rechazado): el login muestra "Tu sesión expiró"
  const expired = ref(false)

  const isAuthenticated = computed(() => status.value === 'authenticated')

  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Promise<boolean> | null = null

  function apply(session: ApiSesion) {
    token.value = session.access_token
    user.value = session.usuario
    status.value = 'authenticated'
    expired.value = false
    clearTimeout(timer)
    const delay = Math.max(session.expira_en_segundos * 1000 - REFRESH_MARGIN_MS, 10_000)
    timer = setTimeout(() => refresh(), delay)
  }

  function clear() {
    clearTimeout(timer)
    token.value = null
    user.value = null
    status.value = 'anonymous'
  }

  async function login(email: string, password: string) {
    apply(await authService.login(email, password))
  }

  // Varias llamadas a la vez comparten un solo refresh (cada refresh token se usa una vez)
  function refresh(): Promise<boolean> {
    pending ??= authService
      .refresh()
      .then((session) => {
        apply(session)
        return true
      })
      .catch(() => {
        if (status.value === 'authenticated') expired.value = true
        clear()
        return false
      })
      .finally(() => {
        pending = null
      })
    return pending
  }

  // Al entrar al dashboard: intenta recuperar la sesión con la cookie, sin molestar si no hay
  async function restore() {
    if (status.value !== 'unknown') return isAuthenticated.value
    return refresh()
  }

  async function logout() {
    const current = token.value
    clear()
    expired.value = false
    try {
      await authService.logout(current)
    } catch {
      // La sesión local ya se cerró
    }
  }

  async function changePassword(current: string, next: string) {
    if (!token.value) throw new Error('Sin sesión')
    // La API cierra todas las sesiones: quien llama navega al login y luego llama a endSession()
    await authService.changePassword(token.value, current, next)
  }

  // Cierra la sesión local sin avisar de expiración (p. ej. tras cambiar la contraseña)
  function endSession() {
    clear()
    expired.value = false
  }

  function can(...roles: Rol[]) {
    return !!user.value && roles.includes(user.value.rol)
  }

  return { token, user, status, expired, isAuthenticated, login, refresh, restore, logout, changePassword, endSession, can }
})
