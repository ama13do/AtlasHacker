import type { SupabaseClient } from '@supabase/supabase-js'

// Cliente de Supabase solo para escuchar Realtime. Se carga bajo demanda (import dinámico)
// para no sumar la librería al bundle inicial. La anon key es pública; nunca usar la service_role
const URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let client: Promise<SupabaseClient> | null = null

export const realtimeConfigured = Boolean(URL && ANON_KEY)

export function getSupabase(): Promise<SupabaseClient> {
  if (!realtimeConfigured) return Promise.reject(new Error('Supabase no configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)'))
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }),
  )
  return client
}
