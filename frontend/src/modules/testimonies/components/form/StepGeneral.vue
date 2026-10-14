<script setup lang="ts">
import { computed, ref } from 'vue'
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { Visibility } from '@testimonies/types/testimony'
import CategoryIcon from '@testimonies/components/CategoryIcon.vue'
import ChoiceGroup, { type Choice } from '@testimonies/components/form/ChoiceGroup.vue'
import FieldHelp from '@testimonies/components/form/FieldHelp.vue'
import FormField from '@testimonies/components/form/FormField.vue'
import LocationPicker from '@testimonies/components/form/LocationPicker.vue'
import { stateAt, type Place } from '@/modules/map'

const { draft, errors } = useTestimonyFormContext()

const categoriesStore = useCategoriesStore()
const categories = computed(() => categoriesStore.categories.map((c) => categoriesStore.bySlug(c.slug)))
const categoriesError = ref(false)

async function loadCategories() {
  categoriesError.value = false
  try {
    await categoriesStore.load()
  } catch {
    categoriesError.value = true
  }
}
loadCategories()

const selectedDescription = computed(() => categories.value.find((c) => c.slug === draft.topic)?.description)
const today = new Date().toLocaleDateString('en-CA')

// Lugar, municipio y estado se completan solos al buscar o marcar el punto. Solo se reemplazan
// mientras sigan siendo lo que se puso automáticamente (si la persona los edita, se respetan)
const auto = { place: draft.place, municipality: draft.municipality, state: draft.state }
function fill(field: 'place' | 'municipality' | 'state', value: string | null) {
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
  fill('place', place?.label ?? null)
}

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
  <div class="grid gap-8 @3xl:grid-cols-[3fr_2fr] @3xl:gap-10">
    <!-- Columna principal -->
    <div class="space-y-8">
      <section class="space-y-5">
        <h3 class="form-group-title">Categoría</h3>
        <FieldHelp
          label="¿Cuál elijo?"
          help="Elige la que mejor describe lo que ocurre. Inseguridad energética: apagones, cobros, falta de acceso. Cambio climático: sequías, inundaciones, calor extremo. Megaproyectos: plantas, gasoductos, líneas de transmisión u otras obras. Si cabe en varias, elige la principal."
        />
        <fieldset :aria-describedby="errors.topic ? 'topic-error' : undefined">
          <legend class="sr-only">¿De qué trata tu testimonio?</legend>
          <div v-if="categoriesError" class="flex flex-wrap items-center gap-3 rounded-xl bg-fg/5 px-4 py-3 text-sm" role="alert">
            <span>No pudimos cargar las categorías.</span>
            <button type="button" class="font-semibold text-accent-ink hover:underline" @click="loadCategories">Reintentar</button>
          </div>
          <div v-else-if="!categories.length" class="grid grid-cols-1 gap-2 @xl:grid-cols-3" aria-hidden="true">
            <span v-for="n in 3" :key="n" class="h-16 animate-pulse rounded-xl bg-fg/10" />
          </div>
          <div v-else class="grid grid-cols-1 gap-2 @xl:grid-cols-3">
            <label
              v-for="meta in categories"
              :key="meta.slug"
              :title="meta.description ?? undefined"
              class="relative flex cursor-pointer items-center gap-2.5 rounded-2xl border-2 px-3 py-2.5 transition-[translate,box-shadow,border-color] has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-blue"
              :class="draft.topic === meta.slug ? '-translate-y-px border-ink bg-card shadow-brut' : 'border-ink/30 bg-card hover:border-ink'"
            >
              <input v-model="draft.topic" type="radio" name="topic" :value="meta.slug" class="sr-only" />
              <span class="grid size-9 shrink-0 place-items-center rounded-full border-2 border-black" :style="{ backgroundColor: meta.color, color: meta.ink }">
                <CategoryIcon :category="meta.slug" class="size-4" />
              </span>
              <span class="text-sm leading-tight font-bold">{{ meta.label }}</span>
            </label>
          </div>
          <p v-if="selectedDescription" class="mt-2 text-xs text-fg/60">{{ selectedDescription }}</p>
          <p v-if="errors.topic" id="topic-error" class="mt-2 text-sm text-danger">{{ errors.topic }}</p>
        </fieldset>

        <FormField
          id="title"
          v-slot="field"
          label="Título corto"
          required
          hint="Una frase que resuma lo que pasa. Se mostrará en el mapa y en las historias."
          help="Describe el hecho, no una conclusión. Evita nombres de personas."
          example="Apagones diarios en la escuela de San Pedro"
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
      </section>

      <section class="space-y-5">
        <h3 class="form-group-title">Identificación</h3>
        <ChoiceGroup
          v-model="visibility"
          label="¿Cómo deseas aparecer?"
          :options="visibilityOptions"
          :columns="2"
          help="Con tu nombre, se muestra solo si además autorizas publicarlo con nombre (paso de consentimiento). Anónimo: tu nombre no aparece en ningún lado público."
        />
        <div class="grid gap-5 @xl:grid-cols-3 @xl:items-end">
          <FormField id="date" v-slot="field" label="Fecha" required :error="errors.date" help="El día en que se recoge el testimonio (no necesariamente cuando ocurrió el hecho; eso va en el relato).">
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
          <FormField
            id="name"
            v-slot="field"
            label="Nombre"
            :required="draft.visibility === 'nombre'"
            :optional="draft.visibility === 'anonimo'"
            :error="errors.name"
          >
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
          <FormField id="facilitator" v-slot="field" label="Facilitador/a" optional help="Si alguien te ayudó a llenar la ficha (escuchar, documentar y ordenar la evidencia), escribe su nombre.">
            <input :id="field.id" v-model="draft.facilitator" type="text" class="field-input" :maxlength="LIMITS.short" :aria-describedby="field.describedby" />
          </FormField>
        </div>
      </section>
    </div>

    <!-- Ubicación -->
    <section class="space-y-5 @3xl:sticky @3xl:top-0 @3xl:self-start">
      <h3 class="form-group-title">Ubicación</h3>
      <FormField id="coordinates" v-slot="field" label="¿Dónde ocurre?" required :error="errors.coordinates" hint="Busca el lugar, usa tu ubicación o toca el mapa. Puedes arrastrar la chincheta.">
        <LocationPicker
          v-model="draft.coordinates"
          :input-id="field.id"
          :error="errors.coordinates"
          :describedby="field.describedby"
          @located="(source, accuracy) => ((draft.locationSource = source), (draft.gpsAccuracy = accuracy))"
          @place="onPlace"
        />
      </FormField>
      <FormField id="place" v-slot="field" label="Lugar / territorio" required :error="errors.place" hint="Se completa al marcar el lugar; puedes corregirlo.">
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
      <div class="grid gap-4 @md:grid-cols-2">
        <FormField id="municipality" v-slot="field" label="Municipio" optional>
          <input :id="field.id" v-model="draft.municipality" type="text" class="field-input" :maxlength="LIMITS.short" :aria-describedby="field.describedby" />
        </FormField>
        <FormField id="state" v-slot="field" label="Estado" optional>
          <input :id="field.id" v-model="draft.state" type="text" class="field-input" :maxlength="LIMITS.short" :aria-describedby="field.describedby" />
        </FormField>
      </div>
    </section>
  </div>
</template>
