/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  // Google Analytics 4 (G-XXXXXXXXXX). Sin ella no se carga la analítica
  readonly VITE_GA_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
