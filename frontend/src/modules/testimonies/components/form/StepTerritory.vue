<script setup lang="ts">
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors } = useTestimonyFormContext()
</script>

<template>
  <div class="space-y-7">
    <FormField
      id="territory"
      v-slot="field"
      label="El territorio dice"
      hint="¿Qué ha cambiado o qué puede observarse? ¿Dónde y desde cuándo?"
      :error="errors.territory"
      :length="draft.territory.length"
      :max="LIMITS.long"
    >
      <textarea
        :id="field.id"
        v-model="draft.territory"
        rows="6"
        class="field-input resize-y"
        :maxlength="LIMITS.long"
        :aria-invalid="field.invalid"
        :aria-describedby="field.describedby"
      />
    </FormField>

    <FormField
      id="community"
      v-slot="field"
      label="La comunidad dice"
      optional
      hint="¿Cómo ha vivido la comunidad esta situación? ¿A quiénes afecta o involucra?"
      :length="draft.community.length"
      :max="LIMITS.long"
    >
      <textarea
        :id="field.id"
        v-model="draft.community"
        rows="6"
        class="field-input resize-y"
        :maxlength="LIMITS.long"
        :aria-describedby="field.describedby"
      />
    </FormField>
  </div>
</template>
