// Listas del panel de revisión del Excel (hoja «listas»). Las mismas valida la API (backend/src/schemas/testimonios.ts)
export const REVIEW_RIGHTS = [
  'Agua para consumo personal y doméstico',
  'Alimentación',
  'Protección de la salud',
  'Vivienda adecuada',
  'No discriminación por condición social',
] as const

export const GOVERNMENT_LABELS = {
  estatal: 'Gobierno estatal',
  municipal: 'Gobierno municipal',
  ambos: 'Ambos',
} as const

export const PUBLIC_PRECISION_LABELS = {
  estado: 'solo el estado (modo protección)',
  municipio: 'centro del municipio (megaproyecto)',
} as const
