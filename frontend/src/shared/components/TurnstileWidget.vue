<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from '@/core/theme/useTheme'

// Captcha de Cloudflare Turnstile. Emite el token (de un solo uso) que va en la cabecera X-Captcha-Token
const props = defineProps<{ siteKey: string }>()
const emit = defineEmits<{ token: [token: string]; expired: []; error: [code: string] }>()

interface Turnstile {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise: Promise<Turnstile> | null = null

// El script se carga una sola vez por página
function loadScript(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')))
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('turnstile'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

const { theme } = useTheme()
const container = ref<HTMLElement | null>(null)
let widgetId: string | null = null
let api: Turnstile | null = null

function render() {
  if (!api || !container.value) return
  if (widgetId) api.remove(widgetId)
  widgetId = api.render(container.value, {
    sitekey: props.siteKey,
    theme: theme.value,
    language: 'es',
    callback: (token: string) => emit('token', token),
    'expired-callback': () => emit('expired'),
    'error-callback': (code: string) => {
      emit('error', String(code))
      return true // Evita el reintento automático en bucle; el padre decide
    },
  })
}

onMounted(async () => {
  try {
    api = await loadScript()
    render()
  } catch {
    emit('error', 'script')
  }
})

// El widget no cambia de tema en caliente: se vuelve a dibujar
watch(theme, () => {
  render()
  emit('expired')
})

onBeforeUnmount(() => {
  if (api && widgetId) api.remove(widgetId)
})

defineExpose({
  reset: () => {
    if (api && widgetId) api.reset(widgetId)
  },
})
</script>

<template>
  <div ref="container" class="min-h-[65px]" />
</template>
