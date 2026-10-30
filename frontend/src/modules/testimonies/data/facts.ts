import type { CategorySlug } from '@testimonies/types/testimony'

// «¿Qué pasa?» (prototipo v2 del Atlas, hoja UI-MVP del Excel de obligaciones): en lugar de elegir entre
// 3 categorías, la persona toca uno o varios hechos en lenguaje cotidiano. El primero es el principal;
// de él salen la subcategoría y la categoría del atlas (las 3 de siempre)

export type FactKey =
  | 'apagones'
  | 'cortes_sin_aviso'
  | 'recibo_impagable'
  | 'sin_luz'
  | 'calor_clima'
  | 'paneles_bloqueados'
  | 'proyecto_territorio'
  | 'otro'

export type Since = 'este_anio' | 'uno_a_tres_anios' | 'mas_de_tres_anios'
export type Complaint = 'no' | 'si_sin_respuesta' | 'si_con_respuesta'
export type Threats = 'no' | 'si' | 'prefiero_no_decir'

const CLIMATE = 'CLIMA'

// Subcategoría de cada hecho (CHIPS de MVP-Datos). «Otro» no tiene; «Calor o clima extremo» depende de lo demás (R5)
export const FACTS: { key: FactKey; label: string; sub: string }[] = [
  { key: 'apagones', label: 'Apagones', sub: 'IE.APAGON' },
  { key: 'cortes_sin_aviso', label: 'Cortes sin aviso', sub: 'IE.CORTE_MANTENIMIENTO' },
  { key: 'recibo_impagable', label: 'Recibo impagable', sub: 'IE.COBRO' },
  { key: 'sin_luz', label: 'No tengo luz', sub: 'IE.SIN_CONEXION' },
  { key: 'calor_clima', label: 'Calor o clima extremo', sub: CLIMATE },
  { key: 'paneles_bloqueados', label: 'No me dejan poner paneles', sub: 'IE.GD_BLOQUEADA' },
  { key: 'proyecto_territorio', label: 'Proyecto en mi territorio', sub: 'MP.SIN_MISSE' },
  { key: 'otro', label: 'Otro', sub: '' },
]

export const FACT_KEYS = FACTS.map((f) => f.key)

export const FACT_LABELS = Object.fromEntries(FACTS.map((f) => [f.key, f.label])) as Record<FactKey, string>

// Las 22 subcategorías del Excel (etiqueta tal cual). El prefijo dice la categoría: IE, CC o MP
export const SUBCATEGORY_LABELS: Record<string, string> = {
  'IE.APAGON': 'Apagón o interrupción prolongada (no programada)',
  'IE.CORTE_MANTENIMIENTO': 'Corte por mantenimiento sin aviso o mayor a 8 horas',
  'IE.SUSPENSION_INDEBIDA': 'Corte del servicio fuera de las causas legales',
  'IE.DANO_APARATOS': 'Daño a aparatos por variaciones de voltaje',
  'IE.SIN_CONEXION': 'Sin servicio eléctrico o negativa/retraso de conexión',
  'IE.COBRO': 'Cobro excesivo, error de medición o tarifa inasequible',
  'IE.QUEJA_SIN_RESPUESTA': 'Queja ante CFE sin respuesta',
  'IE.POBREZA_ENERGETICA': 'Necesidades energéticas básicas no cubiertas',
  'IE.GD_BLOQUEADA': 'Obstáculos para instalar o interconectar paneles solares / generación distribuida',
  'CC.APAGON_CLIMATICO': 'Apagón por evento climático extremo (huracán, tormenta, ola de calor)',
  'CC.CALOR_EXTREMO': 'Calor extremo sin acceso asequible a enfriamiento o refrigeración',
  'CC.CENTRAL_FOSIL': 'Afectación por central eléctrica fósil (emisiones, falta de retiro)',
  'CC.PERDIDAS_DANOS': 'Pérdidas y daños por evento climático (vivienda, medios de vida)',
  'CC.OMISION_PLANEACION': 'Falta de planes y metas de transición (sistémica)',
  'CC.SIN_RENOVABLES_LOCALES': 'No hay programas o apoyos para renovables locales (paneles, generación comunitaria)',
  'CC.CALOR_CIUDAD': 'Calor peligroso en la ciudad o la colonia (exposición, salud)',
  'MP.SIN_CONSULTA': 'Proyecto eléctrico en territorio indígena o afromexicano sin consulta previa',
  'MP.SIN_MISSE': 'Obra iniciada sin manifestación de impacto social',
  'MP.BENEFICIOS_INCUMPLIDOS': 'Plan de gestión social o beneficios comunitarios incumplidos',
  'MP.TIERRAS': 'Presión o negociación abusiva por tierras (servidumbre, ocupación)',
  'MP.DANO_AMBIENTAL': 'Daño ambiental por proyecto eléctrico (renovable o red)',
  'MP.OBRA_RED_RETRASADA': 'Obra de transmisión o subestación necesaria retrasada',
  'MP.OPACIDAD': 'Información del proyecto no disponible',
}

const CATEGORY_BY_PREFIX: Record<string, CategorySlug> = {
  IE: 'inseguridad-energetica',
  CC: 'afectaciones-cambio-climatico',
  MP: 'megaproyectos',
}

export interface FactClassification {
  subcategory: string // Del hecho principal (p. ej. IE.APAGON)
  secondary: string[] // De los demás hechos y la climática (R5), sin repetir la principal
  climate: string // Subcategoría climática (R5) o '' si no se eligió calor o clima
  category: CategorySlug
}

const subOf = (fact: FactKey) => FACTS.find((f) => f.key === fact)?.sub ?? ''

// R5: el calor o clima se une al apagón/corte o al recibo; si va solo, es calor en la ciudad
function climateSub(subs: string[]) {
  if (!subs.includes(CLIMATE)) return ''
  if (subs.includes('IE.APAGON') || subs.includes('IE.CORTE_MANTENIMIENTO')) return 'CC.APAGON_CLIMATICO'
  if (subs.includes('IE.COBRO')) return 'CC.CALOR_EXTREMO'
  return 'CC.CALOR_CIUDAD'
}

// Mismas reglas que el prototipo (logic/card.ts: subPrincipal, subSecundarias). «Otro» como principal = falta de planeación
export function classifyFacts(facts: FactKey[]): FactClassification | null {
  if (!facts.length) return null
  const subs = facts.map(subOf)
  const climate = climateSub(subs)
  const first = subs[0]
  const subcategory = first === CLIMATE ? climate : first || 'CC.OMISION_PLANEACION'
  const secondary = [...subs.slice(1), climate].filter((s, i, all) => s && s !== CLIMATE && s !== subcategory && all.indexOf(s) === i)
  return { subcategory, secondary, climate, category: CATEGORY_BY_PREFIX[subcategory.slice(0, 2)] }
}

// «¿Te han amenazado?» solo se pregunta con un proyecto en el territorio; «sí» o «prefiero no decir» = modo protección
export const asksThreats = (facts: FactKey[]) => facts.includes('proyecto_territorio')
export const protectionMode = (facts: FactKey[], threats: Threats | null) =>
  asksThreats(facts) && (threats === 'si' || threats === 'prefiero_no_decir')

export const SINCE_LABELS: Record<Since, string> = {
  este_anio: 'Este año',
  uno_a_tres_anios: '1 a 3 años',
  mas_de_tres_anios: 'Más de 3 años',
}

export const COMPLAINT_LABELS: Record<Complaint, string> = {
  no: 'No',
  si_sin_respuesta: 'Sí, y no me respondieron',
  si_con_respuesta: 'Sí, y me respondieron',
}

export const THREATS_LABELS: Record<Threats, string> = {
  no: 'No',
  si: 'Sí',
  prefiero_no_decir: 'Prefiero no decir',
}
