<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EvidenceUpload } from '@testimonies/composables/useEvidenceUpload'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import type { CreateTestimonyResult } from '@testimonies/types/testimony'
import UploadProgress from '@testimonies/components/UploadProgress.vue'

const props = defineProps<{ result: CreateTestimonyResult; upload: EvidenceUpload }>()
defineEmits<{ viewOnMap: []; home: [] }>()

const STATUS = { pendiente: 'En revisión', aprobado: 'Publicado', rechazado: 'No publicado' } as const

const { remembered, remember, forget } = useParticipantFolio()

// El folio de participante solo llega la primera vez: se muestra aquí y no vuelve a pedirse
const participantFolio = computed(() => props.result.participantFolio)
const rememberIt = computed({
  get: () => !!participantFolio.value && remembered.value === participantFolio.value,
  set: (on: boolean) => (on && participantFolio.value ? remember(participantFolio.value) : forget()),
})

const uploading = props.upload.busy

const copied = ref(false)
async function copyFolio() {
  if (!participantFolio.value) return
  try {
    await navigator.clipboard.writeText(participantFolio.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Sin permiso de portapapeles: el folio sigue visible para copiarlo a mano
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-6 py-10 text-center">
    <span class="grid size-16 place-items-center rounded-full bg-neon-lime text-black">
      <svg viewBox="0 0 24 24" class="size-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m5 12 5 5 9-10" />
      </svg>
    </span>

    <div class="space-y-2">
      <h2 class="text-2xl font-semibold">Gracias por tu testimonio</h2>
      <p class="text-fg/70">{{ result.message }}</p>
    </div>

    <!-- Folio de participante (una sola vez) -->
    <section
      v-if="participantFolio"
      class="w-full max-w-sm space-y-3 rounded-2xl border border-neon-lime/50 light:border-fg/20 bg-neon-lime/10 light:bg-neon-lime/35 p-4 text-left"
      aria-labelledby="folio-title"
    >
      <div>
        <h3 id="folio-title" class="text-sm font-semibold">Tu folio personal</h3>
        <p class="text-xs text-fg/70">
          Guárdalo: no se mostrará otra vez. Es tu llave para subir más testimonios y editar los tuyos.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <code class="min-w-0 flex-1 rounded-xl bg-surface px-2 py-2 text-center font-mono text-sm font-semibold whitespace-nowrap select-all @xl:px-3 @xl:text-base @xl:tracking-wide">
          {{ participantFolio }}
        </code>
        <button
          type="button"
          class="btn-hxnf btn-ink btn-sm shrink-0"
          @click="copyFolio"
        >
          {{ copied ? 'Copiado' : 'Copiar' }}
        </button>
      </div>
      <label class="flex cursor-pointer items-center gap-3 text-sm">
        <input v-model="rememberIt" type="checkbox" class="size-5 accent-neon-lime" />
        Recordar en este dispositivo
      </label>
      <p class="text-xs text-fg/60">Si lo pierdes, escribe al equipo para recuperarlo.</p>
      <p class="sr-only" aria-live="polite">{{ copied ? 'Folio copiado' : '' }}</p>
    </section>

    <!-- Evidencias (se suben después de crear el testimonio) -->
    <UploadProgress :upload="upload" class="w-full max-w-sm" />

    <dl class="border-2 border-ink bg-card shadow-brut w-full max-w-sm space-y-2 rounded-[22px] p-4 text-left text-sm">
      <div class="flex justify-between gap-3">
        <dt class="text-fg/50">Folio del testimonio</dt>
        <dd class="font-semibold tabular-nums">{{ result.folio }}</dd>
      </div>
      <div class="flex justify-between gap-3">
        <dt class="text-fg/50">Estado</dt>
        <dd class="font-semibold">{{ STATUS[result.status] }}</dd>
      </div>
    </dl>

    <div class="flex w-full max-w-sm flex-col gap-3">
      <button
        v-if="result.published"
        type="button"
        class="btn-hxnf btn-lime"
        :disabled="uploading"
        @click="$emit('viewOnMap')"
      >
        Ver en el mapa
      </button>
      <button
        type="button"
        class="btn-hxnf btn-paper"
        :disabled="uploading"
        @click="$emit('home')"
      >
        Volver al inicio
      </button>
      <RouterLink
        v-if="remembered"
        :to="{ name: 'my-folio' }"
        class="text-sm font-semibold text-accent-ink hover:underline"
        :class="{ 'pointer-events-none opacity-50': uploading }"
      >
        Ir a Mi folio
      </RouterLink>
    </div>

    <p class="text-xs tracking-widest text-fg/50 uppercase">Escucha · Registra · Verifica · Protege</p>
  </div>
</template>
