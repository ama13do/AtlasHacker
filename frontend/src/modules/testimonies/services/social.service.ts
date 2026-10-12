import http, { type ApiResponse } from '@/core/http/client'
import { fromComment, fromReactionCounts } from '@testimonies/services/mappers'
import type { ApiComentario, ApiComentarioCreado, ApiReaccionRespuesta, ApiTipoReaccion } from '@testimonies/types/api'
import type { Comment, ReactionType } from '@testimonies/types/testimony'

// Reacciones y comentarios. "Uno por dispositivo" usa la cabecera X-Device-Id (la pone el cliente http)

const COMMENTS_PAGE = 20

const base = (id: string) => `/api/testimonios/${encodeURIComponent(id)}`

function fromReactionResponse(r: ApiReaccionRespuesta) {
  return { counts: fromReactionCounts(r.reacciones_conteo), total: r.reacciones_total }
}

export const socialService = {
  async myReactions(id: string): Promise<ReactionType[]> {
    const { data } = await http.get<ApiResponse<ApiTipoReaccion[]>>(`${base(id)}/reacciones/mias`)
    return data.data
  },

  async react(id: string, type: ReactionType) {
    const { data } = await http.post<ApiResponse<ApiReaccionRespuesta>>(`${base(id)}/reacciones`, { tipo: type })
    return fromReactionResponse(data.data)
  },

  async unreact(id: string, type: ReactionType) {
    const { data } = await http.delete<ApiResponse<ApiReaccionRespuesta>>(`${base(id)}/reacciones/${type}`)
    return fromReactionResponse(data.data)
  },

  // Más antiguos primero; `cursor` = siguiente página
  async listComments(id: string, cursor?: string | null): Promise<{ items: Comment[]; cursor: string | null }> {
    const { data } = await http.get<ApiResponse<ApiComentario[]> & { siguiente_cursor: string | null }>(`${base(id)}/comentarios`, {
      params: { limite: COMMENTS_PAGE, ...(cursor ? { cursor } : {}) },
    })
    return { items: data.data.map(fromComment), cursor: data.siguiente_cursor }
  },

  // Con captcha; si la persona tiene folio se liga a ella. `visible` = false → queda en moderación
  async addComment(
    id: string,
    comment: { text: string; author?: string },
    auth: { captchaToken?: string | null; folio?: string | null } = {},
  ): Promise<{ comment: Comment; visible: boolean }> {
    const headers: Record<string, string> = {}
    if (auth.captchaToken) headers['X-Captcha-Token'] = auth.captchaToken
    if (auth.folio) headers['X-Folio'] = auth.folio
    const body = { contenido: comment.text.trim(), ...(comment.author?.trim() ? { autor_nombre: comment.author.trim() } : {}) }
    const { data } = await http.post<ApiResponse<ApiComentarioCreado>>(`${base(id)}/comentarios`, body, { headers })
    return { comment: fromComment({ ...data.data, le_di_like: false }), visible: data.data.visible }
  },

  async likeComment(commentId: string): Promise<number> {
    const { data } = await http.post<ApiResponse<{ likes_conteo: number }>>(`/api/comentarios/${encodeURIComponent(commentId)}/likes`)
    return data.data.likes_conteo
  },

  async unlikeComment(commentId: string): Promise<number> {
    const { data } = await http.delete<ApiResponse<{ likes_conteo: number }>>(`/api/comentarios/${encodeURIComponent(commentId)}/likes`)
    return data.data.likes_conteo
  },
}
