import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { testimoniesService } from '@testimonies/services/testimonies.service'
import type { Testimony } from '@testimonies/types/testimony'

const POPULAR_LIMIT = 8

export const useTestimoniesStore = defineStore('testimonies', () => {
  const items = ref<Testimony[]>([])
  const loading = ref(false)
  const selectedId = ref<string | null>(null)
  // Índice dentro de `popular`; null = visor de historias cerrado
  const storyIndex = ref<number | null>(null)

  const popular = computed(() =>
    [...items.value].sort((a, b) => b.supports - a.supports).slice(0, POPULAR_LIMIT),
  )
  const selected = computed(() => items.value.find((t) => t.id === selectedId.value) ?? null)

  async function load() {
    loading.value = true
    try {
      items.value = await testimoniesService.getAll()
    } finally {
      loading.value = false
    }
  }

  function select(id: string | null) {
    selectedId.value = id
  }

  function openStory(index: number) {
    storyIndex.value = index
  }

  function closeStory() {
    storyIndex.value = null
  }

  return { items, loading, selectedId, storyIndex, popular, selected, load, select, openStory, closeStory }
})
