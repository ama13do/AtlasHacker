import { watch } from 'vue'
import type { Router } from 'vue-router'
import { useConsent } from '@/core/consent/consent'

// Google Tag Manager con Modo de consentimiento v2. Nada se descarga ni se envía hasta que la persona acepta
// la analítica en el aviso de cookies; si después la retira, se deniega el almacenamiento y se borran las
// cookies _ga. El contenedor solo debe tener etiquetas de analítica (GA4): el aviso no pide permiso para
// publicidad. En producción usa el contenedor de HxNF; VITE_GTM_ID lo cambia. En local no carga nada.
// Las páginas vistas las cuenta GA4 dentro del contenedor (medición mejorada: cambios de página del historial,
// clics a sitios externos, desplazamiento). Aquí se suman los eventos propios con `track`, que llegan al
// contenedor como eventos personalizados del dataLayer.
// Privacidad: nunca se envían datos personales (nombre, correo, teléfono, folio ni texto de los testimonios):
// solo páginas, clics y el id público del testimonio. En el panel del equipo (/admin) no se envían eventos.
// El fragmento <noscript> de GTM no se usa: cargaría Google sin consentimiento y GA4 no mide sin JavaScript.

const GTM_ID = (import.meta.env.VITE_GTM_ID as string | undefined) ?? (import.meta.env.PROD ? 'GTM-MZX7S53T' : undefined)

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let loaded = false
let currentPath = typeof window !== 'undefined' ? window.location.pathname : '/'
const isStaffArea = (path: string) => path.startsWith('/admin')

function dataLayer() {
  window.dataLayer = window.dataLayer ?? []
  return window.dataLayer
}

// Los comandos de consentimiento van como gtag(): el dataLayer espera el objeto `arguments`, no un arreglo
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  dataLayer().push(arguments)
}

function load() {
  if (loaded || !GTM_ID) return
  loaded = true
  window.gtag = gtag
  // El consentimiento va antes que el contenedor para que sus etiquetas lo lean desde la primera
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  })
  dataLayer().push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`
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
  if (!GTM_ID) return
  const { analytics } = useConsent()
  router.afterEach((to) => (currentPath = to.path))
  watch(
    analytics,
    (granted) => {
      if (granted) {
        // Quien entra directo al panel no carga el contenedor
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

// Evento de clic o acción. Nombres en snake_case; parámetros cortos y sin datos personales.
// En GTM: activador «Evento personalizado» y etiqueta de evento de GA4 que lea los parámetros del dataLayer
export function track(event: string, params: Record<string, string | number | boolean | undefined> = {}) {
  if (!loaded || isStaffArea(currentPath)) return
  dataLayer().push({ event, ...params })
}
