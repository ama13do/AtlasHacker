<script setup lang="ts">
import { computed, watch } from 'vue'
import { useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import type { Consent, MediaConsent, SensitiveHandling } from '@testimonies/types/testimony'
import ChoiceGroup, { type Choice } from '@testimonies/components/form/ChoiceGroup.vue'

const { draft, errors, publishable } = useTestimonyFormContext()

const consentOptions = computed<Choice<Consent>[]>(() => [
  {
    value: 'publico-nombre',
    label: 'Público con nombre',
    description: draft.visibility === 'anonimo' ? 'Elegiste aparecer como anónimo' : undefined,
    disabled: draft.visibility === 'anonimo',
  },
  { value: 'publico-anonimo', label: 'Público anónimo' },
  { value: 'interno', label: 'Solo documentación interna' },
  { value: 'no-publicar', label: 'No autorizo publicación' },
])

const mediaOptions: Choice<MediaConsent>[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'na', label: 'N/A' },
]

const sensitiveOptions: Choice<boolean>[] = [
  { value: false, label: 'No' },
  { value: true, label: 'Sí' },
]

const handlingOptions: Choice<SensitiveHandling>[] = [
  { value: 'anonimizar', label: 'Anonimizar' },
  { value: 'interno', label: 'Uso interno' },
  { value: 'revision', label: 'Revisión antes de publicar' },
]

watch(
  () => draft.sensitive,
  (sensitive) => {
    if (!sensitive) draft.sensitiveHandling = []
  },
)
</script>

<template>
  <div class="space-y-7">
    <div class="space-y-2">
      <label
        class="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition"
        :class="draft.voluntary ? 'border-neon-lime bg-neon-lime/10' : errors.voluntary ? 'border-brand-orange' : 'border-white/20'"
      >
        <input
          v-model="draft.voluntary"
          type="checkbox"
          class="mt-0.5 size-5 shrink-0 accent-neon-lime"
          :aria-invalid="!!errors.voluntary"
          :aria-describedby="errors.voluntary ? 'voluntary-error' : undefined"
        />
        <span>Declaro que participo voluntariamente y entiendo el uso de mi testimonio.</span>
      </label>
      <p v-if="errors.voluntary" id="voluntary-error" class="text-sm text-brand-orange">{{ errors.voluntary }}</p>
    </div>

    <ChoiceGroup v-model="draft.consent" label="Autorizo" :options="consentOptions" :error="errors.consent" />

    <ChoiceGroup
      v-model="draft.mediaConsent"
      label="Uso de foto, audio o video"
      :options="mediaOptions"
      :columns="3"
      :error="errors.mediaConsent"
    />

    <ChoiceGroup
      v-model="draft.sensitive"
      label="¿Existe información que pueda poner a alguien en riesgo?"
      :options="sensitiveOptions"
      :error="errors.sensitive"
    />

    <ChoiceGroup
      v-if="draft.sensitive"
      v-model="draft.sensitiveHandling"
      multiple
      label="¿Qué hacemos con esa información?"
      :options="handlingOptions"
      :columns="1"
      :error="errors.sensitiveHandling"
    />

    <p
      v-if="draft.consent"
      class="rounded-xl px-4 py-3 text-sm"
      :class="publishable ? 'bg-neon-green/10 text-neon-green' : 'bg-white/5 text-white/80'"
    >
      {{
        publishable
          ? 'Tu testimonio se publicará en el mapa.'
          : 'Tu testimonio no se publicará en el mapa; quedará para documentación o revisión.'
      }}
    </p>
  </div>
</template>
