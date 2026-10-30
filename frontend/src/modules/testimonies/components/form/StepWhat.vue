<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { classifyFacts, FACTS, SUBCATEGORY_LABELS, type FactKey } from '@testimonies/data/facts'
import { useCategoriesStore } from '@testimonies/stores/categories'
import CategoryIcon from '@testimonies/components/CategoryIcon.vue'
import FactIcon from '@testimonies/components/form/FactIcon.vue'
import FieldHelp from '@testimonies/components/form/FieldHelp.vue'

const { draft, errors } = useTestimonyFormContext()

// Las categorías siguen viniendo de la API: aquí solo se muestra la que se asigna sola
const categoriesStore = useCategoriesStore()
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

// Se tocan en orden: el primero es el principal; tocar uno elegido lo quita
function toggleFact(fact: FactKey) {
  draft.facts = draft.facts.includes(fact) ? draft.facts.filter((f) => f !== fact) : [...draft.facts, fact]
}
const classified = computed(() => classifyFacts(draft.facts))
const assigned = computed(() => (classified.value ? categoriesStore.bySlug(classified.value.category) : null))
</script>

<template>
  <fieldset class="space-y-4" :aria-describedby="errors.facts ? 'facts-error' : undefined">
    <legend class="sr-only">¿Qué pasa? Elige una o varias opciones</legend>
    <FieldHelp
      label="¿Cuál elijo?"
      help="Toca lo que más se parece a tu caso, y si pasa algo más, tócalo también. La primera que toques es la principal (en amarillo) y las demás se marcan en rosa. Con la principal se asigna la categoría del atlas (inseguridad energética, cambio climático o megaproyectos). Si elegiste una por error, tócala otra vez para quitarla."
    />
    <div class="grid grid-cols-2 gap-2 @xl:grid-cols-4">
      <label
        v-for="fact in FACTS"
        :key="fact.key"
        class="relative flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 px-2 pt-5 pb-3 text-center transition-[translate,box-shadow,border-color] has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-blue"
        :class="
          draft.facts[0] === fact.key
            ? 'on-light -translate-y-px border-ink bg-neon-lime text-black shadow-brut'
            : draft.facts.includes(fact.key)
              ? 'on-light -translate-y-px border-ink bg-brand-pink text-black shadow-brut-sm'
              : 'border-ink/30 bg-card hover:border-ink'
        "
      >
        <input
          type="checkbox"
          class="sr-only"
          :checked="draft.facts.includes(fact.key)"
          :aria-label="`${fact.label}${draft.facts[0] === fact.key ? ' (principal)' : ''}`"
          @change="toggleFact(fact.key)"
        />
        <span
          v-if="draft.facts.includes(fact.key)"
          class="absolute top-1.5 left-1/2 -translate-x-1/2 rounded-full px-2 text-[10px] leading-4 font-black uppercase"
          :class="draft.facts[0] === fact.key ? 'bg-black text-neon-lime' : 'bg-black text-brand-pink'"
          aria-hidden="true"
        >
          {{ draft.facts[0] === fact.key ? 'Principal' : 'También' }}
        </span>
        <FactIcon :fact="fact.key" class="size-10" />
        <span class="text-sm leading-tight font-bold">{{ fact.label }}</span>
      </label>
    </div>

    <!-- Categoría que se asigna sola -->
    <div v-if="categoriesError" class="flex flex-wrap items-center gap-3 rounded-xl bg-fg/5 px-4 py-3 text-sm" role="alert">
      <span>No pudimos cargar las categorías.</span>
      <button type="button" class="font-semibold text-accent-ink hover:underline" @click="loadCategories">Reintentar</button>
    </div>
    <p v-else-if="classified && assigned" class="flex items-start gap-2.5 text-sm" role="status">
      <span class="grid size-8 shrink-0 place-items-center rounded-full border-2 border-black" :style="{ backgroundColor: assigned.color, color: assigned.ink }">
        <CategoryIcon :category="assigned.slug" class="size-4" />
      </span>
      <span class="min-w-0 leading-snug">
        <span class="block text-xs text-fg/60">Categoría del atlas (se asigna sola)</span>
        <span class="font-bold">{{ assigned.label }}</span>
        <span class="text-fg/75"> › {{ SUBCATEGORY_LABELS[classified.subcategory] }}</span>
      </span>
    </p>
    <p v-if="errors.facts" id="facts-error" class="text-sm text-danger">{{ errors.facts }}</p>
  </fieldset>
</template>
