import { MEXICO_BOUNDS } from '@map/config'

// Búsqueda de lugares (autocompletado) y geocodificación inversa con Photon (komoot), sobre OpenStreetMap.
// Sin clave. Se envía solo el texto buscado o el punto marcado, nunca datos de la persona.
// Uso razonable del servicio público: búsquedas con retardo y canceladas al seguir escribiendo.

const PHOTON = 'https://photon.komoot.io'

export interface Place {
  id: string
  name: string // Lo principal (calle, colonia, localidad, municipio…)
  detail: string // Contexto: localidad, municipio, estado
  label: string // Para «Lugar / territorio»: «San Juan Chamula, Chamula, Chiapas»
  municipality: string | null
  state: string | null
  coordinates: [number, number]
  // [oeste, sur, este, norte] si el lugar es un área
  bounds: [[number, number], [number, number]] | null
  kind: string // city, county, street, house…
}

interface PhotonProps {
  osm_type?: string
  osm_id?: number
  type?: string
  name?: string
  street?: string
  housenumber?: string
  locality?: string
  district?: string
  city?: string
  county?: string
  state?: string
  countrycode?: string
  extent?: [number, number, number, number] // oeste, norte, este, sur
}

interface PhotonFeature {
  properties: PhotonProps
  geometry: { type: 'Point'; coordinates: [number, number] }
}

const unique = (values: (string | null | undefined)[]) =>
  values.filter((v, i, all): v is string => !!v?.trim() && all.findIndex((x) => x?.toLowerCase() === v.toLowerCase()) === i)

function toPlace({ properties: p, geometry }: PhotonFeature): Place {
  const municipality = p.county ?? (p.type === 'county' ? (p.name ?? null) : null)
  const state = p.state ?? (p.type === 'state' ? (p.name ?? null) : null)
  const locality = p.city ?? p.locality ?? p.district ?? null
  const street = p.street ? [p.street, p.housenumber].filter(Boolean).join(' ') : null
  const name = p.name ?? street ?? locality ?? municipality ?? state ?? 'Lugar sin nombre'
  // Calles y comercios no son un «territorio»: la etiqueta empieza en la localidad
  const fine = p.type === 'house' || p.type === 'street'
  const label = unique(fine ? [locality, municipality, state] : [name, locality, municipality, state]).join(', ')
  const e = p.extent
  return {
    id: `${p.osm_type ?? ''}${p.osm_id ?? `${geometry.coordinates.join(',')}`}`,
    name,
    detail: unique([fine ? street : null, locality, municipality, state].filter((v) => v !== name)).join(' · '),
    label: label || name,
    municipality,
    state,
    coordinates: geometry.coordinates,
    bounds: e ? [[e[0], e[3]], [e[2], e[1]]] : null,
    kind: p.type ?? 'place',
  }
}

const [[WEST, SOUTH], [EAST, NORTH]] = MEXICO_BOUNDS

export async function searchPlaces(query: string, signal?: AbortSignal, near?: [number, number] | null): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, limit: '8', bbox: [WEST, SOUTH, EAST, NORTH].join(',') })
  // Prioriza lo cercano a lo que ya se ve o se marcó
  if (near) {
    params.set('lon', String(near[0]))
    params.set('lat', String(near[1]))
  }
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal })
  if (!res.ok) throw new Error(`Photon ${res.status}`)
  const data = (await res.json()) as { features: PhotonFeature[] }
  return data.features.filter((f) => f.properties.countrycode === 'MX').map(toPlace).slice(0, 6)
}

export async function reverseGeocode([lng, lat]: [number, number], signal?: AbortSignal): Promise<Place | null> {
  const params = new URLSearchParams({ lon: String(lng), lat: String(lat), limit: '1', radius: '5' })
  const res = await fetch(`${PHOTON}/reverse?${params}`, { signal })
  if (!res.ok) throw new Error(`Photon ${res.status}`)
  const data = (await res.json()) as { features: PhotonFeature[] }
  const feature = data.features.find((f) => f.properties.countrycode === 'MX')
  return feature ? toPlace(feature) : null
}
