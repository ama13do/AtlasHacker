<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ApiError } from '@/core/http/client'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import { participantService } from '@testimonies/services/participant.service'
import type { TestimonyDraft } from '@testimonies/types/testimony'
import CreateTestimonyPage from '@testimonies/views/CreateTestimonyPage.vue'

// Carga un testimonio propio y abre el wizard en modo edición
const props = defineProps<{ id: string }>()

const router = useRouter()
const { active } = useParticipantFolio()

const edit = ref<{ id: string; testimonyFolio: string; participantFolio: string; draft: TestimonyDraft } | null>(null)
const error = ref<string | null>(null)

async function load() {
  const folio = active.value
  if (!folio) return router.replace({ name: 'my-folio' })
  error.value = null
  try {
    const mine = await participantService.getMineAsDraft(folio, props.id)
    edit.value = { id: props.id, testimonyFolio: mine.folio, participantFolio: folio, draft: mine.draft }
  } catch (e) {
    console.error(e)
    const status = (e as Partial<ApiError>).status
    error.value =
      status === 404
        ? 'No encontramos ese testimonio entre los tuyos.'
        : status === 401
          ? 'Tu folio ya no es válido. Vuelve a entrar en Mi folio.'
          : 'No pudimos cargar tu testimonio.'
  }
}

onMounted(load)
</script>

<template>
  <CreateTestimonyPage v-if="edit" :edit="edit" />
  <main v-else class="grid min-h-dvh place-items-center bg-surface px-4">
    <div v-if="error" class="max-w-sm space-y-4 text-center" role="alert">
      <p class="font-semibold">{{ error }}</p>
      <div class="flex justify-center gap-3">
        <button
          type="button"
          class="rounded-full border border-fg/30 px-5 py-2.5 text-sm font-semibold hover:border-fg focus-visible:outline-2 focus-visible:outline-fg"
          @click="load"
        >
          Reintentar
        </button>
        <RouterLink
          :to="{ name: 'my-folio' }"
          class="rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          Ir a Mi folio
        </RouterLink>
      </div>
    </div>
    <p v-else class="text-sm text-fg/60" role="status">Cargando tu testimonio…</p>
  </main>
</template>
