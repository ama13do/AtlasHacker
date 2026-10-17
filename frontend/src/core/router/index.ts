import { createRouter, createWebHistory } from 'vue-router'
import { adminGuard, adminRoutes } from '@/modules/admin'
import { legalRoutes } from '@/modules/legal/routes'
import { testimoniesRoutes } from '@/modules/testimonies'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...testimoniesRoutes,
    ...adminRoutes,
    ...legalRoutes,
    // A la portada (con ruta y no por nombre: el nombre arrastraba el parámetro pathMatch)
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  // Anclas (#seccion) con margen para el encabezado fijo; al cambiar de página, arriba; atrás/adelante, donde estabas
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    if (to.hash) return { el: to.hash, top: 96, behavior: 'smooth' }
    if (to.path !== from.path) return { top: 0 }
    return false
  },
})

// Dashboard: sesión y roles
router.beforeEach(adminGuard)

export default router
