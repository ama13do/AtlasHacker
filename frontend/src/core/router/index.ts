import { createRouter, createWebHistory } from 'vue-router'
import { mapRoutes } from '@/modules/map'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...mapRoutes,
    { path: '/:pathMatch(.*)*', redirect: { name: 'map' } },
  ],
})

export default router
