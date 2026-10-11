<script setup lang="ts">
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors } = useTestimonyFormContext()
</script>

<template>
  <FormField
    id="testimony"
    v-slot="field"
    label="¿Qué está ocurriendo?"
    hint="Cuéntanos qué sucede en tu territorio y qué consideras importante que el Tribunal conozca."
    :error="errors.testimony"
    :length="draft.testimony.length"
    :max="LIMITS.long"
  >
    <textarea
      :id="field.id"
      v-model="draft.testimony"
      rows="10"
      class="field-input resize-y"
      :maxlength="LIMITS.long"
      :aria-invalid="field.invalid"
      :aria-describedby="field.describedby"
    />
  </FormField>
</template>
