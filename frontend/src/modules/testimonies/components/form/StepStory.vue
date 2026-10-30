<script setup lang="ts">
import { ref } from 'vue'
import { LIMITS, MAX_LINKS, normalizeLink, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import AssistantQuestion from '@testimonies/components/form/AssistantQuestion.vue'
import EvidenceFiles from '@testimonies/components/form/EvidenceFiles.vue'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors } = useTestimonyFormContext()

// Links como evidencia: publicaciones de Facebook, notas, videos… solo la URL
const newLink = ref('')
const linkError = ref<string | null>(null)

function addLink() {
  if (!newLink.value.trim()) return
  const url = normalizeLink(newLink.value)
  if (!url) {
    linkError.value = 'Ese link no es válido. Cópialo completo, por ejemplo https://www.facebook.com/…'
    return
  }
  if (!draft.links.includes(url)) draft.links = [...draft.links, url]
  newLink.value = ''
  linkError.value = null
}

function removeLink(url: string) {
  draft.links = draft.links.filter((l) => l !== url)
}
</script>

<template>
  <div class="grid gap-8 @3xl:grid-cols-[3fr_2fr] @3xl:gap-10">
    <section class="space-y-6">
      <FormField
        id="title"
        v-slot="field"
        label="Título"
        required
        hint="Una frase que resuma lo que pasa. Se mostrará en el mapa y en las historias."
        example="150 familias sin agua en la sierra"
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
          placeholder="Ej. Apagones diarios en la escuela"
          :aria-invalid="field.invalid"
          :aria-describedby="field.describedby"
        />
      </FormField>

      <FormField
        id="testimony"
        v-slot="field"
        label="Cuenta lo que pasa"
        required
        hint="Con tus propias palabras. No hace falta ser especialista: la experiencia cotidiana también es conocimiento."
        example="Desde hace dos años se va la luz casi todas las noches. En la escuela ya no pueden usar los ventiladores y los niños salen enfermos por el calor."
        :error="errors.testimony"
        :length="draft.testimony.length"
        :max="LIMITS.testimony"
      >
        <textarea
          :id="field.id"
          v-model="draft.testimony"
          rows="9"
          class="field-input resize-y"
          :maxlength="LIMITS.testimony"
          placeholder="Cuéntalo como lo vives…"
          :aria-invalid="field.invalid"
          :aria-describedby="field.describedby"
        />
      </FormField>

      <div class="space-y-2 rounded-[22px] border-2 border-ink bg-card p-4 shadow-brut">
        <p class="chip w-fit bg-black text-[11px] tracking-wider text-white uppercase dark:bg-white dark:text-black">Tu pregunta al Tribunal · opcional</p>
        <FormField
          id="tribunalQuestion"
          v-slot="field"
          label="¿Qué le preguntarías a quien debía evitarlo?"
          hint="Esta pregunta se convertirá en una solicitud de información a la autoridad responsable."
          example="Si la misión de la CFE es la justicia energética, ¿por qué nuestra comunidad sigue sin luz estable?"
          :length="draft.tribunalQuestion.length"
          :max="LIMITS.long"
        >
          <textarea
            :id="field.id"
            v-model="draft.tribunalQuestion"
            rows="3"
            class="field-input resize-y"
            :maxlength="LIMITS.long"
            :aria-describedby="field.describedby"
          />
        </FormField>
        <AssistantQuestion :draft="draft" @use="draft.tribunalQuestion = $event.slice(0, LIMITS.long)" />
      </div>
    </section>

    <section class="space-y-5">
      <h3 class="form-group-title">Fotos o documentos <span class="normal-case">(opcional)</span></h3>
      <EvidenceFiles v-model="draft.files" :evidence="[]" />
      <p class="text-xs text-fg/60">Quitamos la ubicación y los datos ocultos de tus fotos antes de subirlas.</p>

      <div class="space-y-2" :aria-describedby="errors.links ? 'links-error' : undefined">
        <div class="space-y-1">
          <div class="flex items-baseline justify-between gap-3">
            <label for="evidence-link" class="text-sm font-semibold">Agregar links <span class="text-xs font-normal text-fg/40">(opcional)</span></label>
            <span class="text-xs text-fg/40 tabular-nums">{{ draft.links.length }}/{{ MAX_LINKS }}</span>
          </div>
          <p class="text-xs text-fg/50">Pega el link de una publicación de Facebook, un video, una nota… Solo el link.</p>
        </div>

        <ul v-if="draft.links.length" class="space-y-1.5">
          <li v-for="url in draft.links" :key="url" class="flex items-center gap-2 rounded-xl border border-fg/20 bg-fg/5 px-3 py-2 text-xs">
            <a :href="url" target="_blank" rel="noopener noreferrer" class="min-w-0 flex-1 truncate underline">{{ url }}</a>
            <button
              type="button"
              class="grid size-7 shrink-0 place-items-center rounded-full hover:bg-surface focus-visible:outline-2 focus-visible:outline-fg"
              :aria-label="`Quitar ${url}`"
              @click="removeLink(url)"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </li>
        </ul>

        <div v-if="draft.links.length < MAX_LINKS" class="flex gap-2">
          <input
            id="evidence-link"
            v-model="newLink"
            type="url"
            inputmode="url"
            autocomplete="off"
            placeholder="https://…"
            class="field-input min-w-0 flex-1"
            maxlength="2000"
            :aria-invalid="!!linkError"
            @keydown.enter.prevent="addLink"
            @blur="addLink"
          />
          <button type="button" class="btn-hxnf btn-paper btn-sm shrink-0" :disabled="!newLink.trim()" @click="addLink">Agregar</button>
        </div>
        <p v-if="linkError" role="status" class="text-sm text-danger">{{ linkError }}</p>
        <p v-if="errors.links" id="links-error" class="text-sm font-semibold text-danger">{{ errors.links }}</p>
      </div>
    </section>
  </div>
</template>
