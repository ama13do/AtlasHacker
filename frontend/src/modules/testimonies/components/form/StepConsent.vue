<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import type { Consent, MediaConsent, SensitiveHandling } from '@testimonies/types/testimony'
import { maskFolio } from '@testimonies/utils/folio'
import ChoiceGroup, { type Choice } from '@testimonies/components/form/ChoiceGroup.vue'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors, publishable, editing } = useTestimonyFormContext()

// Fotos, video o audio adjuntos sin autorizar su uso: se guardan, pero no se publican
const mediaWithoutConsent = computed(
  () => draft.mediaConsent === 'no' && draft.files.some((a) => ['foto', 'video', 'audio'].includes(a.type)),
)

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
    if (!sensitive) draft.sensitiveHandling = null
  },
)

// Folio: el recordado en este dispositivo o uno que la persona pega
const { remembered, forget } = useParticipantFolio()
const typingFolio = ref(!!draft.folio)

function useOtherFolio() {
  typingFolio.value = true
}

function forgetFolio() {
  forget()
  typingFolio.value = false
}

function toggleTyping(on: boolean) {
  typingFolio.value = on
  if (!on) draft.folio = ''
}
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-2">
      <label
        class="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition"
        :class="draft.voluntary ? 'border-neon-lime bg-neon-lime/10 light:border-fg light:bg-neon-lime/35' : errors.voluntary ? 'border-brand-orange' : 'border-fg/20'"
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
      <p v-if="errors.voluntary" id="voluntary-error" class="text-sm text-danger">{{ errors.voluntary }}</p>
    </div>

    <section class="space-y-4">
      <h3 class="form-group-title">Uso del testimonio</h3>
      <div class="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <ChoiceGroup v-model="draft.consent" label="Autorizo" required :options="consentOptions" :error="errors.consent" />
        <ChoiceGroup
          v-model="draft.mediaConsent"
          label="Uso de foto, audio o video"
          required
          :options="mediaOptions"
          :columns="3"
          :error="errors.mediaConsent"
        />
      </div>
      <p v-if="mediaWithoutConsent" class="rounded-xl bg-fg/5 px-4 py-3 text-sm text-fg/80" role="note">
        Elegiste no autorizar foto, audio o video: los archivos que adjuntaste se guardarán solo para documentación interna.
      </p>
    </section>

    <section class="space-y-4">
      <h3 class="form-group-title">Protección</h3>
      <div class="grid gap-8 lg:grid-cols-[2fr_3fr]">
        <ChoiceGroup
          v-model="draft.sensitive"
          label="¿Existe información que pueda poner a alguien en riesgo?"
          required
          :options="sensitiveOptions"
          :error="errors.sensitive"
        />
        <ChoiceGroup
          v-if="draft.sensitive"
          v-model="draft.sensitiveHandling"
          label="¿Qué hacemos con esa información?"
          required
          :options="handlingOptions"
          :columns="3"
          :error="errors.sensitiveHandling"
        />
      </div>
    </section>

    <!-- Al editar, el folio y el contacto se manejan en Mi folio -->
    <section v-if="!editing" class="space-y-4">
      <div class="space-y-1">
        <h3 class="form-group-title">Tu folio <span class="normal-case">(opcional)</span></h3>
        <p class="text-xs text-fg/50">
          Con tu folio puedes subir más testimonios y editar los tuyos. Si no tienes uno, te daremos uno al enviar.
        </p>
      </div>

      <!-- Folio recordado en este dispositivo -->
      <div
        v-if="remembered && !typingFolio"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fg/15 px-4 py-3 text-sm"
      >
        <span>
          Enviarás con tu folio <span class="font-semibold tabular-nums">{{ maskFolio(remembered) }}</span>
        </span>
        <span class="flex gap-4">
          <button type="button" class="font-semibold text-accent-ink hover:underline" @click="useOtherFolio">Usar otro</button>
          <button type="button" class="text-fg/60 hover:text-fg hover:underline" @click="forgetFolio">
            Olvidar en este dispositivo
          </button>
        </span>
      </div>

      <template v-else>
        <label class="flex w-fit cursor-pointer items-center gap-3 text-sm text-fg/80">
          <input
            type="checkbox"
            class="size-5 accent-neon-lime"
            :checked="typingFolio"
            @change="toggleTyping(($event.target as HTMLInputElement).checked)"
          />
          Ya tengo folio
        </label>
        <FormField v-if="typingFolio" id="folio" v-slot="field" label="Folio" :error="errors.folio">
          <input
            :id="field.id"
            v-model="draft.folio"
            type="text"
            class="field-input font-mono uppercase sm:max-w-sm"
            placeholder="P-XXXX-XXXX-XXXX-XXXX"
            autocomplete="off"
            spellcheck="false"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedby"
          />
        </FormField>
      </template>

      <div class="grid gap-5 sm:grid-cols-2">
        <FormField id="email" v-slot="field" label="Correo" optional :error="errors.email">
          <input
            :id="field.id"
            v-model="draft.email"
            type="email"
            class="field-input"
            autocomplete="email"
            :maxlength="LIMITS.short"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedby"
          />
        </FormField>
        <FormField id="phone" v-slot="field" label="Teléfono" optional :error="errors.phone">
          <input
            :id="field.id"
            v-model="draft.phone"
            type="tel"
            class="field-input"
            autocomplete="tel"
            maxlength="25"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedby"
          />
        </FormField>
      </div>
      <p class="text-xs text-fg/50">
        El correo y el teléfono solo sirven para ayudarte a recuperar tu folio si lo pierdes. Se guardan cifrados y no se publican.
      </p>
    </section>

    <p
      v-if="draft.consent"
      class="rounded-xl px-4 py-3 text-sm"
      :class="publishable ? 'bg-neon-green/10 light:bg-neon-green/25 text-neon-green light:text-fg' : 'bg-fg/5 text-fg/80'"
    >
      {{
        publishable
          ? 'Tu testimonio se publicará en el mapa después de una revisión.'
          : 'Tu testimonio no se publicará en el mapa; quedará para documentación o revisión.'
      }}
    </p>
  </div>
</template>
