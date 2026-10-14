<script setup lang="ts">
import { DEFAULT_MAP_SLUG } from '@testimonies/data/maps'
import { computed, ref, watch } from 'vue'
import type { ApiError } from '@/core/http/client'
import SiteHeader from '@/shared/components/SiteHeader.vue'
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
  <main class="min-h-dvh">
    <SiteHeader />

    <div class="mx-auto max-w-3xl space-y-8 px-4 py-6 md:py-10">
      <h1 class="text-3xl font-black uppercase md:text-4xl"><span class="hl-box hl-pink" style="--hl-rot: -1deg">Mi folio</span></h1>
      <FolioSignIn v-if="!folio" />

      <template v-else>
        <!-- Resumen -->
        <section class="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border-2 border-ink bg-neon-lime/25 px-4 py-3">
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

        <div v-else-if="status === 'error'" class="border-2 border-ink bg-card shadow-brut space-y-3 rounded-[22px] p-4 text-sm" role="alert">
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
              <RouterLink :to="{ name: 'testimony-new', params: { mapa: DEFAULT_MAP_SLUG } }" class="text-sm font-semibold text-accent-ink hover:underline">
                + Subir otro
              </RouterLink>
            </div>
            <p v-if="!testimonies.length" class="rounded-[20px] border-2 border-dashed border-ink/40 p-6 text-center text-sm text-fg/60">
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

          <section v-if="profile" class="border-2 border-ink bg-card shadow-brut rounded-[22px] p-4 md:p-6">
            <ProfileForm :folio="folio" :profile="profile" @updated="profile = $event" />
          </section>
        </template>
      </template>
    </div>
  </main>
</template>
