<script setup lang="ts">
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { EVIDENCE_LABELS } from '@testimonies/data/categories'
import type { DocumentStatus, EvidenceType } from '@testimonies/types/testimony'
import ChoiceGroup, { type Choice } from '@testimonies/components/form/ChoiceGroup.vue'
import EvidenceFiles from '@testimonies/components/form/EvidenceFiles.vue'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors } = useTestimonyFormContext()

const documentOptions: Choice<DocumentStatus>[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'pendiente', label: 'Pendiente' },
]

const evidenceOptions = (Object.entries(EVIDENCE_LABELS) as [EvidenceType, string][]).map(
  ([value, label]): Choice<EvidenceType> => ({ value, label }),
)
</script>

<template>
  <div class="grid gap-8 @3xl:grid-cols-2 @3xl:gap-10">
    <section class="space-y-5">
      <h3 class="form-group-title">El documento</h3>
      <ChoiceGroup
        v-model="draft.documentStatus"
        label="¿Hay algún documento o evidencia que ayude a documentarlo?"
        required
        :options="documentOptions"
        :columns="3"
        :error="errors.documentStatus"
      />

      <FormField
        id="documentDescription"
        v-slot="field"
        label="¿Qué dice el recibo o documento?"
        optional
        :length="draft.documentDescription.length"
        :max="LIMITS.long"
      >
        <textarea
          :id="field.id"
          v-model="draft.documentDescription"
          rows="3"
          class="field-input resize-y"
          :maxlength="LIMITS.long"
          :aria-describedby="field.describedby"
        />
      </FormField>

      <ChoiceGroup
        v-model="draft.evidence"
        multiple
        label="Evidencias que acompañan"
        hint="Marca todas las que tengas."
        :options="evidenceOptions"
        :columns="3"
      />

      <FormField v-if="draft.evidence.includes('otro')" id="evidenceOther" v-slot="field" label="Otra evidencia" required :error="errors.evidenceOther">
        <input
          :id="field.id"
          v-model="draft.evidenceOther"
          type="text"
          class="field-input"
          :maxlength="LIMITS.short"
          :aria-invalid="field.invalid"
          :aria-describedby="field.describedby"
        />
      </FormField>
    </section>

    <section class="space-y-5">
      <h3 class="form-group-title">Archivos</h3>
      <EvidenceFiles v-model="draft.files" :evidence="draft.evidence" />
    </section>
  </div>
</template>
