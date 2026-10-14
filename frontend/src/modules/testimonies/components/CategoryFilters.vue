<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'

// Leyenda del mapa que también filtra: cada categoría con su color y cuántos testimonios hay.
// Sin ninguna elegida se ven todas
// `scroll`: en una sola fila (con desplazamiento horizontal)
defineProps<{ scroll?: boolean }>()

const store = useTestimoniesStore()
const { categoryFilter, categoryCounts } = storeToRefs(store)
const categoriesStore = useCategoriesStore()

const options = computed(() =>
  categoriesStore.categories.map((c) => ({ ...categoriesStore.bySlug(c.slug), count: categoryCounts.value[c.slug] ?? 0 })),
)
</script>

<template>
  <div class="flex gap-1.5" :class="scroll ? 'w-max flex-nowrap' : 'flex-wrap'" role="group" aria-label="Filtrar por categoría">
    <button type="button" class="chip-toggle" :aria-pressed="!categoryFilter.length" @click="categoryFilter = []">Todas</button>
    <button
      v-for="o in options"
      :key="o.slug"
      type="button"
      class="chip-toggle normal-case"
      :aria-pressed="categoryFilter.includes(o.slug)"
      :title="o.description ?? undefined"
      @click="store.toggleCategory(o.slug)"
    >
      <span class="size-3 shrink-0 rounded-full border-2 border-black" :style="{ backgroundColor: o.color }" aria-hidden="true" />
      {{ o.label }}
      <span class="tabular-nums opacity-60">{{ o.count }}</span>
    </button>
  </div>
</template>
