import { adminGet, adminRequest } from '@admin/services/adminHttp'
import type { ApiCategoriaStaff, ApiExpedienteStaff } from '@admin/types/api'

export type CategoryInput = Partial<Pick<ApiCategoriaStaff, 'slug' | 'nombre' | 'descripcion' | 'color' | 'orden' | 'activo'>>
export type CaseInput = Partial<Pick<ApiExpedienteStaff, 'codigo' | 'titulo' | 'materia' | 'descripcion' | 'activo'>>

// Categorías y expedientes (lectura: todo el equipo; escritura: solo admin)
export const catalogsService = {
  async categories(): Promise<ApiCategoriaStaff[]> {
    return (await adminGet<ApiCategoriaStaff[]>('/api/admin/categorias')).data
  },
  async createCategory(input: CategoryInput): Promise<ApiCategoriaStaff> {
    return (await adminRequest<ApiCategoriaStaff>({ method: 'post', url: '/api/admin/categorias', data: input })).data
  },
  async updateCategory(id: string, input: CategoryInput): Promise<ApiCategoriaStaff> {
    return (await adminRequest<ApiCategoriaStaff>({ method: 'patch', url: `/api/admin/categorias/${encodeURIComponent(id)}`, data: input })).data
  },

  async cases(): Promise<ApiExpedienteStaff[]> {
    return (await adminGet<ApiExpedienteStaff[]>('/api/admin/expedientes')).data
  },
  async createCase(input: CaseInput): Promise<ApiExpedienteStaff> {
    return (await adminRequest<ApiExpedienteStaff>({ method: 'post', url: '/api/admin/expedientes', data: input })).data
  },
  async updateCase(id: string, input: CaseInput): Promise<ApiExpedienteStaff> {
    return (await adminRequest<ApiExpedienteStaff>({ method: 'patch', url: `/api/admin/expedientes/${encodeURIComponent(id)}`, data: input })).data
  },
}
