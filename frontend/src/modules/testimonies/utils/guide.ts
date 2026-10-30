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
import type { GuideInput } from '@testimonies/utils/guideInput'

export type { GuideInput }

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
}
export interface RegionFigures {
  region: string
  installed2024: number // MW de generación distribuida instalada en 2024
  renewables: number // MW previstos 2025–2039
  fossils: number
  shared: boolean // La cifra prevista es de toda la GCR Baja California
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
    return [{ name: m[1], article: m[2], grade, phrase: grade ? GRADE_PHRASES[grade] : '' }]
  })
}

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

const HYDROCARBONS = /gasoduct|oleoduct|fracking|fractura hidr|hidrocarbur|pozo petroler|petrol[ée]r|\bpemex\b/i

export function buildGuide(t: GuideInput) {
  const classified = classifyFacts(t.facts)
  if (!classified) return null
  const { subcategory: principal, climate } = classified
  const sub = SUBS[principal]
  if (!sub) return null

  const region = STATE_REGION[t.state] ?? ''
  const byKey = BY_KEY[`${principal}|${region}`]
  const firstId = byKey?.compromiso1 ?? ''
  const moreIds = byKey ? [firstId, ...byKey.verMas.split('; ')].filter((id, i, all) => id && id !== firstId && all.indexOf(id) === i) : []

  const place = [t.place.trim(), t.municipality.trim(), t.state].filter(Boolean).join(', ')
  const suggested = fill(texts.pregunta_sugerida, { etiqueta: sub.etiqueta.toLowerCase(), municipio: t.municipality.trim(), estado: t.state })
  const question = t.tribunalQuestion.trim() || suggested

  const complaint =
    t.complaint === 'si_sin_respuesta'
      ? texts.reclamo['Sí, y no me respondieron']
      : t.complaint === 'no' && principal.startsWith('IE.')
        ? texts.reclamo['No|IE']
        : null

  const notices = [texts.avisos.base]
  if (t.ongoing === false && t.since === 'mas_de_tres_anios') notices.push(texts.avisos.antes_2025)

  return {
    principal,
    category: classified.category as CategorySlug,
    subcategoryLabel: sub.etiqueta,
    title: t.title.trim(),
    place,
    ongoing: t.ongoing === true,
    // Gasoductos, fracking… se registran pero no se vinculan con obligaciones en esta versión
    hydrocarbons: t.facts[0] === 'otro' && HYDROCARBONS.test(`${t.title} ${t.testimony}`),
    protection: protectionMode(t.facts, t.threats),
    rights: parseRights(RIGHTS[`${principal}|${climate === principal ? '' : climate}`] ?? sub.derechos),
    responsible: sub.responsable,
    duty: { text: sub.fragmento, source: sub.fuente },
    renewable: { text: sub.salidaFragmento, source: sub.salidaFuente },
    question,
    questionSuggested: !t.tribunalQuestion.trim(),
    request: fill(texts.solicitud, {
      responsable: sub.responsable,
      pregunta: question,
      municipio: t.municipality.trim(),
      estado: t.state,
      fuente: sub.fuente,
    }),
    commitment: commitment(firstId),
    moreCommitments: moreIds.map(commitment).filter((c): c is Commitment => c !== null),
    region,
    regionText: REGIONS[region] ?? '',
    complaintTitle: t.complaint === 'no' ? 'Si quieres reclamar' : 'Si ya reclamaste',
    complaint,
    notices,
  }
}

export type Guide = NonNullable<ReturnType<typeof buildGuide>>
