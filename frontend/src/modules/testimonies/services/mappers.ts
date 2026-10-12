import type {
  ApiCategoria,
  ApiCrearTestimonio,
  ApiCrearTestimonioRespuesta,
  ApiMapa,
  ApiTestimonioDetalle,
} from '@testimonies/types/api'
import type {
  Category,
  Consent,
  CreateTestimonyResult,
  SensitiveHandling,
  TestimonyDetail,
  TestimonyDraft,
  TestimonySummary,
} from '@testimonies/types/testimony'

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

// --- Envío (POST /api/testimonios) ---

const CONSENT: Record<Consent, ApiCrearTestimonio['autorizacion']> = {
  'publico-nombre': 'publico_con_nombre',
  'publico-anonimo': 'publico_anonimo',
  interno: 'solo_documentacion_interna',
  'no-publicar': 'no_autoriza',
}

const SENSITIVE: Record<SensitiveHandling, NonNullable<ApiCrearTestimonio['sensible_accion']>> = {
  anonimizar: 'anonimizar',
  interno: 'uso_interno',
  revision: 'revision_antes_publicar',
}

// Quita las llaves sin valor para no mandar strings vacíos
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

// "dato — fuente, año" (la API lo guarda en un solo campo)
function dataLine(d: TestimonyDraft) {
  const text = clean(d.dataText)
  if (!text) return undefined
  const source = [clean(d.dataSource), clean(d.dataYear)].filter(Boolean).join(', ')
  return source ? `${text} — ${source}` : text
}

// El borrador ya pasó la validación del wizard: los campos obligatorios existen
export function toCreatePayload(d: TestimonyDraft): ApiCrearTestimonio {
  const hasData = !!clean(d.dataText)
  const contact = compact({ correo: clean(d.email), telefono: clean(d.phone) })

  return compact({
    categoria: d.topic!,
    fecha: d.date || undefined,
    titulo: clean(d.title),
    lugar_territorio: clean(d.place),
    ubicacion: { type: 'Point', coordinates: [d.coordinates![0], d.coordinates![1]] },
    origen_ubicacion: d.locationSource ?? 'mapa',
    aparecer_como: d.visibility,
    nombre: clean(d.name),
    facilitador_nombre: clean(d.facilitator),
    relato: d.testimony.trim(),
    territorio_dice: clean(d.territory),
    comunidad_dice: clean(d.community),
    tiene_evidencia: d.documentStatus ?? undefined,
    evidencia_descripcion: clean(d.documentDescription),
    evidencia_tipos: d.evidence.length ? [...d.evidence] : undefined,
    evidencia_otro: d.evidence.includes('otro') ? clean(d.evidenceOther) : undefined,
    dato_fuente_anio: dataLine(d),
    fuente_pendiente_verificacion: hasData ? d.dataPendingVerification : undefined,
    pregunta_tribunal: clean(d.tribunalQuestion),
    autorizacion: CONSENT[d.consent!],
    autoriza_multimedia: d.mediaConsent ?? undefined,
    info_sensible: d.sensitive ?? false,
    sensible_accion: d.sensitive && d.sensitiveHandling ? SENSITIVE[d.sensitiveHandling] : undefined,
    consentimiento_aceptado: true,
    contacto: Object.keys(contact).length ? contact : undefined,
    auditoria: compact({
      precision_gps_m: d.locationSource === 'gps' && d.gpsAccuracy !== null ? Math.round(d.gpsAccuracy) : undefined,
      zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone,
      idioma: navigator.language,
      pantalla: `${screen.width}x${screen.height}`,
    }),
  })
}

export function fromCreateResponse(r: ApiCrearTestimonioRespuesta): CreateTestimonyResult {
  return {
    id: r.testimonio.id,
    folio: r.testimonio.folio,
    status: r.testimonio.estado,
    published: r.testimonio.publicado,
    message: r.mensaje,
    participantFolio: r.participante?.folio ?? null,
  }
}
