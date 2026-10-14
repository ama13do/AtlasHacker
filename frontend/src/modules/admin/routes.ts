import type { NavigationGuard, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@admin/stores/auth'
import type { Rol } from '@admin/types/api'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: Rol[]
  }
}

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@admin/views/LoginPage.vue'),
  },
  {
    path: '/admin',
    component: () => import('@admin/views/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'admin-home',
        component: () => import('@admin/views/DashboardPage.vue'),
        meta: { roles: ['admin', 'moderador', 'lector'] },
      },
      {
        path: 'testimonios',
        name: 'admin-testimonies',
        component: () => import('@admin/views/TestimoniesPage.vue'),
      },
      {
        path: 'testimonios/:id',
        name: 'admin-testimony',
        component: () => import('@admin/views/TestimonyPage.vue'),
        props: true,
      },
      {
        // Ficha en papel (facilitación, moderación y administración)
        path: 'capturar',
        name: 'admin-capture',
        component: () => import('@admin/views/CapturePage.vue'),
        meta: { roles: ['admin', 'moderador', 'facilitador'] },
      },
      {
        path: 'comentarios',
        name: 'admin-comments',
        component: () => import('@admin/views/CommentsPage.vue'),
        meta: { roles: ['admin', 'moderador', 'lector'] },
      },
      {
        // El facilitador solo puede dar de alta personas (emitir folio); la búsqueda es de admin y moderador
        path: 'personas',
        name: 'admin-people',
        component: () => import('@admin/views/PeoplePage.vue'),
        meta: { roles: ['admin', 'moderador', 'facilitador'] },
      },
      {
        path: 'personas/:id',
        name: 'admin-person',
        component: () => import('@admin/views/PersonPage.vue'),
        props: true,
        meta: { roles: ['admin', 'moderador'] },
      },
      {
        path: 'configuracion',
        name: 'admin-settings',
        component: () => import('@admin/views/SettingsPage.vue'),
        meta: { roles: ['admin'] },
      },
      {
        path: 'usuarios',
        name: 'admin-users',
        component: () => import('@admin/views/UsersPage.vue'),
        meta: { roles: ['admin'] },
      },
      {
        path: 'catalogos',
        name: 'admin-catalogs',
        component: () => import('@admin/views/CatalogsPage.vue'),
      },
      {
        path: 'bitacora',
        name: 'admin-log',
        component: () => import('@admin/views/LogPage.vue'),
        meta: { roles: ['admin'] },
      },
      {
        path: 'cuenta',
        name: 'admin-account',
        component: () => import('@admin/views/AccountPage.vue'),
      },
    ],
  },
]

// Sin sesión → login (con regreso). Contraseña temporal → cambiarla primero. Sin rol → Testimonios
export const adminGuard: NavigationGuard = async (to) => {
  if (!to.matched.some((r) => r.meta.requiresAuth)) return true
  const auth = useAuthStore()
  if (!(await auth.restore())) return { name: 'admin-login', query: { next: to.fullPath } }
  if (auth.user?.debe_cambiar_password && to.name !== 'admin-account') return { name: 'admin-account' }
  const roles = to.matched.flatMap((r) => r.meta.roles ?? [])
  // Sin permiso para esta vista: a Testimonios, que cualquier rol puede ver
  if (roles.length && !auth.can(...roles)) return { name: 'admin-testimonies' }
  return true
}
