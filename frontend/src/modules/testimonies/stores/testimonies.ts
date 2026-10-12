import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ApiError } from '@/core/http/client'
import { socialService } from '@testimonies/services/social.service'
import { testimoniesService } from '@testimonies/services/testimonies.service'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { ReactionType, TestimonyDetail, TestimonyDraft, TestimonySummary } from '@testimonies/types/testimony'

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

  // Reacciones que este dispositivo ya dio, por testimonio
  const myReactions = ref<Record<string, ReactionType[]>>({})

  const selectedId = ref<string | null>(null)
  // Índice dentro de `stories`; null = visor de historias cerrado
  const storyIndex = ref<number | null>(null)
  // Copia de `popular` al abrir el visor: reaccionar no debe reordenar las historias mientras se ven
  const stories = ref<TestimonySummary[]>([])

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
      loadMyReactions(id)
    } catch (e) {
      console.error(e)
      detailStatus.value[id] = 'error'
    }
  }

  async function loadMyReactions(id: string) {
    if (myReactions.value[id] || !useCategoriesStore().config?.reactionsEnabled) return
    try {
      myReactions.value[id] = await socialService.myReactions(id)
    } catch (e) {
      console.error(e)
    }
  }

  // Conteos en la ficha y en el resumen (el total ordena las populares)
  function setReactionCounts(id: string, counts: Record<ReactionType, number>, total: number) {
    const detail = details.value[id]
    if (detail) Object.assign(detail, { reactionCounts: counts, reactions: total })
    const summary = items.value.find((t) => t.id === id)
    if (summary) summary.reactions = total
  }

  // Optimista: se refleja al instante y se revierte si la API falla
  async function toggleReaction(id: string, type: ReactionType) {
    const detail = details.value[id]
    if (!detail) return
    const mine = myReactions.value[id] ?? []
    const active = mine.includes(type)
    const previous = { counts: { ...detail.reactionCounts }, total: detail.reactions, mine }

    const delta = active ? -1 : 1
    myReactions.value[id] = active ? mine.filter((t) => t !== type) : [...mine, type]
    setReactionCounts(id, { ...detail.reactionCounts, [type]: Math.max(0, detail.reactionCounts[type] + delta) }, Math.max(0, detail.reactions + delta))

    try {
      const result = active ? await socialService.unreact(id, type) : await socialService.react(id, type)
      setReactionCounts(id, result.counts, result.total)
    } catch (e) {
      console.error(e)
      myReactions.value[id] = previous.mine
      setReactionCounts(id, previous.counts, previous.total)
      throw e
    }
  }

  // Tiempo real: alta/cambio de un testimonio público
  function upsertSummary(summary: TestimonySummary, detail?: TestimonyDetail) {
    const index = items.value.findIndex((t) => t.id === summary.id)
    if (index === -1) items.value.push(summary)
    else items.value[index] = summary
    if (detail && details.value[summary.id]) details.value[summary.id] = detail
  }

  // Tiempo real: el testimonio dejó de ser público
  function remove(id: string) {
    items.value = items.value.filter((t) => t.id !== id)
    invalidateDetail(id)
    if (selectedId.value === id) selectedId.value = null
  }

  async function create(draft: TestimonyDraft, auth: Parameters<typeof testimoniesService.create>[1]) {
    const result = await testimoniesService.create(draft, auth)
    if (result.published) await load()
    return result
  }

  // La ficha cambió (p. ej. nuevas evidencias): se vuelve a pedir la próxima vez
  function invalidateDetail(id: string) {
    delete details.value[id]
    delete detailStatus.value[id]
  }

  function select(id: string | null) {
    selectedId.value = id
    if (id) loadDetail(id)
  }

  function openStory(index: number) {
    if (storyIndex.value === null) stories.value = [...popular.value]
    storyIndex.value = index
    const story = stories.value[index]
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
    myReactions,
    selectedId,
    storyIndex,
    stories,
    popular,
    recent,
    selected,
    selectedDetail,
    load,
    loadDetail,
    loadMyReactions,
    toggleReaction,
    upsertSummary,
    remove,
    invalidateDetail,
    create,
    select,
    openStory,
    closeStory,
  }
})
