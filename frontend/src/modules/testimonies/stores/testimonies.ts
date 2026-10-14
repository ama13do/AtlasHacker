import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ApiError } from '@/core/http/client'
import { MEXICO_STATES, stateAt } from '@map/utils/geo'
import { socialService } from '@testimonies/services/social.service'
import { testimoniesService } from '@testimonies/services/testimonies.service'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { ReactionType, TestimonyDetail, TestimonyDraft, TestimonySummary } from '@testimonies/types/testimony'

const POPULAR_LIMIT = 8

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

const messageOf = (error: unknown) => (error as Partial<ApiError>)?.message ?? 'Error desconocido'

export const useTestimoniesStore = defineStore('testimonies', () => {
  const items = ref<TestimonySummary[]>([])
  // Expediente (mapa) cargado; los pines y los envíos son de este expediente
  const dossier = ref<string | null>(null)
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  const truncated = ref(false)

  // Fichas completas ya pedidas (GET /api/testimonios/{id})
  const details = ref<Record<string, TestimonyDetail>>({})
  const detailStatus = ref<Record<string, LoadStatus>>({})

  // Reacciones que este dispositivo ya dio, por testimonio
  const myReactions = ref<Record<string, ReactionType[]>>({})
  // Reacciones con una petición en curso (`id:tipo`): no se aceptan más clics hasta que responda,
  // así dos clics rápidos no se pisan (antes el contador «brincaba» y quedaba desincronizado)
  const pendingReactions = ref<Set<string>>(new Set())

  // Testimonio bajo el cursor en la lista (se resalta su pin en el mapa)
  const hoveredId = ref<string | null>(null)
  // Orden de la lista
  const sortBy = ref<'recientes' | 'reacciones'>('recientes')

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
  // Estado elegido en el mapa (ISO 3166-2, p. ej. MX-JAL); null = todo México
  const selectedState = ref<string | null>(null)
  const selectedStateName = computed(() => MEXICO_STATES.find((s) => s.code === selectedState.value)?.name ?? null)
  // Estado de cada testimonio (se calcula una vez por id)
  const stateById = new Map<string, string | null>()
  const stateOf = (t: TestimonySummary) => {
    if (!stateById.has(t.id)) stateById.set(t.id, stateAt(t.coordinates)?.code ?? null)
    return stateById.get(t.id)
  }
  // Filtros de la vista: categorías elegidas (vacío = todas) y texto (título, lugar o folio)
  const categoryFilter = ref<string[]>([])
  const query = ref('')
  const normalize = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const inState = computed(() =>
    selectedState.value ? items.value.filter((t) => stateOf(t) === selectedState.value) : items.value,
  )
  const filteredItems = computed(() => {
    const q = normalize(query.value.trim())
    return inState.value.filter(
      (t) =>
        (!categoryFilter.value.length || categoryFilter.value.includes(t.category)) &&
        (!q || normalize(`${t.title} ${t.place} ${t.folio}`).includes(q)),
    )
  })
  // Cuántos hay de cada categoría en la zona visible (para la leyenda)
  const categoryCounts = computed(() => {
    const counts: Record<string, number> = {}
    for (const t of inState.value) counts[t.category] = (counts[t.category] ?? 0) + 1
    return counts
  })

  function toggleCategory(slug: string) {
    categoryFilter.value = categoryFilter.value.includes(slug)
      ? categoryFilter.value.filter((c) => c !== slug)
      : [...categoryFilter.value, slug]
  }

  function clearFilters() {
    categoryFilter.value = []
    query.value = ''
  }

  function selectState(code: string | null) {
    selectedState.value = code && MEXICO_STATES.some((s) => s.code === code) ? code : null
  }

  const recent = computed(() =>
    [...filteredItems.value].sort((a, b) =>
      sortBy.value === 'reacciones' ? b.reactions - a.reactions || b.date.localeCompare(a.date) : b.date.localeCompare(a.date),
    ),
  )
  const selected = computed(() => items.value.find((t) => t.id === selectedId.value) ?? null)
  const selectedDetail = computed(() => (selectedId.value ? (details.value[selectedId.value] ?? null) : null))

  // Cambiar de mapa: se limpia lo del anterior y se cargan los pines del nuevo
  async function useDossier(code: string) {
    if (dossier.value === code && status.value !== 'error') return
    dossier.value = code
    items.value = []
    selectedId.value = null
    storyIndex.value = null
    selectedState.value = null
    stateById.clear()
    clearFilters()
    await load()
  }

  async function load() {
    status.value = 'loading'
    error.value = null
    try {
      const [summaries] = await Promise.all([
        testimoniesService.getSummaries(dossier.value ?? undefined),
        useCategoriesStore().load(),
      ])
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
    // Sin configuración todavía se asume habilitado (antes, si /api/config no había llegado, nunca se pedían
    // y las reacciones ya dadas aparecían apagadas: al tocarlas parecía que sumaban y luego «regresaban»)
    if (myReactions.value[id] || useCategoriesStore().config?.reactionsEnabled === false) return
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
    const key = `${id}:${type}`
    if (!detail || pendingReactions.value.has(key)) return
    pendingReactions.value = new Set(pendingReactions.value).add(key)
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
    } finally {
      const next = new Set(pendingReactions.value)
      next.delete(key)
      pendingReactions.value = next
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
    const result = await testimoniesService.create(draft, auth, dossier.value ?? undefined)
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
    if (storyIndex.value === null) {
      stories.value = [...popular.value]
      selectedId.value = null
    }
    storyIndex.value = index
    const story = stories.value[index]
    if (story) loadDetail(story.id)
  }

  function closeStory() {
    storyIndex.value = null
  }

  return {
    items,
    dossier,
    useDossier,
    status,
    error,
    truncated,
    details,
    detailStatus,
    myReactions,
    pendingReactions,
    hoveredId,
    sortBy,
    selectedId,
    storyIndex,
    stories,
    selectedState,
    selectedStateName,
    filteredItems,
    categoryFilter,
    query,
    categoryCounts,
    toggleCategory,
    clearFilters,
    selectState,
    stateOf,
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
