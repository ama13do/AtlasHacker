<script setup lang="ts">
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors } = useTestimonyFormContext()
const currentYear = new Date().getFullYear()
</script>

<template>
  <div class="grid gap-8 @3xl:grid-cols-2 @3xl:gap-10">
    <!-- La pregunta: pieza central de la ficha -->
    <section class="space-y-3 rounded-2xl border border-neon-lime/40 light:border-fg/15 bg-neon-lime/[0.07] light:bg-neon-lime/30 p-5 @3xl:order-2 @3xl:self-start">
      <FormField
        id="tribunalQuestion"
        v-slot="field"
        label="La pregunta del Tribunal"
        required
        hint="¿Qué debería explicar quien tomó la decisión?"
        :error="errors.tribunalQuestion"
        :length="draft.tribunalQuestion.length"
        :max="LIMITS.short * 2"
      >
        <textarea
          :id="field.id"
          v-model="draft.tribunalQuestion"
          rows="4"
          class="field-input resize-y text-lg font-semibold"
          :maxlength="LIMITS.short * 2"
          placeholder="¿Por qué…?"
          :aria-invalid="field.invalid"
          :aria-describedby="field.describedby"
        />
      </FormField>
    </section>

    <section class="space-y-5 @3xl:order-1">
      <div class="space-y-1">
        <h3 class="form-group-title">Los datos dicen <span class="normal-case">(opcional)</span></h3>
        <p class="text-xs text-fg/50">¿Hay algún dato, cifra o estudio que respalde tu testimonio?</p>
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

      <div class="grid grid-cols-[1fr_7rem] gap-4">
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

      <label class="flex cursor-pointer items-center gap-3 text-sm text-fg/80">
        <input v-model="draft.dataPendingVerification" type="checkbox" class="size-5 accent-neon-lime" />
        Fuente pendiente de verificación
      </label>
    </section>
  </div>
</template>
