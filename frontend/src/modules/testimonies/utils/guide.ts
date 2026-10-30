// Guía después de enviar: «En una transición energética justa, las cosas deberían suceder así».
// Réplica de la tarjeta causa → efecto del prototipo (logic/card.ts, hoja UI-MVP del Excel
// Atlas_Obligaciones_HxNF_v5). Los textos legales y las plantillas salen de data/guide/*.json
import commitmentsByKey from '@testimonies/data/guide/commitments-by-key.json'
import commitmentsTable from '@testimonies/data/guide/commitments.json'
import regions from '@testimonies/data/guide/regions.json'
import rightsTable from '@testimonies/data/guide/rights.json'
import stateRegions from '@testimonies/data/guide/state-regions.json'
import subcategories from '@testimonies/data/guide/subcategories.json'
import texts from '@testimonies/data/guide/texts.json'
import { classifyFacts, protectionMode } from '@testimonies/data/facts'
import type { CategorySlug } from '@testimonies/types/testimony'
import { needsRiskReview, RISK_REVIEW_NOTICE, type GuideInput, type GuideReview } from '@testimonies/utils/guideInput'

export { RISK_REVIEW_NOTICE }
export type { GuideInput, GuideReview }

interface Subcategory {
  etiqueta: string
  categoria: string
  responsable: string
  fragmento: string
  fuente: string
  derechos: string
  salidaFragmento: string
  salidaFuente: string
}
export interface Commitment {
  id: string
  fragmento: string
  responsable: string
  fuente: string
}
export type Grade = 'A' | 'B' | 'C' | 'M'
export interface Right {
  name: string
  article: string
  grade: Grade | null
  phrase: string
  review: boolean // Identificado en revisión
}
export interface RegionFigures {
  region: string
  installed2024: number // MW de generación distribuida instalada en 2024
  renewables: number // MW previstos 2025–2039
  fossils: number
  shared: boolean // La cifra prevista es de toda la GCR Baja California
}
export interface RegionDetail extends RegionFigures {
  name: string
  renewableShare: number // % renovable de lo previsto (0–100)
  rank: number // Lugar en generación distribuida 2024 entre todas las regiones (1 = más)
  regions: number
  states: string[] // Estados que el Excel asigna a esta región [INFERENCIA]
  investment: { amount: string; source: string } | null // Proyectos estratégicos de la CFE (PLADESE, tablas 4.24–4.31)
}
export interface Recipient {
  label: string
  email: string
  name: string // Cómo se nombra en la solicitud («solicito a …»)
}

const SUBS = subcategories as Record<string, Subcategory>
const RIGHTS = rightsTable as Record<string, string>
const BY_KEY = commitmentsByKey as Record<string, { compromiso1: string; verMas: string }>
const COMMITMENTS = commitmentsTable as Record<string, Omit<Commitment, 'id'>>
const REGIONS = regions as Record<string, string>
const STATE_REGION = stateRegions as Record<string, string>
const GRADES_IN_TABLE = texts.grados_en_tabla as Record<string, Grade>
const GRADE_PHRASES = texts.grados as Record<string, string>

export const GUIDE_TITLE = 'En una transición energética justa, las cosas deberían suceder así'

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '')

function commitment(id: string): Commitment | null {
  const c = COMMITMENTS[id]
  return c ? { id, ...c } : null
}

// «Salud (art. 4º): afectación por vínculo normativo · Vivienda (art. 4º): en riesgo» → lista con grado
function parseRights(text: string): Right[] {
  return text.split(' · ').flatMap((part) => {
    const m = part.match(/^(.*) \((art\. [^)]+)\): (.*)$/)
    if (!m) return []
    const grade = GRADES_IN_TABLE[m[3].split(',')[0].trim()] ?? null
    return [{ name: m[1], article: m[2], grade, phrase: grade ? GRADE_PHRASES[grade] : '', review: m[3].includes('identificado en revisión') }]
  })
}

// Artículo con que el Excel cita cada derecho en sus tablas (p. ej. no discriminación → art. 1º); si no aparece, art. 4º
const ARTICLE_BY_RIGHT: Record<string, string> = Object.fromEntries(
  [...Object.values(RIGHTS), ...Object.values(SUBS).map((s) => s.derechos)].flatMap((t) =>
    t.split(' · ').flatMap((part) => {
      const m = part.match(/^(.*) \((art\. [^)]+)\):/)
      return m ? [[m[1], m[2]]] : []
    }),
  ),
)
const reviewRight = (name: string) => `${name}${texts.derecho_revision.replace('art. 4º', ARTICLE_BY_RIGHT[name] ?? 'art. 4º')}`

const GOVERNMENT_TEXT: Record<NonNullable<GuideReview['government']>, string> = {
  estatal: texts.responsable_adicional['Gobierno estatal'],
  municipal: texts.responsable_adicional['Gobierno municipal'],
  ambos: texts.responsable_adicional['Ambos'],
}

const CATEGORY_BY_PREFIX: Record<string, CategorySlug> = { IE: 'inseguridad-energetica', CC: 'afectaciones-cambio-climatico', MP: 'megaproyectos' }


const num = (s: string) => Number(s.replace(/,/g, ''))

// Las cifras salen del texto de la tabla GCR del Excel (no se agregan datos)
export function regionFigures(region: string): RegionFigures | null {
  const text = REGIONS[region]
  const installed = text?.match(/instalada en 2024: ([\d,.]+) MW/)
  const plan = text?.match(/unos ([\d,.]+) MW renovables y ([\d,.]+) MW fósiles/)
  if (!installed || !plan) return null
  return {
    region,
    installed2024: num(installed[1]),
    renewables: num(plan[1]),
    fossils: num(plan[2]),
    shared: text.includes('cifra de toda la GCR'),
  }
}

export const allRegionFigures = () =>
  Object.keys(REGIONS)
    .map(regionFigures)
    .filter((r): r is RegionFigures => r !== null)

export const REGION_NAMES: Record<string, string> = { BCS: 'Baja California Sur' }

// Inversión preliminar de los proyectos estratégicos de la CFE por región (compromisos PLADESE-4.24 a 4.31 del Excel)
const INVESTMENT_BY_REGION: Record<string, string> = {
  Central: 'PLADESE-4.24-01',
  Oriental: 'PLADESE-4.25-01',
  Occidental: 'PLADESE-4.26-01',
  Noroeste: 'PLADESE-4.27-01',
  Norte: 'PLADESE-4.28-01',
  Noreste: 'PLADESE-4.29-01',
  'Baja California': 'PLADESE-4.30-01',
  BCS: 'PLADESE-4.31-01',
}

// Todo sale del Excel: cifras de la tabla GCR, estados por región y montos de las tablas del PLADESE
export function regionDetail(region: string): RegionDetail | null {
  const figures = regionFigures(region)
  if (!figures) return null
  const ranking = allRegionFigures().sort((a, b) => b.installed2024 - a.installed2024)
  const planned = figures.renewables + figures.fossils
  const c = COMMITMENTS[INVESTMENT_BY_REGION[region] ?? '']
  const amount = c?.fragmento.match(/MDP ([\d,.]+)/i)?.[1]
  return {
    ...figures,
    name: REGION_NAMES[region] ?? region,
    renewableShare: planned ? Math.round((figures.renewables / planned) * 100) : 0,
    rank: ranking.findIndex((r) => r.region === region) + 1,
    regions: ranking.length,
    states: Object.keys(STATE_REGION)
      .filter((s) => STATE_REGION[s] === region)
      .sort((a, b) => a.localeCompare(b, 'es')),
    investment: c && amount ? { amount, source: c.fuente } : null,
  }
}

// Correo de la solicitud: unidades de transparencia que publican su correo para recibir solicitudes
// (cfe.gob.mx → Transparencia → Datos de contacto; cenace.gob.mx → Transparencia → Acceso a la información;
// transparencia.energia.gob.mx → Datos de contacto; transparencia.cne.gob.mx; SEMARNAT: sus avisos de privacidad)
export const TRANSPARENCY = {
  CFE: { label: 'Unidad de Transparencia de la CFE', email: 'informacion.publica@cfe.mx', name: 'la Comisión Federal de Electricidad (CFE)' },
  CENACE: {
    label: 'Unidad de Transparencia del CENACE',
    email: 'unidad.transparencia@cenace.gob.mx',
    name: 'el Centro Nacional de Control de Energía (CENACE)',
  },
  SENER: { label: 'Unidad de Transparencia de la SENER', email: 'unidadtransparencia@energia.gob.mx', name: 'la Secretaría de Energía (SENER)' },
  CNE: { label: 'Unidad de Transparencia de la CNE', email: 'transparencia@cne.gob.mx', name: 'la Comisión Nacional de Energía (CNE)' },
  SEMARNAT: {
    label: 'Unidad de Transparencia de la SEMARNAT',
    email: 'utransparencia@semarnat.gob.mx',
    name: 'la Secretaría de Medio Ambiente y Recursos Naturales (SEMARNAT)',
  },
} satisfies Record<string, Recipient>
// Copia oculta para que Hackers x Nuestro Futuro dé seguimiento
export const FOLLOW_UP_BCC = 'hxnf@practica.lat'
// Apagones, cortes y obras de red: el CENACE coordina el restablecimiento del servicio y la planeación de la red
const GRID_CASES = new Set(['IE.APAGON', 'IE.CORTE_MANTENIMIENTO', 'CC.APAGON_CLIMATICO', 'MP.OBRA_RED_RETRASADA'])

// Siempre la CFE; además el CENACE en casos de red y la dependencia que el Excel marca como responsable
function recipientsFor(principal: string, responsable: string): Recipient[] {
  const list: Recipient[] = [TRANSPARENCY.CFE]
  if (GRID_CASES.has(principal)) list.push(TRANSPARENCY.CENACE)
  if (/SENER/.test(responsable)) list.push(TRANSPARENCY.SENER)
  if (/CNE/.test(responsable)) list.push(TRANSPARENCY.CNE)
  if (/SEMARNAT/.test(responsable)) list.push(TRANSPARENCY.SEMARNAT)
  return list
}

// «la CFE, al CENACE y a la SENER» (va después de «solicito a»)
function addressees(list: Recipient[]): string {
  const names = list.map((r, i) => (i ? `a ${r.name}`.replace(/^a el /, 'al ') : r.name))
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0]!
}

// Deber general de las autoridades (Excel, regla R15: siempre se muestra junto a los derechos)
export const AUTHORITIES_DUTY =
  'Las autoridades deben promover, respetar, proteger y garantizar tus derechos, y prevenir, investigar, sancionar y reparar sus violaciones (art. 1º de la Constitución).'

const HYDROCARBONS = /gasoduct|oleoduct|fracking|fractura hidr|hidrocarbur|pozo petroler|petrol[ée]r|\bpemex\b/i

export function buildGuide(t: GuideInput, review?: GuideReview | null) {
  const classified = classifyFacts(t.facts)
  if (!classified) return null
  const { climate } = classified
  const principal = review?.subcategory && SUBS[review.subcategory] ? review.subcategory : classified.subcategory
  const sub = SUBS[principal]
  if (!sub) return null

  const region = STATE_REGION[t.state] ?? ''
  const byKey = BY_KEY[`${principal}|${region}`]
  // El compromiso destacado por el revisor pasa al frente; los demás quedan en «Ver más»
  const firstId = review?.commitment || byKey?.compromiso1 || ''
  const moreIds = byKey
    ? [byKey.compromiso1, ...byKey.verMas.split('; ')].filter((id, i, all) => id && id !== firstId && all.indexOf(id) === i)
    : []

  const protection = protectionMode(t.facts, t.threats)
  const riskReview = needsRiskReview(t, principal)
  // Megaproyecto o central fósil (principal o secundario): centro del municipio (UI-4)
  const municipalCenter = !protection && riskReview
  // Sin consulta indígena o presión por tierras: nunca con nombre
  const anonymous = protection || t.visibility !== 'nombre' || ['MP.SIN_CONSULTA', 'MP.TIERRAS'].includes(principal)
  const m = texts.mapa_publico
  const publicMap = protection
    ? 'Solo el estado, anónimo'
    : (municipalCenter ? 'Centro del municipio' : 'Cuadrícula de ~1 km') + (anonymous ? m.anonimo : m.con_nombre)
  const municipality = t.municipality.trim()
  const publicPlace = protection
    ? `Solo el estado (${t.state})`
    : `${municipalCenter ? 'Centro del municipio de' : 'Cuadrícula de ~1 km dentro de'} ${[municipality, t.state].filter(Boolean).join(', ')}`

  const recipients = recipientsFor(principal, sub.responsable)

  let rightsText = RIGHTS[`${principal}|${climate === principal ? '' : climate}`] ?? sub.derechos
  if (review?.right) rightsText += ` · ${reviewRight(review.right)}`

  const place = [t.place.trim(), t.municipality.trim(), t.state].filter(Boolean).join(', ')
  const suggested = fill(texts.pregunta_sugerida, { etiqueta: sub.etiqueta.toLowerCase(), municipio: t.municipality.trim(), estado: t.state })
  const question = t.tribunalQuestion.trim() || suggested

  const complaint =
    t.complaint === 'si_sin_respuesta'
      ? texts.reclamo['Sí, y no me respondieron']
      : t.complaint === 'no' && principal.startsWith('IE.')
        ? texts.reclamo['No|IE']
        : null

  const requestFor = (responsable: string) =>
    fill(texts.solicitud, { responsable, pregunta: question, municipio: municipality, estado: t.state, fuente: sub.fuente })

  const notices = [texts.avisos.base]
  if (t.ongoing === false && t.since === 'mas_de_tres_anios') notices.push(texts.avisos.antes_2025)
  if (review?.figures) notices.push(texts.avisos.cifras)
  if (review?.hxnf) notices.push(texts.avisos.hxnf)

  return {
    principal,
    category: CATEGORY_BY_PREFIX[principal.slice(0, 2)] ?? classified.category,
    subcategoryLabel: sub.etiqueta,
    title: t.title.trim(),
    place,
    ongoing: t.ongoing === true,
    // Gasoductos, fracking… se registran pero no se vinculan con obligaciones en esta versión
    hydrocarbons: t.facts[0] === 'otro' && HYDROCARBONS.test(`${t.title} ${t.testimony}`),
    protection,
    riskReview,
    publicMap,
    publicPlace,
    author: anonymous ? 'Anónimo' : t.name.trim() || 'Anónimo',
    rights: parseRights(rightsText),
    responsible: sub.responsable,
    // « · También debe responder el gobierno estatal (LGCC, art. 8)» → sin el separador inicial
    responsibleExtra: review?.government ? GOVERNMENT_TEXT[review.government].replace(/^ · /, '') : null,
    duty: { text: sub.fragmento, source: sub.fuente },
    renewable: { text: sub.salidaFragmento, source: sub.salidaFuente },
    question,
    questionSuggested: !t.tribunalQuestion.trim(),
    request: requestFor(sub.responsable),
    // Por correo se dirige a quien la recibe (CFE, CENACE en casos de red y la dependencia responsable)
    email: {
      to: recipients,
      subject: `Solicitud de acceso a la información pública: ${[municipality, t.state].filter(Boolean).join(', ')}`,
      body: requestFor(addressees(recipients)),
    },
    commitment: commitment(firstId),
    moreCommitments: moreIds.map(commitment).filter((c): c is Commitment => c !== null),
    region,
    regionText: REGIONS[region] ?? '',
    regionDetail: regionDetail(region),
    complaintTitle: t.complaint === 'no' ? 'Si quieres reclamar' : 'Si ya reclamaste',
    complaint,
    notices,
  }
}

export type Guide = NonNullable<ReturnType<typeof buildGuide>>
