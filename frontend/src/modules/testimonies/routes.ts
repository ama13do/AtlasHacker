import type { RouteRecordRaw } from 'vue-router'

export const testimoniesRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@testimonies/views/HomePage.vue'),
    // El formulario vive dentro del inicio: en escritorio ocupa la barra lateral (el mapa sigue a la vista)
    children: [
      {
        path: 'testimonios/nuevo',
        name: 'testimony-new',
        component: () => import('@testimonies/views/CreateTestimonyPage.vue'),
        props: { variant: 'panel' },
      },
    ],
  },
  {
    path: '/mi-folio',
    name: 'my-folio',
    component: () => import('@testimonies/views/MyFolioPage.vue'),
  },
  {
    path: '/mi-folio/testimonios/:id/editar',
    name: 'my-testimony-edit',
    component: () => import('@testimonies/views/EditTestimonyPage.vue'),
    props: true,
  },
]
