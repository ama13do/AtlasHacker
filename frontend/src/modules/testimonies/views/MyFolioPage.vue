<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ApiError } from '@/core/http/client'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import { participantService } from '@testimonies/services/participant.service'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { LoadStatus } from '@testimonies/stores/testimonies'
import type { MyTestimony, ParticipantProfile } from '@testimonies/types/testimony'
import { maskFolio } from '@testimonies/utils/folio'
import FolioSignIn from '@testimonies/components/folio/FolioSignIn.vue'
import MyTestimonyCard from '@testimonies/components/folio/MyTestimonyCard.vue'
import ProfileForm from '@testimonies/components/folio/ProfileForm.vue'

const { active: folio, remembered, signOut } = useParticipantFolio()
const categories = useCategoriesStore()

const profile = ref<ParticipantProfile | null>(null)
const testimonies = ref<MyTestimony[]>([])
const status = ref<LoadStatus>('idle')
const errorMessage = ref<string | null>(null)

const canEdit = computed(() => categories.config?.canEdit ?? true)
const canWithdraw = computed(() => categories.config?.canWithdraw ?? true)

async function load() {
  if (!folio.value) return
  status.value = 'loading'
  errorMessage.value = null
  try {
    const [p, list] = await Promise.all([
      participantService.getProfile(folio.value),
      participantService.listMine(folio.value),
      categories.load(),
    ])
    profile.value = p
    testimonies.value = list
    status.value = 'ready'
  } catch (e) {
    console.error(e)
    status.value = 'error'
    errorMessage.value =
      (e as Partial<ApiError>).status === 401 ? 'Tu folio ya no es válido.' : 'No pudimos cargar tu información.'
  }
}

// Al entrar o salir se (re)carga
watch(folio, (value) => (value ? load() : (status.value = 'idle')), { immediate: true })

function exit() {
  profile.value = null
  testimonies.value = []
  signOut(true)
}

function onWithdrawn(id: string) {
  const t = testimonies.value.find((x) => x.id === id)
  if (t) Object.assign(t, { active: false, public: false })
}
</script>

<template>
  <main class="min-h-dvh bg-surface">
    <header class="sticky top-0 z-10 border-b border-fg/10 bg-surface/95 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 md:py-4">
        <RouterLink
          :to="{ name: 'home' }"
          class="inline-flex items-center gap-1.5 rounded-full py-1 pr-3 text-sm text-fg/70 hover:text-fg focus-visible:outline-2 focus-visible:outline-fg"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Mapa
        </RouterLink>
        <h1 class="text-lg font-semibold">Mi folio</h1>
        <ThemeToggle />
      </div>
    </header>

    <div class="mx-auto max-w-3xl space-y-8 px-4 py-6 md:py-10">
      <FolioSignIn v-if="!folio" />

      <template v-else>
        <!-- Resumen -->
        <section class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-fg/5 px-4 py-3">
          <div>
            <p class="font-mono text-sm font-semibold">{{ maskFolio(folio) }}</p>
            <p v-if="profile" class="text-xs text-fg/60">
              {{ profile.testimonies }} {{ profile.testimonies === 1 ? 'testimonio' : 'testimonios' }} ·
              {{ profile.published }} {{ profile.published === 1 ? 'publicado' : 'publicados' }}
            </p>
          </div>
          <button type="button" class="text-sm font-semibold text-fg/70 hover:text-fg hover:underline" @click="exit">
            Salir{{ remembered ? ' y olvidar en este dispositivo' : '' }}
          </button>
        </section>

        <p v-if="status === 'loading'" class="text-sm text-fg/60" role="status">Cargando…</p>

        <div v-else-if="status === 'error'" class="space-y-3 rounded-2xl border border-fg/15 p-4 text-sm" role="alert">
          <p class="font-semibold">{{ errorMessage }}</p>
          <div class="flex gap-3">
            <button type="button" class="font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
            <button type="button" class="text-fg/60 hover:underline" @click="exit">Usar otro folio</button>
          </div>
        </div>

        <template v-else-if="status === 'ready'">
          <section class="space-y-4" aria-labelledby="mine-title">
            <div class="flex items-baseline justify-between gap-3">
              <h2 id="mine-title" class="text-lg font-semibold">Mis testimonios</h2>
              <RouterLink :to="{ name: 'testimony-new' }" class="text-sm font-semibold text-accent-ink hover:underline">
                + Subir otro
              </RouterLink>
            </div>
            <p v-if="!testimonies.length" class="rounded-2xl border border-dashed border-fg/20 p-6 text-center text-sm text-fg/60">
              Aún no has subido testimonios con este folio.
            </p>
            <MyTestimonyCard
              v-for="t in testimonies"
              :key="t.id"
              :testimony="t"
              :folio="folio"
              :can-edit="canEdit"
              :can-withdraw="canWithdraw"
              @withdrawn="onWithdrawn"
            />
          </section>

          <section v-if="profile" class="rounded-2xl border border-fg/15 p-4 md:p-6">
            <ProfileForm :folio="folio" :profile="profile" @updated="profile = $event" />
          </section>
        </template>
      </template>
    </div>
  </main>
</template>
