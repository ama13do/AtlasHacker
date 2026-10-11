<script setup lang="ts">
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors } = useTestimonyFormContext()
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[1fr_16rem]">
    <FormField
      id="testimony"
      v-slot="field"
      label="¿Qué está ocurriendo?"
      required
      :error="errors.testimony"
      :length="draft.testimony.length"
      :max="LIMITS.long"
    >
      <textarea
        :id="field.id"
        v-model="draft.testimony"
        rows="9"
        class="field-input resize-y"
        :maxlength="LIMITS.long"
        placeholder="Describe con tus palabras lo que sucede…"
        :aria-invalid="field.invalid"
        :aria-describedby="field.describedby"
      />
    </FormField>

    <aside class="h-fit rounded-2xl border border-fg/10 bg-fg/[0.03] p-4 text-sm">
      <p class="form-group-title mb-3">Puedes contar</p>
      <ul class="space-y-2.5 text-fg/70">
        <li class="flex gap-2"><span class="text-accent-ink" aria-hidden="true">→</span> Qué pasa y qué te preocupa.</li>
        <li class="flex gap-2"><span class="text-accent-ink" aria-hidden="true">→</span> Dónde ocurre y desde cuándo.</li>
        <li class="flex gap-2"><span class="text-accent-ink" aria-hidden="true">→</span> A quiénes afecta y cómo.</li>
      </ul>
    </aside>
  </div>
</template>
