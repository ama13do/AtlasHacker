import type { RouteRecordRaw } from 'vue-router'
import { DEFAULT_MAP_SLUG } from '@testimonies/data/maps'

export const testimoniesRoutes: RouteRecordRaw[] = [
  {
    // Portada: cuadrícula con los mapas (uno por expediente)
    path: '/',
    name: 'home',
    component: () => import('@testimonies/views/MapsPage.vue'),
  },
  {
    path: '/mapas/:mapa',
    name: 'map',
    component: () => import('@testimonies/views/MapPage.vue'),
    // El formulario vive dentro del mapa: un panel a un lado (el mapa sigue a la vista para marcar el lugar)
    children: [
      {
        path: 'testimonios/nuevo',
        name: 'testimony-new',
        component: () => import('@testimonies/views/CreateTestimonyPage.vue'),
        props: { variant: 'panel' },
      },
    ],
  },
  // Enlaces anteriores (antes el mapa era la portada)
  { path: '/testimonios/nuevo', redirect: { name: 'testimony-new', params: { mapa: DEFAULT_MAP_SLUG } } },
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
