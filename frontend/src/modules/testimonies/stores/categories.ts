import { ref } from 'vue'
import { defineStore } from 'pinia'
import { categoryStyle, type CategoryStyle } from '@testimonies/data/categories'
import { testimoniesService, type PublicConfig } from '@testimonies/services/testimonies.service'
import type { Category, CategorySlug } from '@testimonies/types/testimony'

export type CategoryMeta = Category & CategoryStyle

// Categorías y configuración pública (GET /api/config): se cargan una vez por sesión
export const useCategoriesStore = defineStore('testimonies/categories', () => {
  const categories = ref<Category[]>([])
  const config = ref<PublicConfig | null>(null)
  let pending: Promise<void> | null = null

  function load() {
    pending ??= testimoniesService
      .getConfig()
      .then((result) => {
        config.value = result
        categories.value = result.categories
      })
      .catch((error) => {
        pending = null // Permite reintentar
        throw error
      })
    return pending
  }

  // Nombre de la API + estilo de marca; tolera slugs que aún no están cargados
  function bySlug(slug: CategorySlug): CategoryMeta {
    const category = categories.value.find((c) => c.slug === slug) ?? {
      slug,
      label: slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      description: null,
    }
    return { ...category, ...categoryStyle(slug) }
  }

  return { categories, config, load, bySlug }
})
