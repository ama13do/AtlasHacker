<script setup lang="ts">
import { emptySource, LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import FieldHelp from '@testimonies/components/form/FieldHelp.vue'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors, editing, staff } = useTestimonyFormContext()
const MAX_SOURCES = 20

function addSource() {
  if (draft.sources.length < MAX_SOURCES) draft.sources.push(emptySource())
}

function removeSource(id: string) {
  draft.sources = draft.sources.length > 1 ? draft.sources.filter((s) => s.id !== id) : [emptySource()]
}

// Manual C.6-05: preguntas que abren una investigación en lugar de acusar
const QUESTION_EXAMPLES = [
  ['¿Por qué la CFE abandona a las comunidades?', '¿Qué criterios se utilizaron para determinar la infraestructura energética instalada en este territorio?'],
  ['¿Por qué no les importa el costo de la electricidad?', '¿Cómo se determinó el impacto de esta decisión sobre los costos que enfrentan las familias?'],
  ['¿Por qué destruyeron el territorio?', '¿Qué estudios y mecanismos de participación se consideraron antes de tomar esta decisión?'],
] as const
</script>

<template>
  <div class="space-y-10">
    <div class="grid gap-8 @3xl:grid-cols-2 @3xl:gap-10">
      <!-- 04 · Los datos dicen -->
      <section class="space-y-5">
        <div class="space-y-1">
          <h3 class="form-group-title">04 · Los datos dicen <span class="normal-case">(opcional)</span></h3>
          <p class="text-xs text-fg/60">Estadísticas, mediciones, estudios, registros oficiales, consumos o tarifas.</p>
        </div>

        <FormField
          id="dataText"
          v-slot="field"
          label="Datos"
          help="Información que se pueda verificar. Regla de oro: un dato sin fuente no se presenta como evidencia comprobada; si aún no conoces la fuente, márcala como pendiente de verificación."
          example="En 2025 la comunidad registró 42 cortes de luz de más de 4 horas. La tarifa doméstica pasó de $0.89 a $1.12 por kWh."
          :length="draft.dataText.length"
          :max="LIMITS.long * 2"
        >
          <textarea
            :id="field.id"
            v-model="draft.dataText"
            rows="4"
            class="field-input resize-y"
            :maxlength="LIMITS.long * 2"
            placeholder="Puedes anotar varios datos"
            :aria-describedby="field.describedby"
          />
        </FormField>

        <fieldset class="space-y-3" :aria-describedby="errors.sources ? 'sources-error' : undefined">
          <legend class="text-sm font-bold">Fuentes</legend>
          <p class="text-xs text-fg/60">Para cada fuente: quién lo publica, el año y un enlace o referencia.</p>
          <ol class="space-y-3">
            <li v-for="(s, i) in draft.sources" :key="s.id" class="space-y-2 rounded-2xl border-2 border-ink/30 bg-card p-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-black uppercase">Fuente {{ i + 1 }}</span>
                <button
                  v-if="draft.sources.length > 1 || s.source || s.year || s.link"
                  type="button"
                  class="text-xs font-bold underline decoration-2 underline-offset-2 hover:text-danger"
                  :aria-label="`Quitar fuente ${i + 1}`"
                  @click="removeSource(s.id)"
                >
                  Quitar
                </button>
              </div>
              <div class="grid grid-cols-[1fr_6.5rem] gap-2">
                <input v-model="s.source" type="text" class="field-input" :maxlength="300" placeholder="Fuente (p. ej. INEGI, CFE, estudio…)" :aria-label="`Fuente ${i + 1}`" />
                <!-- Texto (no type=number): Vue convertiría el valor en número y el borrador espera texto -->
                <input
                  v-model="s.year"
                  type="text"
                  inputmode="numeric"
                  maxlength="4"
                  pattern="[0-9]*"
                  class="field-input"
                  placeholder="Año"
                  :aria-label="`Año de la fuente ${i + 1}`"
                />
              </div>
              <input v-model="s.link" type="text" class="field-input text-sm" :maxlength="500" placeholder="Enlace o referencia" :aria-label="`Enlace o referencia de la fuente ${i + 1}`" />
            </li>
          </ol>
          <button v-if="draft.sources.length < MAX_SOURCES" type="button" class="btn-hxnf btn-paper btn-sm" @click="addSource">
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Agregar otra fuente
          </button>
          <p v-if="errors.sources" id="sources-error" class="text-sm font-semibold text-danger">{{ errors.sources }}</p>
        </fieldset>

        <label class="flex cursor-pointer items-center gap-3 text-sm">
          <input v-model="draft.dataPendingVerification" type="checkbox" class="size-5 accent-black" />
          Fuente pendiente de verificación
        </label>
      </section>

      <!-- 05 · La pregunta del Tribunal -->
      <section class="on-light space-y-3 self-start rounded-[22px] border-2 border-black bg-neon-lime p-5 text-black shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
        <FormField
          id="tribunalQuestion"
          v-slot="field"
          label="05 · La pregunta del Tribunal"
          optional
          hint="«¿Qué le preguntarías a quien tomó esta decisión?»"
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
            placeholder="¿Qué criterios…? ¿Cómo se determinó…?"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedby"
          />
        </FormField>
        <FieldHelp
          label="Cómo formular la pregunta"
          help="No se trata de acusar, sino de preguntar qué tendría que explicar quien tomó la decisión. La pregunta abre una investigación; no la cierra de antemano."
        />
        <details class="text-xs">
          <summary class="cursor-pointer font-bold">Ver ejemplos</summary>
          <ul class="mt-2 space-y-2">
            <li v-for="[avoid, better] in QUESTION_EXAMPLES" :key="avoid" class="rounded-xl border-2 border-black bg-white p-2.5">
              <p class="line-through opacity-60">{{ avoid }}</p>
              <p class="font-bold">{{ better }}</p>
            </li>
          </ul>
        </details>
      </section>
    </div>

    <!-- Manual C.11 · La última pregunta -->
    <section class="space-y-5">
      <div class="space-y-1">
        <h3 class="form-group-title">Para cerrar <span class="normal-case">(opcional)</span></h3>
        <p class="text-xs text-fg/60">Estas preguntas devuelven a la persona parte del control sobre su propio testimonio.</p>
      </div>
      <div class="grid gap-6 @3xl:grid-cols-2">
        <FormField
          id="anythingElse"
          v-slot="field"
          label="¿Hay algo que no te preguntamos y que consideras importante que el Tribunal conozca?"
          optional
          hint="Se publica junto con el testimonio (si autorizas publicarlo)."
          :length="draft.anythingElse.length"
          :max="LIMITS.long"
        >
          <textarea :id="field.id" v-model="draft.anythingElse" rows="4" class="field-input resize-y" :maxlength="LIMITS.long" :aria-describedby="field.describedby" />
        </FormField>
        <FormField
          id="voiceRecord"
          v-slot="field"
          label="¿Cómo te gustaría que quedara registrada tu voz?"
          optional
          :hint="editing || staff ? 'Indicación para el equipo; no se publica.' : 'Es una indicación para el equipo: no se publica.'"
          example="Que se lea tal cual, sin corregir mis palabras."
          :length="draft.voiceRecord.length"
          :max="LIMITS.long"
        >
          <textarea :id="field.id" v-model="draft.voiceRecord" rows="4" class="field-input resize-y" :maxlength="LIMITS.long" :aria-describedby="field.describedby" />
        </FormField>
      </div>
    </section>
  </div>
</template>
