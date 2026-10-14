<script setup lang="ts">
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors } = useTestimonyFormContext()

// Manual C.5: primero se escucha, después se pregunta
const GUIDE = [
  ['Qué ocurre', '¿Qué está pasando en tu territorio?'],
  ['Desde cuándo', '¿Desde cuándo ocurre? ¿Qué cambió?'],
  ['A quiénes', '¿Cómo les ha afectado y a quiénes?'],
  ['Qué hicieron', '¿A qué autoridades u organizaciones acudieron? ¿Qué respuesta recibieron?'],
] as const
</script>

<template>
  <div class="grid gap-8 @3xl:grid-cols-[1fr_17rem]">
    <FormField
      id="testimony"
      v-slot="field"
      label="¿Qué está ocurriendo en tu territorio y qué consideras importante que el Tribunal conozca?"
      required
      hint="Con tus propias palabras. No hace falta ser especialista: la experiencia cotidiana también es conocimiento."
      help="Es la voz de la persona tal como la cuenta. Si llenas la ficha por alguien más, escucha sin interrumpir y no traduzcas su experiencia a lenguaje institucional ni la conduzcas hacia una conclusión."
      example="Desde hace dos años se va la luz casi todas las noches. En la escuela ya no pueden usar los ventiladores y los niños salen enfermos por el calor."
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
        placeholder="Cuéntalo como lo vives…"
        :aria-invalid="field.invalid"
        :aria-describedby="field.describedby"
      />
    </FormField>

    <aside class="h-fit space-y-4">
      <div class="rounded-[22px] border-2 border-ink bg-card p-4 text-sm shadow-brut">
        <p class="form-group-title mb-3">Puedes contar</p>
        <ul class="space-y-2.5">
          <li v-for="[title, text] in GUIDE" :key="title" class="leading-snug">
            <span class="font-bold">{{ title }}:</span> <span class="opacity-75">{{ text }}</span>
          </li>
        </ul>
      </div>
      <div class="rounded-[22px] border-2 border-dashed border-ink/50 p-4 text-xs leading-relaxed">
        <p class="mb-2 font-black uppercase">Testimonio, dato e interpretación</p>
        <p><span class="font-bold">Testimonio:</span> «La comunidad señala que desde la instalación el agua cambió».</p>
        <p class="mt-1"><span class="font-bold">Dato:</span> «Un análisis de laboratorio reporta…» (va en 04 · Los datos).</p>
        <p class="mt-1"><span class="font-bold">Interpretación:</span> «La comunidad considera que podrían estar relacionados».</p>
        <p class="mt-2 opacity-70">Las tres caben, pero mejor si quedan diferenciadas.</p>
      </div>
    </aside>
  </div>
</template>
