<script setup lang="ts">
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { SINCE_LABELS, type Since } from '@testimonies/data/facts'
import ChoiceGroup, { type Choice } from '@testimonies/components/form/ChoiceGroup.vue'
import FormField from '@testimonies/components/form/FormField.vue'
import LocationPicker from '@testimonies/components/form/LocationPicker.vue'
import { MEXICO_STATES, stateAt, type Place } from '@/modules/map'

const { draft, errors } = useTestimonyFormContext()

const STATES = MEXICO_STATES.map((s) => s.name).sort((a, b) => a.localeCompare(b, 'es'))

// Estado y municipio se completan solos al buscar o marcar el punto. Solo se reemplazan
// mientras sigan siendo lo que se puso automáticamente (si la persona los edita, se respetan)
const auto = { municipality: draft.municipality, state: draft.state }
function fill(field: 'municipality' | 'state', value: string | null) {
  if (!value) return
  if (!draft[field].trim() || draft[field] === auto[field]) {
    draft[field] = value.slice(0, LIMITS.short)
    auto[field] = draft[field]
  }
}
function onPlace(place: Place | null) {
  // El estado sale de la geometría local (más fiable que el geocodificador)
  const local = draft.coordinates ? stateAt(draft.coordinates)?.name : null
  fill('state', local ?? place?.state ?? null)
  fill('municipality', place?.municipality ?? null)
}

const sinceOptions = (Object.keys(SINCE_LABELS) as Since[]).map((value) => ({ value, label: SINCE_LABELS[value] }))
const ongoingOptions: Choice<boolean>[] = [
  { value: true, label: 'Sí' },
  { value: false, label: 'No' },
]
</script>

<template>
  <div class="grid gap-8 @3xl:grid-cols-[3fr_2fr] @3xl:gap-10">
    <section class="space-y-5">
      <FormField id="coordinates" v-slot="field" label="Marca el lugar" required :error="errors.coordinates" hint="Busca el lugar, usa tu ubicación o toca el mapa. Puedes arrastrar la chincheta.">
        <LocationPicker
          v-model="draft.coordinates"
          :input-id="field.id"
          :error="errors.coordinates"
          :describedby="field.describedby"
          @located="(source, accuracy) => ((draft.locationSource = source), (draft.gpsAccuracy = accuracy))"
          @place="onPlace"
        />
      </FormField>
      <div class="grid gap-4 @md:grid-cols-2">
        <FormField id="state" v-slot="field" label="Estado" required :error="errors.state">
          <select
            :id="field.id"
            v-model="draft.state"
            class="field-input"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedby"
          >
            <option value="">Elige…</option>
            <option v-for="name in STATES" :key="name" :value="name">{{ name }}</option>
          </select>
        </FormField>
        <FormField id="municipality" v-slot="field" label="Municipio" required :error="errors.municipality">
          <input
            :id="field.id"
            v-model="draft.municipality"
            type="text"
            class="field-input"
            :maxlength="LIMITS.short"
            autocomplete="address-level2"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedby"
          />
        </FormField>
      </div>
      <FormField id="place" v-slot="field" label="Comunidad o colonia" optional>
        <input :id="field.id" v-model="draft.place" type="text" class="field-input" :maxlength="LIMITS.short" :aria-describedby="field.describedby" />
      </FormField>
    </section>

    <section class="space-y-6">
      <ChoiceGroup
        v-model="draft.since"
        label="¿Desde cuándo pasa?"
        required
        :options="sinceOptions"
        :columns="1"
        :error="errors.since"
        help="Las leyes eléctricas cambiaron en 2025: saber desde cuándo pasa dice qué normas aplicaban."
      />
      <ChoiceGroup
        v-model="draft.ongoing"
        label="¿Sigue pasando?"
        required
        :options="ongoingOptions"
        :columns="2"
        :error="errors.ongoing"
        help="Si sigue pasando, se aplican las leyes actuales a lo que continúa."
      />
    </section>
  </div>
</template>
