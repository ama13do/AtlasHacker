<script setup lang="ts">
import { ref, useId } from 'vue'
import type { ApiError } from '@/core/http/client'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import { participantService } from '@testimonies/services/participant.service'
import { normalizeParticipantFolio } from '@testimonies/utils/folio'

// Entrar a "Mi folio": se valida el folio contra la API antes de guardarlo
const emit = defineEmits<{ signedIn: [] }>()

const { signIn } = useParticipantFolio()
const ids = { folio: useId(), error: useId() }
const value = ref('')
const remember = ref(false)
const checking = ref(false)
const error = ref<string | null>(null)

async function submit() {
  const folio = normalizeParticipantFolio(value.value)
  if (!folio) {
    error.value = 'El folio tiene el formato P-XXXX-XXXX-XXXX-XXXX.'
    return
  }
  checking.value = true
  error.value = null
  try {
    await participantService.getProfile(folio)
    signIn(folio, remember.value)
    value.value = ''
    emit('signedIn')
  } catch (e) {
    const status = (e as Partial<ApiError>).status
    error.value =
      status === 401
        ? 'Ese folio no es válido. Revísalo.'
        : status === 429
          ? 'Demasiados intentos. Espera un momento.'
          : 'No pudimos comprobar tu folio. Intenta de nuevo.'
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <form class="mx-auto w-full max-w-md space-y-5 rounded-3xl border border-fg/15 p-6" @submit.prevent="submit">
    <div class="space-y-1">
      <h2 class="text-xl font-semibold">Entra con tu folio</h2>
      <p class="text-sm text-fg/60">
        Es el folio personal que recibiste al subir tu primer testimonio. Con él ves su estado, los editas y agregas
        evidencias.
      </p>
    </div>

    <div class="space-y-1.5">
      <label :for="ids.folio" class="text-sm font-semibold">Folio</label>
      <input
        :id="ids.folio"
        v-model="value"
        type="text"
        class="field-input font-mono uppercase"
        placeholder="P-XXXX-XXXX-XXXX-XXXX"
        autocomplete="off"
        spellcheck="false"
        :aria-invalid="!!error"
        :aria-describedby="error ? ids.error : undefined"
      />
      <p v-if="error" :id="ids.error" class="text-sm text-danger" role="alert">{{ error }}</p>
    </div>

    <label class="flex w-fit cursor-pointer items-center gap-3 text-sm">
      <input v-model="remember" type="checkbox" class="size-5 accent-neon-lime" />
      Recordar en este dispositivo
    </label>

    <button
      type="submit"
      class="w-full rounded-full bg-neon-lime py-3 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-60"
      :disabled="checking || !value.trim()"
    >
      {{ checking ? 'Comprobando…' : 'Entrar' }}
    </button>

    <p class="text-xs text-fg/50">¿Lo perdiste? Escribe al equipo para recuperarlo.</p>
  </form>
</template>
