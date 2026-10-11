import { TESTIMONIES_MOCK } from '@testimonies/data/testimonies.mock'
import type { CreateTestimonyResult, Testimony, TestimonyDraft } from '@testimonies/types/testimony'
import { isPublishable } from '@testimonies/utils/publication'

const FOLIO_PREFIX = 'FUTURO/001'
const FAKE_LATENCY = 600

// Testimonios creados en esta sesión (simula la base de datos mientras no hay API)
const created: Testimony[] = []
let lastNumber = Math.max(...TESTIMONIES_MOCK.map((t) => Number(t.folio.split('-T')[1])))

const pad = (n: number) => String(n).padStart(4, '0')
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// TODO: reemplazar el mock por la API cuando exista, p. ej.:
//   const { data } = await http.get<Testimony[]>('/testimonies')  // http de '@/core/http/client'
//   create → http.post('/testimonies', formData) con los archivos en multipart
export const testimoniesService = {
  async getAll(): Promise<Testimony[]> {
    return structuredClone([...TESTIMONIES_MOCK, ...created])
  },

  async getPopular(limit = 8): Promise<Testimony[]> {
    const all = await this.getAll()
    return all.sort((a, b) => b.supports - a.supports).slice(0, limit)
  },

  async create(draft: TestimonyDraft): Promise<CreateTestimonyResult> {
    await wait(FAKE_LATENCY)

    const number = ++lastNumber
    const hasEvidence = draft.documentStatus === 'si' || draft.files.length > 0
    const evidenceFolio = hasEvidence ? `${FOLIO_PREFIX}-E${pad(number)}` : null
    const anonymous = draft.visibility === 'anonimo' || draft.consent === 'publico-anonimo'

    const testimony: Testimony = {
      id: `t-${pad(number)}`,
      folio: `${FOLIO_PREFIX}-T${pad(number)}`,
      date: draft.date,
      place: draft.place.trim(),
      // Copias planas: el borrador llega como proxy reactivo y structuredClone no lo acepta
      coordinates: [draft.coordinates![0], draft.coordinates![1]],
      author: anonymous ? { visibility: 'anonimo' } : { visibility: 'nombre', name: draft.name.trim() },
      topic: draft.topic!,
      title: draft.title.trim(),
      testimony: draft.testimony.trim(),
      territory: draft.territory.trim(),
      community: draft.community.trim(),
      document: {
        status: draft.documentStatus ?? 'no',
        folio: evidenceFolio ?? undefined,
        description: draft.documentDescription.trim() || undefined,
      },
      data: draft.dataText.trim()
        ? {
            text: draft.dataText.trim(),
            source: draft.dataSource.trim() || undefined,
            year: draft.dataYear ? Number(draft.dataYear) : undefined,
            pendingVerification: draft.dataPendingVerification,
          }
        : undefined,
      tribunalQuestion: draft.tribunalQuestion.trim(),
      evidence: [...draft.evidence],
      supports: 0,
    }

    const published = isPublishable(draft)
    if (published) created.push(testimony)

    return { testimony: structuredClone(testimony), evidenceFolio, published }
  },
}
