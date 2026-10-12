import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ApiError } from '@/core/http/client'
import { testimoniesService } from '@testimonies/services/testimonies.service'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { TestimonyDetail, TestimonyDraft, TestimonySummary } from '@testimonies/types/testimony'

const POPULAR_LIMIT = 8

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

const messageOf = (error: unknown) => (error as Partial<ApiError>)?.message ?? 'Error desconocido'

export const useTestimoniesStore = defineStore('testimonies', () => {
  const items = ref<TestimonySummary[]>([])
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  const truncated = ref(false)

  // Fichas completas ya pedidas (GET /api/testimonios/{id})
  const details = ref<Record<string, TestimonyDetail>>({})
  const detailStatus = ref<Record<string, LoadStatus>>({})

  const selectedId = ref<string | null>(null)
  // Índice dentro de `popular`; null = visor de historias cerrado
  const storyIndex = ref<number | null>(null)

  const popular = computed(() =>
    [...items.value]
      .sort((a, b) => b.reactions - a.reactions || b.date.localeCompare(a.date))
      .slice(0, POPULAR_LIMIT),
  )
  const recent = computed(() => [...items.value].sort((a, b) => b.date.localeCompare(a.date)))
  const selected = computed(() => items.value.find((t) => t.id === selectedId.value) ?? null)
  const selectedDetail = computed(() => (selectedId.value ? (details.value[selectedId.value] ?? null) : null))

  async function load() {
    status.value = 'loading'
    error.value = null
    try {
      const [summaries] = await Promise.all([testimoniesService.getSummaries(), useCategoriesStore().load()])
      items.value = summaries.items
      truncated.value = summaries.truncated
      status.value = 'ready'
    } catch (e) {
      console.error(e)
      error.value = messageOf(e)
      status.value = 'error'
    }
  }

  async function loadDetail(id: string) {
    if (details.value[id] || detailStatus.value[id] === 'loading') return
    detailStatus.value[id] = 'loading'
    try {
      details.value[id] = await testimoniesService.getDetail(id)
      detailStatus.value[id] = 'ready'
    } catch (e) {
      console.error(e)
      detailStatus.value[id] = 'error'
    }
  }

  async function create(draft: TestimonyDraft, auth: Parameters<typeof testimoniesService.create>[1]) {
    const result = await testimoniesService.create(draft, auth)
    if (result.published) await load()
    return result
  }

  function select(id: string | null) {
    selectedId.value = id
    if (id) loadDetail(id)
  }

  function openStory(index: number) {
    storyIndex.value = index
    const story = popular.value[index]
    if (story) loadDetail(story.id)
  }

  function closeStory() {
    storyIndex.value = null
  }

  return {
    items,
    status,
    error,
    truncated,
    details,
    detailStatus,
    selectedId,
    storyIndex,
    popular,
    recent,
    selected,
    selectedDetail,
    load,
    loadDetail,
    create,
    select,
    openStory,
    closeStory,
  }
})
