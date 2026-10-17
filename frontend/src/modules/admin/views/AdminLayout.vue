<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'
import { useAuthStore } from '@admin/stores/auth'
import AdminNav from '@admin/components/AdminNav.vue'
import BrandMark from '@/shared/components/BrandMark.vue'
import { ROLE_LABELS } from '@admin/data/labels'


const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const drawerOpen = ref(false)
// Contraseña temporal: solo se muestra «Crea tu contraseña», sin navegación (el guard no deja ir a otra vista)
const mustChange = computed(() => !!auth.user?.debe_cambiar_password)

// La sesión se perdió (refresh rechazado o logout): de vuelta al login
watch(
  () => auth.status,
  (status) => {
    if (status === 'anonymous') router.replace({ name: 'admin-login', query: { next: route.fullPath } })
  },
)

watch(() => route.fullPath, () => (drawerOpen.value = false))

async function logout() {
  await auth.logout()
}
</script>

<template>
  <div class="min-h-dvh" :class="{ 'md:grid md:grid-cols-[15rem_1fr]': !mustChange }">
    <!-- Lateral (escritorio) / cajón (móvil) -->
    <aside
      v-if="!mustChange"
      class="fixed inset-y-0 left-0 z-30 flex w-64 -translate-x-full flex-col gap-6 border-r-2 border-ink bg-surface p-4 transition-transform md:sticky md:top-0 md:h-dvh md:w-auto md:translate-x-0"
      :class="{ 'translate-x-0': drawerOpen }"
      aria-label="Navegación del panel"
    >
      <div class="px-1 pt-1">
        <BrandMark size="sm" label="Panel" />
      </div>
      <AdminNav @navigate="drawerOpen = false" />
      <div class="mt-auto space-y-1 px-2 text-sm">
        <RouterLink :to="{ name: 'home' }" class="block py-1 font-semibold text-fg/70 hover:text-fg hover:underline">Ver mapas públicos ↗</RouterLink>
      </div>
    </aside>
    <div v-if="drawerOpen" class="fixed inset-0 z-20 bg-black/50 md:hidden" aria-hidden="true" @click="drawerOpen = false" />

    <div class="flex min-w-0 flex-col">
      <header class="sticky top-0 z-10 flex items-center gap-3 border-b-2 border-ink bg-surface/95 px-4 py-3 backdrop-blur md:px-8">
        <BrandMark v-if="mustChange" size="sm" label="Panel" />
        <button
          v-else
          type="button"
          class="icon-btn md:hidden"
          aria-label="Abrir navegación"
          :aria-expanded="drawerOpen"
          @click="drawerOpen = true"
        >
          <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div v-if="auth.user" class="ml-auto min-w-0 text-right">
          <p class="truncate text-sm font-semibold">{{ auth.user.nombre ?? auth.user.email }}</p>
          <p class="text-xs text-fg/50">{{ ROLE_LABELS[auth.user.rol] }}</p>
        </div>
        <RouterLink
          v-if="!mustChange"
          :to="{ name: 'admin-account' }"
          class="btn-hxnf btn-paper btn-sm whitespace-nowrap"
        >
          Mi cuenta
        </RouterLink>
        <button
          type="button"
          class="btn-hxnf btn-ink btn-sm"
          @click="logout"
        >
          Salir
        </button>
        <ThemeToggle />
      </header>

      <main class="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
