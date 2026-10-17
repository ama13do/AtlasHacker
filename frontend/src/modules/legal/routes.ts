import type { RouteRecordRaw } from 'vue-router'
import { LEGAL_ROUTES } from '@/core/legal/legal'

// Documentos legales: aviso de privacidad, términos y condiciones y política de cookies
export const legalRoutes: RouteRecordRaw[] = [
  { path: '/privacidad', name: LEGAL_ROUTES.privacy.name, component: () => import('./views/PrivacyPage.vue') },
  { path: '/terminos', name: LEGAL_ROUTES.terms.name, component: () => import('./views/TermsPage.vue') },
  { path: '/cookies', name: LEGAL_ROUTES.cookies.name, component: () => import('./views/CookiesPage.vue') },
  // Alias comunes
  { path: '/aviso-de-privacidad', redirect: '/privacidad' },
  { path: '/terminos-y-condiciones', redirect: '/terminos' },
]
