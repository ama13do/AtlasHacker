<script setup lang="ts">
import { computed } from 'vue'
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { TOPIC_META } from '@testimonies/data/topics'
import type { Topic, Visibility } from '@testimonies/types/testimony'
import TopicIcon from '@testimonies/components/TopicIcon.vue'
import ChoiceGroup, { type Choice } from '@testimonies/components/form/ChoiceGroup.vue'
import FormField from '@testimonies/components/form/FormField.vue'
import LocationPicker from '@testimonies/components/form/LocationPicker.vue'

const { draft, errors } = useTestimonyFormContext()

const topics = Object.entries(TOPIC_META) as [Topic, (typeof TOPIC_META)[Topic]][]
const today = new Date().toLocaleDateString('en-CA')

const visibilityOptions: Choice<Visibility>[] = [
  { value: 'nombre', label: 'Con mi nombre' },
  { value: 'anonimo', label: 'Anónimo', description: 'Tu nombre no se mostrará' },
]
const visibility = computed({
  get: () => draft.visibility,
  set: (value) => {
    draft.visibility = value as Visibility
    // Aparecer como anónimo es incompatible con publicar con nombre
    if (value === 'anonimo' && draft.consent === 'publico-nombre') draft.consent = 'publico-anonimo'
  },
})
</script>

<template>
  <div class="space-y-7">
    <fieldset :aria-describedby="errors.topic ? 'topic-error' : undefined">
      <legend class="mb-2 text-sm font-semibold">¿De qué trata tu testimonio?</legend>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label
          v-for="[value, meta] in topics"
          :key="value"
          class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-white sm:flex-col sm:items-start"
          :class="draft.topic === value ? ['bg-white/5', meta.ring, 'ring-2', 'border-transparent'] : 'border-white/20 hover:border-white/40'"
        >
          <input v-model="draft.topic" type="radio" name="topic" :value="value" class="sr-only" />
          <span class="grid size-10 shrink-0 place-items-center rounded-full bg-black ring-2" :class="[meta.ring, meta.text]">
            <TopicIcon :topic="value" class="size-5" />
          </span>
          <span class="text-sm font-semibold">{{ meta.label }}</span>
        </label>
      </div>
      <p v-if="errors.topic" id="topic-error" class="mt-2 text-sm text-brand-orange">{{ errors.topic }}</p>
    </fieldset>

    <FormField
      id="title"
      v-slot="field"
      label="Título corto"
      hint="Una frase que resuma lo que pasa. Se mostrará en las historias."
      :error="errors.title"
      :length="draft.title.length"
      :max="LIMITS.title"
    >
      <input
        :id="field.id"
        v-model="draft.title"
        type="text"
        class="field-input"
        :maxlength="LIMITS.title"
        placeholder="Ej. El río cambió de color"
        :aria-invalid="field.invalid"
        :aria-describedby="field.describedby"
      />
    </FormField>

    <FormField id="place" v-slot="field" label="Lugar / territorio" :error="errors.place">
      <input
        :id="field.id"
        v-model="draft.place"
        type="text"
        class="field-input"
        :maxlength="LIMITS.short"
        placeholder="Comunidad, municipio, estado"
        autocomplete="address-level2"
        :aria-invalid="field.invalid"
        :aria-describedby="field.describedby"
      />
    </FormField>

    <FormField id="coordinates" v-slot="field" label="Ubicación en el mapa" :error="errors.coordinates">
      <LocationPicker v-model="draft.coordinates" :error="errors.coordinates" :describedby="field.describedby" />
    </FormField>

    <FormField id="date" v-slot="field" label="Fecha" :error="errors.date">
      <input
        :id="field.id"
        v-model="draft.date"
        type="date"
        class="field-input scheme-dark"
        :max="today"
        :aria-invalid="field.invalid"
        :aria-describedby="field.describedby"
      />
    </FormField>

    <ChoiceGroup v-model="visibility" label="¿Cómo deseas aparecer?" :options="visibilityOptions" />

    <FormField id="name" v-slot="field" label="Nombre" :optional="draft.visibility === 'anonimo'" :error="errors.name">
      <input
        :id="field.id"
        v-model="draft.name"
        type="text"
        class="field-input"
        :maxlength="LIMITS.short"
        autocomplete="name"
        :aria-invalid="field.invalid"
        :aria-describedby="field.describedby"
      />
    </FormField>

    <FormField id="facilitator" v-slot="field" label="Facilitador/a" optional hint="Si alguien te ayudó a registrar este testimonio.">
      <input :id="field.id" v-model="draft.facilitator" type="text" class="field-input" :maxlength="LIMITS.short" :aria-describedby="field.describedby" />
    </FormField>
  </div>
</template>
