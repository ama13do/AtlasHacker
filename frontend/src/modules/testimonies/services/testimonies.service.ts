import { TESTIMONIES_MOCK } from '@testimonies/data/testimonies.mock'
import type { Testimony } from '@testimonies/types/testimony'

// TODO: reemplazar el mock por la API cuando exista, p. ej.:
//   const { data } = await http.get<Testimony[]>('/testimonies')  // http de '@/core/http/client'
export const testimoniesService = {
  async getAll(): Promise<Testimony[]> {
    return structuredClone(TESTIMONIES_MOCK)
  },

  async getPopular(limit = 8): Promise<Testimony[]> {
    const all = await this.getAll()
    return all.sort((a, b) => b.supports - a.supports).slice(0, limit)
  },
}
