import { adminGet, adminRequest } from '@admin/services/adminHttp'
import type { ApiEditarParticipante, ApiParticipanteDetalle, ApiParticipanteResumen, ApiTestimonioStaffFila, PaginaMeta } from '@admin/types/api'

export interface PeopleFilters {
  correo?: string
  telefono?: string
  folio_pista?: string
  pagina: number
  por_pagina: number
}

const base = (id: string) => `/api/admin/participantes/${encodeURIComponent(id)}`
const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))
const pageMeta = (meta: Record<string, unknown>, pagina: number, por_pagina: number): PaginaMeta => {
  const total = Number(meta.total ?? 0)
  return { total, pagina, por_pagina, paginas: Math.ceil(total / por_pagina) }
}

export const adminPeopleService = {
  // Búsqueda por índice ciego: no devuelve datos personales
  async search(filters: PeopleFilters): Promise<{ rows: ApiParticipanteResumen[]; meta: PaginaMeta }> {
    const { data, meta } = await adminGet<ApiParticipanteResumen[]>('/api/admin/participantes', clean(filters))
    return { rows: data, meta: pageMeta(meta, filters.pagina, filters.por_pagina) }
  },

  // Descifra los datos personales: cada consulta queda en la bitácora
  async get(id: string): Promise<ApiParticipanteDetalle> {
    return (await adminGet<ApiParticipanteDetalle>(base(id))).data
  },

  async testimonies(id: string, pagina: number, por_pagina = 10): Promise<{ rows: ApiTestimonioStaffFila[]; meta: PaginaMeta }> {
    const { data, meta } = await adminGet<ApiTestimonioStaffFila[]>(`${base(id)}/testimonios`, { pagina, por_pagina })
    return { rows: data, meta: pageMeta(meta, pagina, por_pagina) }
  },

  // Rectificación; `null` borra el dato. `activo: false` desactiva el folio
  async update(id: string, changes: ApiEditarParticipante): Promise<ApiParticipanteResumen> {
    return (await adminRequest<ApiParticipanteResumen>({ method: 'patch', url: base(id), data: changes })).data
  },

  // Folio nuevo (se muestra una sola vez); el anterior deja de funcionar
  async rotateFolio(id: string): Promise<string> {
    return (await adminRequest<{ folio: string }>({ method: 'post', url: `${base(id)}/rotar-folio` })).data.folio
  },

  // Derecho de cancelación (solo admin). Los testimonios no se borran
  async cancelData(id: string, anonymize: boolean) {
    await adminRequest({ method: 'delete', url: `${base(id)}/datos-personales`, params: { anonimizar_testimonios: String(anonymize) } })
  },

  // Persona nueva con su folio (una sola vez)
  async create(input: { nombre?: string; contacto?: { correo?: string; telefono?: string } }): Promise<{ id: string; folio: string }> {
    return (await adminRequest<{ id: string; folio: string }>({ method: 'post', url: '/api/admin/participantes', data: input })).data
  },
}
