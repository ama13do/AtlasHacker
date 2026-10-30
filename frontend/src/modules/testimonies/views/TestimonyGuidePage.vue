<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ApiError } from '@/core/http/client'
import SiteHeader from '@/shared/components/SiteHeader.vue'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import { participantService } from '@testimonies/services/participant.service'
import type { ModerationStatus } from '@testimonies/types/testimony'
import { guideInputOf, hasGuide, type GuideInput } from '@testimonies/utils/guideInput'
import TestimonyGuide from '@testimonies/components/guide/TestimonyGuide.vue'

// Guía de un testimonio propio (desde Mi folio): se arma con sus respuestas
const props = defineProps<{ id: string }>()

const router = useRouter()
const { active } = useParticipantFolio()

const STATUS: Record<ModerationStatus, string> = {
  pendiente: 'en revisión, todavía no es público',
  aprobado: 'publicado en el mapa',
  rechazado: 'no publicado',
}

const guide = ref<{ folio: string; status: string; input: GuideInput } | null>(null)
const error = ref<string | null>(null)

async function load() {
  const folio = active.value
  if (!folio) return router.replace({ name: 'my-folio' })
  error.value = null
  try {
    const mine = await participantService.getMineAsDraft(folio, props.id)
    const input = guideInputOf(mine.draft)
    if (!hasGuide(input)) {
      error.value = 'Este testimonio se envió con el formulario anterior, así que no tiene guía.'
      return
    }
    guide.value = { folio: mine.folio, status: mine.active ? STATUS[mine.status] : 'dado de baja', input }
  } catch (e) {
    console.error(e)
    const status = (e as Partial<ApiError>).status
    error.value =
      status === 404
        ? 'No encontramos ese testimonio entre los tuyos.'
        : status === 401
          ? 'Tu folio ya no es válido. Vuelve a entrar en Mi folio.'
          : 'No pudimos cargar tu guía.'
  }
}

onMounted(load)
</script>

<template>
  <main class="min-h-dvh">
    <SiteHeader />

    <div class="@container mx-auto max-w-3xl px-4 py-6 md:py-10">
      <TestimonyGuide v-if="guide" :input="guide.input" :folio="guide.folio" :status="guide.status">
        <div class="mt-6">
          <RouterLink :to="{ name: 'my-folio' }" class="btn-hxnf btn-paper">Volver a Mi folio</RouterLink>
        </div>
      </TestimonyGuide>

      <div v-else-if="error" class="space-y-4 rounded-[22px] border-2 border-ink bg-card p-4 shadow-brut" role="alert">
        <p class="font-semibold">{{ error }}</p>
        <div class="flex flex-wrap gap-3">
          <button type="button" class="btn-hxnf btn-paper btn-sm" @click="load">Reintentar</button>
          <RouterLink :to="{ name: 'my-folio' }" class="btn-hxnf btn-ink btn-sm">Ir a Mi folio</RouterLink>
        </div>
      </div>
      <p v-else class="text-sm text-fg/60" role="status">Cargando tu guía…</p>
    </div>
  </main>
</template>
