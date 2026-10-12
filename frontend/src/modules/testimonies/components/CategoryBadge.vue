<script setup lang="ts">
import { computed } from 'vue'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { CategorySlug } from '@testimonies/types/testimony'
import CategoryIcon from '@testimonies/components/CategoryIcon.vue'

const props = defineProps<{ category: CategorySlug }>()
const categories = useCategoriesStore()
const meta = computed(() => categories.bySlug(props.category))
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-black"
    :class="meta.bg"
  >
    <CategoryIcon :category="category" class="size-3.5 shrink-0" />
    {{ meta.label }}
  </span>
</template>
