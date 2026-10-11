import type { RouteRecordRaw } from 'vue-router'

export const mapRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'map',
    component: () => import('./views/MapPage.vue'),
  },
]
