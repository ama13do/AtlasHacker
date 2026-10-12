import axios from 'axios'
import http, { type ApiError, type ApiResponse } from '@/core/http/client'
import type { ApiEvidenciaConfirmada, ApiReservaEvidencias } from '@testimonies/types/api'
import type { EvidenceAttachment } from '@testimonies/types/testimony'

// Evidencias de un testimonio propio (requieren el folio de participante en X-Folio).
// Flujo: reservar → PUT directo a R2 con la URL firmada → confirmar

export interface Reservation {
  evidenceId: string
  folio: string
  url: string
  contentType: string
  expiresAt: number // ms
}

const folioHeader = (folio: string) => ({ 'X-Folio': folio })

export const evidenceService = {
  async reserve(testimonyId: string, folio: string, attachments: EvidenceAttachment[]): Promise<Reservation[]> {
    const { data } = await http.post<ApiResponse<ApiReservaEvidencias>>(
      `/api/mis-testimonios/${encodeURIComponent(testimonyId)}/evidencias`,
      { archivos: attachments.map((a) => ({ nombre: a.file.name.slice(0, 200), mime: a.file.type, bytes: a.file.size, tipo: a.type })) },
      { headers: folioHeader(folio) },
    )
    // La API responde en el mismo orden en que se pidieron
    return data.data.archivos.map((r) => ({
      evidenceId: r.evidencia_id,
      folio: r.folio,
      url: r.subir.url,
      contentType: r.subir.cabeceras['Content-Type'] ?? '',
      expiresAt: Date.now() + r.subir.expira_en_segundos * 1000,
    }))
  },

  // Directo a R2 (otro host): sin la instancia `http`. Content-Length lo pone el navegador
  async put(reservation: Reservation, file: File, onProgress: (ratio: number) => void): Promise<void> {
    try {
      await axios.put(reservation.url, file, {
        headers: { 'Content-Type': reservation.contentType || file.type },
        onUploadProgress: (e) => e.total && onProgress(e.loaded / e.total),
        timeout: 0,
      })
    } catch (error) {
      // Error de red o CORS del bucket: sin respuesta legible
      const status = axios.isAxiosError(error) ? (error.response?.status ?? null) : null
      throw { status, code: 'SUBIDA_FALLIDA', message: 'No se pudo subir el archivo.' } satisfies ApiError
    }
  },

  async confirm(testimonyId: string, evidenceId: string, folio: string): Promise<ApiEvidenciaConfirmada> {
    const { data } = await http.post<ApiResponse<ApiEvidenciaConfirmada>>(
      `/api/mis-testimonios/${encodeURIComponent(testimonyId)}/evidencias/${encodeURIComponent(evidenceId)}/confirmar`,
      undefined,
      { headers: folioHeader(folio) },
    )
    return data.data
  },
}
