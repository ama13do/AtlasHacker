import { watch } from 'vue'
import type { Router } from 'vue-router'
import { useConsent } from '@/core/consent/consent'

// Google Analytics 4 con Modo de consentimiento v2. Nada se descarga ni se envía hasta que la persona acepta
// la analítica en el aviso de cookies; si después la retira, se deniega el almacenamiento y se borran las
// cookies _ga. Sin VITE_GA_ID (p. ej. en local) no hace nada.
// Las páginas vistas las cuenta GA4 solo (medición mejorada: cambios de página del historial, clics a sitios
// externos, desplazamiento). Aquí se suman los eventos propios con `track`.
// Privacidad: nunca se envían datos personales (nombre, correo, teléfono, folio ni texto de los testimonios):
// solo páginas, clics y el id público del testimonio. En el panel del equipo (/admin) no se envían eventos.

const GA_ID = import.meta.env.VITE_GA_ID as string | undefined

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let loaded = false
let currentPath = typeof window !== 'undefined' ? window.location.pathname : '/'
const isStaffArea = (path: string) => path.startsWith('/admin')

// gtag.js espera el objeto `arguments` en dataLayer, no un arreglo
function gtag(..._args: unknown[]) {
  window.dataLayer = window.dataLayer ?? []
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments)
}

function load() {
  if (loaded || !GA_ID) return
  loaded = true
  window.gtag = gtag
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  })
  gtag('js', new Date())
  gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  document.head.appendChild(script)
}

// Borra las cookies de Analytics (_ga, _ga_XXXX) del dominio actual y de su dominio padre
function clearGaCookies() {
  const host = window.location.hostname
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim()
    if (!name?.startsWith('_ga')) continue
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`
  }
}

export function setupAnalytics(router: Router) {
  if (!GA_ID) return
  const { analytics } = useConsent()
  router.afterEach((to) => (currentPath = to.path))
  watch(
    analytics,
    (granted) => {
      if (granted) {
        // Quien entra directo al panel no carga Analytics
        if (!loaded && isStaffArea(currentPath)) return
        if (loaded) gtag('consent', 'update', { analytics_storage: 'granted' })
        else load()
      } else if (loaded) {
        gtag('consent', 'update', { analytics_storage: 'denied' })
        clearGaCookies()
      }
    },
    { immediate: true },
  )
}

// Evento de clic o acción. Nombres en snake_case; parámetros cortos y sin datos personales
export function track(event: string, params: Record<string, string | number | boolean | undefined> = {}) {
  if (!loaded || isStaffArea(currentPath)) return
  gtag('event', event, params)
}
