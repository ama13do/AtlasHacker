<script setup lang="ts">
import { computed } from 'vue'
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { EVIDENCE_LABELS, EVIDENCE_OPTIONS } from '@testimonies/data/categories'
import type { DocumentStatus, EvidenceType } from '@testimonies/types/testimony'
import ChoiceGroup, { type Choice } from '@testimonies/components/form/ChoiceGroup.vue'
import EvidenceFiles from '@testimonies/components/form/EvidenceFiles.vue'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors } = useTestimonyFormContext()

const documentOptions: Choice<DocumentStatus>[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'pendiente', label: 'Pendiente', description: 'Existe, pero aún no lo tengo' },
]

const evidenceOptions = EVIDENCE_OPTIONS.map((value): Choice<EvidenceType> => ({ value, label: EVIDENCE_LABELS[value] }))

const hasPhotos = computed(() => draft.files.some((a) => a.file.type.startsWith('image/')))
</script>

<template>
  <div class="grid gap-8 @3xl:grid-cols-2 @3xl:gap-10">
    <section class="space-y-5">
      <ChoiceGroup
        v-model="draft.documentStatus"
        label="¿Existe algún documento, recibo, fotografía, mapa, estudio o dato que ayude a documentar lo que cuentas?"
        required
        :options="documentOptions"
        :columns="3"
        :error="errors.documentStatus"
        help="Sirven para comprobar o contextualizar lo que ocurre: recibos, facturas, contratos, oficios, permisos, comunicados, respuestas de autoridades, fotos de medidores, documentos comunitarios, resoluciones, mapas o estudios."
      />

      <FormField
        id="documentDescription"
        v-slot="field"
        label="¿Qué dice el recibo o documento?"
        optional
        hint="Registra lo que el documento dice antes de interpretarlo."
        help="No escribas conclusiones («el recibo demuestra que abusan»). Anota lo que se puede leer en el documento y, si hace falta, después lo que señala la persona."
        example="El recibo del periodo enero-febrero de 2026 registra un consumo de 320 kWh y un monto de $1,840. La persona señala que es un aumento respecto del periodo anterior."
        :length="draft.documentDescription.length"
        :max="LIMITS.long"
      >
        <textarea
          :id="field.id"
          v-model="draft.documentDescription"
          rows="4"
          class="field-input resize-y"
          :maxlength="LIMITS.long"
          :aria-describedby="field.describedby"
        />
      </FormField>

      <ChoiceGroup
        v-model="draft.evidence"
        multiple
        label="Evidencias que acompañan el testimonio"
        hint="Marca todas las que existan, aunque no las subas ahora."
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

      <!-- Huella digital: los metadatos de las fotos (GPS, fecha, modelo del teléfono) -->
      <label
        class="flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 text-sm transition"
        :class="draft.stripMetadata ? 'border-ink bg-neon-lime text-black shadow-brut-sm' : 'border-ink/30 bg-card'"
      >
        <input v-model="draft.stripMetadata" type="checkbox" class="mt-0.5 size-5 shrink-0 accent-black" />
        <span>
          <span class="block font-bold">Proteger mi huella digital</span>
          <span class="block text-xs opacity-80">
            Borra los metadatos de las fotos antes de subirlas: ubicación GPS, fecha y hora, y modelo del teléfono. Si no lo marcas, las fotos se suben tal
            cual.
          </span>
          <span v-if="hasPhotos && !draft.stripMetadata" class="mt-1 block text-xs font-bold">
            Ojo: tus fotos pueden revelar dónde y cuándo se tomaron.
          </span>
        </span>
      </label>
    </section>
  </div>
</template>
