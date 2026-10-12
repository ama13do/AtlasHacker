<script setup lang="ts">
import { computed, ref } from 'vue'
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { Visibility } from '@testimonies/types/testimony'
import CategoryIcon from '@testimonies/components/CategoryIcon.vue'
import ChoiceGroup, { type Choice } from '@testimonies/components/form/ChoiceGroup.vue'
import FormField from '@testimonies/components/form/FormField.vue'
import LocationPicker from '@testimonies/components/form/LocationPicker.vue'

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
  <div class="grid gap-8 lg:grid-cols-[3fr_2fr] lg:gap-10">
    <!-- Columna principal -->
    <div class="space-y-8">
      <section class="space-y-5">
        <h3 class="form-group-title">Categoría</h3>
        <fieldset :aria-describedby="errors.topic ? 'topic-error' : undefined">
          <legend class="sr-only">¿De qué trata tu testimonio?</legend>
          <div v-if="categoriesError" class="flex flex-wrap items-center gap-3 rounded-xl bg-fg/5 px-4 py-3 text-sm" role="alert">
            <span>No pudimos cargar las categorías.</span>
            <button type="button" class="font-semibold text-accent-ink hover:underline" @click="loadCategories">Reintentar</button>
          </div>
          <div v-else-if="!categories.length" class="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-hidden="true">
            <span v-for="n in 3" :key="n" class="h-16 animate-pulse rounded-xl bg-fg/10" />
          </div>
          <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label
              v-for="meta in categories"
              :key="meta.slug"
              :title="meta.description ?? undefined"
              class="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-fg"
              :class="draft.topic === meta.slug ? ['bg-fg/5', meta.ring, 'ring-2', 'border-transparent'] : 'border-fg/20 hover:border-fg/40'"
            >
              <input v-model="draft.topic" type="radio" name="topic" :value="meta.slug" class="sr-only" />
              <span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface ring-2" :class="[meta.ring, meta.text, meta.chip]">
                <CategoryIcon :category="meta.slug" class="size-4" />
              </span>
              <span class="text-sm leading-tight font-semibold">{{ meta.label }}</span>
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
      </section>

      <section class="space-y-5">
        <h3 class="form-group-title">Identificación</h3>
        <ChoiceGroup v-model="visibility" label="¿Cómo deseas aparecer?" :options="visibilityOptions" :columns="2" />
        <div class="grid gap-5 sm:grid-cols-3 sm:items-end">
          <FormField id="date" v-slot="field" label="Fecha" required :error="errors.date">
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
          <FormField id="facilitator" v-slot="field" label="Facilitador/a" optional>
            <input :id="field.id" v-model="draft.facilitator" type="text" class="field-input" :maxlength="LIMITS.short" :aria-describedby="field.describedby" />
          </FormField>
        </div>
      </section>
    </div>

    <!-- Ubicación -->
    <section class="space-y-5 lg:sticky lg:top-0 lg:self-start">
      <h3 class="form-group-title">Ubicación</h3>
      <FormField id="place" v-slot="field" label="Lugar / territorio" required :error="errors.place">
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
      <FormField id="coordinates" v-slot="field" label="Ubicación en el mapa" required :error="errors.coordinates">
        <LocationPicker v-model="draft.coordinates" :error="errors.coordinates" :describedby="field.describedby" />
      </FormField>
    </section>
  </div>
</template>
