import { createRouter, createWebHistory } from 'vue-router'
import { testimoniesRoutes } from '@/modules/testimonies'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...testimoniesRoutes,
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
})

export default router
