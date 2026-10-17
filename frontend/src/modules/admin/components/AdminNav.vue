<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@admin/stores/auth'
import type { Rol } from '@admin/types/api'

defineEmits<{ navigate: [] }>()

interface NavItem {
  label: string
  to?: RouteLocationRaw // Sin destino = llega en una etapa siguiente
  roles: Rol[]
  icon: string // path SVG
  exact?: boolean // Solo activo en esa ruta exacta (la raíz /admin)
}

// Mismos roles que las rutas (el superadmin ve todo)
const ITEMS: NavItem[] = [
  { label: 'Resumen', to: { name: 'admin-home' }, exact: true, roles: ['admin', 'lector'], icon: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 9h8V3h-8z' },
  { label: 'Testimonios', to: { name: 'admin-testimonies' }, roles: ['admin', 'moderador', 'lector'], icon: 'M4 4h16v12H5.17L4 17.17zM8 8h8M8 12h5' },
  { label: 'Capturar ficha', to: { name: 'admin-capture' }, roles: ['admin', 'moderador', 'facilitador'], icon: 'M12 5v14M5 12h14' },
  { label: 'Comentarios', to: { name: 'admin-comments' }, roles: ['admin', 'moderador', 'lector'], icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { label: 'Personas', to: { name: 'admin-people' }, roles: ['admin'], icon: 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { label: 'Usuarios', to: { name: 'admin-users' }, roles: ['admin'], icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { label: 'Catálogos', to: { name: 'admin-catalogs' }, roles: ['admin'], icon: 'M4 6h16M4 12h16M4 18h10' },
  { label: 'Configuración', to: { name: 'admin-settings' }, roles: ['admin'], icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 7 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V4a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9H20a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
  { label: 'Bitácora', to: { name: 'admin-log' }, roles: ['superadmin'], icon: 'M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
]

const ACTIVE = '!border-ink bg-neon-lime !text-black shadow-brut-sm -translate-y-px'

const auth = useAuthStore()
const items = computed(() => ITEMS.filter((i) => auth.can(...i.roles)))
</script>

<template>
  <nav aria-label="Secciones del panel">
    <ul class="space-y-1">
      <li v-for="item in items" :key="item.label">
        <RouterLink
          v-if="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-full border-2 border-transparent px-3 py-1.5 text-sm font-bold text-fg/75 transition hover:border-ink/40 hover:text-fg focus-visible:outline-3 focus-visible:outline-brand-blue"
          :active-class="item.exact ? '' : ACTIVE"
          :exact-active-class="ACTIVE"
          @click="$emit('navigate')"
        >
          <svg viewBox="0 0 24 24" class="size-4.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="item.icon" />
          </svg>
          {{ item.label }}
        </RouterLink>
        <span
          v-else
          class="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm text-fg/35"
          aria-disabled="true"
        >
          <svg viewBox="0 0 24 24" class="size-4.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="item.icon" />
          </svg>
          {{ item.label }}
          <span class="ml-auto rounded-full border border-fg/15 px-1.5 text-[10px] tracking-wide uppercase">Pronto</span>
        </span>
      </li>
    </ul>
  </nav>
</template>
