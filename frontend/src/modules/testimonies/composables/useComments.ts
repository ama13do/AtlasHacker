import { ref } from 'vue'
import { socialService } from '@testimonies/services/social.service'
import type { LoadStatus } from '@testimonies/stores/testimonies'
import type { Comment } from '@testimonies/types/testimony'

// Comentarios de un testimonio (paginados por cursor, más antiguos primero)
export function useComments(testimonyId: string, service = socialService) {
  const items = ref<Comment[]>([])
  const cursor = ref<string | null>(null)
  const status = ref<LoadStatus>('idle')
  const loadingMore = ref(false)

  async function load() {
    status.value = 'loading'
    try {
      const page = await service.listComments(testimonyId)
      items.value = page.items
      cursor.value = page.cursor
      status.value = 'ready'
    } catch (e) {
      console.error(e)
      status.value = 'error'
    }
  }

  async function loadMore() {
    if (!cursor.value || loadingMore.value) return
    loadingMore.value = true
    try {
      const page = await service.listComments(testimonyId, cursor.value)
      items.value.push(...page.items)
      cursor.value = page.cursor
    } catch (e) {
      console.error(e)
    } finally {
      loadingMore.value = false
    }
  }

  // Devuelve si quedó visible (si no, espera moderación). Los errores los maneja quien llama
  async function add(comment: { text: string; author?: string }, auth: Parameters<typeof service.addComment>[2]) {
    const result = await service.addComment(testimonyId, comment, auth)
    // Si aún hay más páginas, el nuevo aparecerá al final cuando se carguen
    if (result.visible && !cursor.value) items.value.push(result.comment)
    return result.visible
  }

  // Optimista: se revierte si falla
  async function toggleLike(comment: Comment) {
    const liked = comment.likedByMe
    comment.likedByMe = !liked
    comment.likes = Math.max(0, comment.likes + (liked ? -1 : 1))
    try {
      comment.likes = liked ? await service.unlikeComment(comment.id) : await service.likeComment(comment.id)
    } catch (e) {
      console.error(e)
      comment.likedByMe = liked
      comment.likes = Math.max(0, comment.likes + (liked ? 1 : -1))
    }
  }

  return { items, cursor, status, loadingMore, load, loadMore, add, toggleLike }
}
