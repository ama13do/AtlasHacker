<script setup lang="ts">
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors } = useTestimonyFormContext()
const currentYear = new Date().getFullYear()
</script>

<template>
  <div class="space-y-7">
    <section class="space-y-4 rounded-2xl border border-white/15 p-4">
      <div>
        <h3 class="text-sm font-semibold">Los datos dicen <span class="font-normal text-white/50">(opcional)</span></h3>
        <p class="text-sm text-white/60">¿Hay algún dato, cifra o estudio que respalde tu testimonio?</p>
      </div>

      <FormField id="dataText" v-slot="field" label="Dato">
        <textarea
          :id="field.id"
          v-model="draft.dataText"
          rows="3"
          class="field-input resize-y"
          :maxlength="LIMITS.long"
          :aria-describedby="field.describedby"
        />
      </FormField>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
        <FormField id="dataSource" v-slot="field" label="Fuente">
          <input :id="field.id" v-model="draft.dataSource" type="text" class="field-input" :maxlength="LIMITS.short" />
        </FormField>
        <FormField id="dataYear" v-slot="field" label="Año" :error="errors.dataYear">
          <input
            :id="field.id"
            v-model="draft.dataYear"
            type="number"
            inputmode="numeric"
            min="1900"
            :max="currentYear"
            class="field-input"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedby"
          />
        </FormField>
      </div>

      <label class="flex cursor-pointer items-center gap-3 text-sm">
        <input v-model="draft.dataPendingVerification" type="checkbox" class="size-5 accent-neon-lime" />
        Fuente pendiente de verificación
      </label>
    </section>

    <FormField
      id="tribunalQuestion"
      v-slot="field"
      label="La pregunta del Tribunal"
      hint="¿Qué debería explicar quien tomó la decisión?"
      :error="errors.tribunalQuestion"
      :length="draft.tribunalQuestion.length"
      :max="LIMITS.short * 2"
    >
      <textarea
        :id="field.id"
        v-model="draft.tribunalQuestion"
        rows="3"
        class="field-input resize-y"
        :maxlength="LIMITS.short * 2"
        placeholder="¿Por qué…?"
        :aria-invalid="field.invalid"
        :aria-describedby="field.describedby"
      />
    </FormField>
  </div>
</template>
