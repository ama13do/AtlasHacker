import type { ApiCategoria, ApiMapa, ApiTestimonioDetalle } from '@testimonies/types/api'
import type { Category, TestimonyDetail, TestimonySummary } from '@testimonies/types/testimony'

// Traducción API (español, snake_case) → modelo del front. Es el único lugar que conoce la forma de la API

const TITLE_FROM_TEXT = 80

const clean = (value: string | null | undefined) => value?.trim() || undefined

// Sin título: el inicio del relato, cortado en una palabra
function titleFrom(text: string) {
  const plain = text.trim().replace(/\s+/g, ' ')
  if (plain.length <= TITLE_FROM_TEXT) return plain
  const cut = plain.lastIndexOf(' ', TITLE_FROM_TEXT)
  return `${plain.slice(0, cut > 0 ? cut : TITLE_FROM_TEXT)}…`
}

function placeFrom(lugar: string | null, municipio?: string | null, entidad?: string | null) {
  return clean(lugar) ?? ([clean(municipio), clean(entidad)].filter(Boolean).join(', ') || 'Ubicación sin nombre')
}

export function fromCategory(c: ApiCategoria): Category {
  return { slug: c.slug, label: c.nombre, description: clean(c.descripcion) ?? null }
}

export function fromMapFeature({ geometry, properties: p }: ApiMapa['features'][number]): TestimonySummary {
  return {
    id: p.id,
    folio: p.folio,
    date: p.fecha,
    place: placeFrom(p.lugar_territorio),
    coordinates: [geometry.coordinates[0], geometry.coordinates[1]],
    approximate: p.aproximada,
    category: p.categoria_slug,
    title: clean(p.titulo) ?? 'Testimonio sin título',
    reactions: p.reacciones_total,
    comments: p.comentarios_conteo,
  }
}

export function fromDetail(d: ApiTestimonioDetalle): TestimonyDetail {
  return {
    id: d.id,
    folio: d.folio,
    date: d.fecha,
    place: placeFrom(d.lugar_territorio, d.municipio, d.entidad),
    coordinates: [d.centroide.coordinates[0], d.centroide.coordinates[1]],
    approximate: d.aproximada,
    category: d.categoria_slug,
    title: clean(d.titulo) ?? titleFrom(d.relato),
    reactions: d.reacciones_total,
    comments: d.comentarios_conteo,
    // La vista pública ya oculta el nombre si es anónimo o se pidió anonimizar
    author: d.nombre_publico ? { visibility: 'nombre', name: d.nombre_publico } : { visibility: 'anonimo' },
    testimony: d.relato,
    territory: clean(d.territorio_dice),
    community: clean(d.comunidad_dice),
    document: { status: d.tiene_evidencia },
    data: d.dato_fuente_anio?.trim()
      ? { text: d.dato_fuente_anio.trim(), pendingVerification: d.fuente_pendiente_verificacion }
      : undefined,
    tribunalQuestion: clean(d.pregunta_tribunal),
    evidence: d.evidencia_tipos ?? [],
    files: d.evidencias.map((e) => ({
      id: e.id,
      folio: e.folio,
      type: e.tipo,
      mime: e.mime,
      name: e.nombre,
      url: e.url,
      description: e.descripcion,
    })),
  }
}
