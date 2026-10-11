import type { RouteRecordRaw } from 'vue-router'

export const testimoniesRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@testimonies/views/HomePage.vue'),
  },
]
