import type { RouteRecordRaw } from 'vue-router'

export const testimoniesRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@testimonies/views/HomePage.vue'),
  },
  {
    path: '/testimonios/nuevo',
    name: 'testimony-new',
    component: () => import('@testimonies/views/CreateTestimonyPage.vue'),
  },
]
