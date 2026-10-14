<script setup lang="ts">
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors } = useTestimonyFormContext()
</script>

<template>
  <div class="space-y-6">
    <p class="rounded-2xl border-2 border-dashed border-ink/50 px-4 py-3 text-sm">
      Las dos son <span class="font-bold">opcionales</span>: una sección puede tener mucha información y otra quedar pendiente. No inventes para llenar
      los espacios.
    </p>
    <div class="grid gap-8 @3xl:grid-cols-2">
      <FormField
        id="territory"
        v-slot="field"
        label="02 · El territorio dice"
        optional
        hint="¿Dónde ocurre? ¿Qué infraestructura energética hay? ¿Qué ha cambiado y desde cuándo?"
        help="Lo que puede observarse y ubicarse: su relación con viviendas, escuelas, agua, agricultura, caminos o espacios comunitarios. Si no se conoce la fecha exacta, escribe «la fecha exacta no ha sido confirmada»: es mejor que adivinar."
        example="En la comunidad de San Pedro, municipio de Juchitán, una línea de transmisión atraviesa las parcelas. La comunidad señala que se instaló aproximadamente en 2019."
        :error="errors.territory"
        :length="draft.territory.length"
        :max="LIMITS.long"
      >
        <textarea
          :id="field.id"
          v-model="draft.territory"
          rows="8"
          class="field-input resize-y"
          :maxlength="LIMITS.long"
          :aria-invalid="field.invalid"
          :aria-describedby="field.describedby"
        />
      </FormField>

      <FormField
        id="community"
        v-slot="field"
        label="03 · La comunidad dice"
        optional
        hint="¿Cómo lo ha vivido la comunidad? ¿Qué quieres que quede registrado en este expediente?"
        help="Aquí se conserva la voz de las personas. No traduzcas su experiencia a lenguaje institucional: «sentimos que nuestra agua ya no es igual» registra una experiencia; «la instalación contaminó el agua» afirma algo que tendría que demostrarse."
        example="Desde que pusieron esto, sentimos que nuestra agua ya no es igual. Las señoras ya no lavan en el río."
        :length="draft.community.length"
        :max="LIMITS.long"
      >
        <textarea
          :id="field.id"
          v-model="draft.community"
          rows="8"
          class="field-input resize-y"
          :maxlength="LIMITS.long"
          :aria-describedby="field.describedby"
        />
      </FormField>
    </div>
  </div>
</template>
