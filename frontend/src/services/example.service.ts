import http from './http'

export interface Example {
  id: number
  name: string
}

const RESOURCE = '/examples'

export const exampleService = {
  async getAll(): Promise<Example[]> {
    const { data } = await http.get<Example[]>(RESOURCE)
    return data
  },

  async getById(id: number): Promise<Example> {
    const { data } = await http.get<Example>(`${RESOURCE}/${id}`)
    return data
  },
}
