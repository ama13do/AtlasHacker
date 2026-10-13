import { createRouter, createWebHistory } from 'vue-router'
import { adminGuard, adminRoutes } from '@/modules/admin'
import { testimoniesRoutes } from '@/modules/testimonies'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...testimoniesRoutes,
    ...adminRoutes,
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
})

// Dashboard: sesión y roles
router.beforeEach(adminGuard)

export default router
