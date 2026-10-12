<script setup lang="ts">
import { computed, ref } from 'vue'
import { participantService } from '@testimonies/services/participant.service'
import type { MyTestimony } from '@testimonies/types/testimony'
import CategoryBadge from '@testimonies/components/CategoryBadge.vue'
import MyEvidencePanel from '@testimonies/components/folio/MyEvidencePanel.vue'
import StatusChip from '@testimonies/components/folio/StatusChip.vue'

const props = defineProps<{ testimony: MyTestimony; folio: string; canEdit: boolean; canWithdraw: boolean }>()
const emit = defineEmits<{ withdrawn: [id: string]; changed: [] }>()

const date = computed(() =>
  new Date(`${props.testimony.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
)

const showEvidence = ref(false)
const confirmingWithdraw = ref(false)
const withdrawing = ref(false)
const error = ref<string | null>(null)

async function withdraw() {
  withdrawing.value = true
  error.value = null
  try {
    await participantService.withdraw(props.folio, props.testimony.id)
    confirmingWithdraw.value = false
    emit('withdrawn', props.testimony.id)
  } catch (e) {
    console.error(e)
    error.value = (e as { status?: number }).status === 403 ? 'Dar de baja está desactivado por ahora.' : 'No se pudo dar de baja.'
  } finally {
    withdrawing.value = false
  }
}

const actionClass =
  'rounded-full border border-fg/25 px-3.5 py-1.5 text-sm font-semibold transition hover:border-fg focus-visible:outline-2 focus-visible:outline-fg'
</script>

<template>
  <article class="space-y-3 rounded-2xl border border-fg/15 p-4" :class="{ 'opacity-70': !testimony.active }">
    <header class="flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0 space-y-1.5">
        <CategoryBadge :category="testimony.category" />
        <h3 class="leading-snug font-semibold">{{ testimony.title }}</h3>
        <p class="text-xs text-fg/50">
          {{ testimony.folio }} · {{ date }}<template v-if="testimony.place"> · {{ testimony.place }}</template>
        </p>
      </div>
      <StatusChip :testimony="testimony" />
    </header>

    <p
      v-if="testimony.status === 'rechazado' && testimony.rejectionReason"
      class="rounded-xl bg-brand-orange/10 px-3 py-2 text-sm light:bg-brand-orange/25"
    >
      <span class="font-semibold">Motivo:</span> {{ testimony.rejectionReason }}
    </p>

    <p v-if="testimony.public" class="text-xs text-fg/50">
      {{ testimony.reactions }} {{ testimony.reactions === 1 ? 'reacción' : 'reacciones' }} ·
      {{ testimony.comments }} {{ testimony.comments === 1 ? 'comentario' : 'comentarios' }}
    </p>

    <!-- Acciones -->
    <div v-if="testimony.active" class="flex flex-wrap items-center gap-2">
      <RouterLink v-if="testimony.public" :to="{ name: 'home', query: { t: testimony.id } }" :class="actionClass">
        Ver en el mapa
      </RouterLink>
      <RouterLink
        v-if="canEdit"
        :to="{ name: 'my-testimony-edit', params: { id: testimony.id } }"
        :class="actionClass"
      >
        Editar
      </RouterLink>
      <button type="button" :class="actionClass" :aria-expanded="showEvidence" @click="showEvidence = !showEvidence">
        Evidencias
      </button>

      <template v-if="canWithdraw">
        <span v-if="confirmingWithdraw" class="flex flex-wrap items-center gap-3 text-sm">
          <span class="text-fg/70">Dejará de verse en el mapa. ¿Continuar?</span>
          <button
            type="button"
            class="font-semibold text-danger hover:underline disabled:opacity-50"
            :disabled="withdrawing"
            @click="withdraw"
          >
            {{ withdrawing ? 'Dando de baja…' : 'Sí, dar de baja' }}
          </button>
          <button type="button" class="text-fg/60 hover:underline" @click="confirmingWithdraw = false">Cancelar</button>
        </span>
        <button
          v-else
          type="button"
          class="ml-auto text-sm text-fg/60 hover:text-fg hover:underline"
          @click="confirmingWithdraw = true"
        >
          Dar de baja
        </button>
      </template>
    </div>
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>

    <MyEvidencePanel
      v-if="showEvidence && testimony.active"
      :testimony-id="testimony.id"
      :folio="folio"
      class="border-t border-fg/10 pt-3"
      @changed="emit('changed')"
    />
  </article>
</template>
