<script setup lang="ts">
import { computed, ref } from 'vue'
import { LIMITS, MAX_LINKS, normalizeLink, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
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

      <div class="space-y-2" :aria-describedby="errors.links ? 'links-error' : undefined">
        <div class="space-y-1">
          <div class="flex items-baseline justify-between gap-3">
            <label for="evidence-link" class="text-sm font-semibold">Agregar links <span class="text-xs font-normal text-fg/40">(opcional)</span></label>
            <span class="text-xs text-fg/40 tabular-nums">{{ draft.links.length }}/{{ MAX_LINKS }}</span>
          </div>
          <p class="text-xs text-fg/50">
            Pega el link de lo que sea: una publicación de Facebook, un video, una nota, un post… Solo el link.
          </p>
          <p class="text-xs font-semibold text-fg/70">Más adelante puedes poner referencias bibliográficas oficiales.</p>
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
