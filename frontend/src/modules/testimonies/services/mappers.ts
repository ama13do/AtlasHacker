import { asText } from '@testimonies/utils/text'
import type {
  ApiFuente,
  ApiCategoria,
  ApiComentario,
  ApiCrearTestimonio,
  ApiCrearTestimonioRespuesta,
  ApiEditarMiTestimonio,
  ApiMapa,
  ApiMiEvidencia,
  ApiMiPerfil,
  ApiMiTestimonio,
  ApiMiTestimonioResumen,
  ApiTestimonioDetalle,
} from '@testimonies/types/api'
import { REACTION_TYPES } from '@testimonies/types/testimony'
import type {
  Category,
  Comment,
  Consent,
  CreateTestimonyResult,
  MyEvidence,
  MyTestimony,
  ParticipantProfile,
  PersonalData,
  ReactionType,
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

// Conteo por tipo, con 0 en los que falten
export function fromReactionCounts(raw: Partial<Record<string, number>> | null | undefined): Record<ReactionType, number> {
  return Object.fromEntries(REACTION_TYPES.map((t) => [t, raw?.[t] ?? 0])) as Record<ReactionType, number>
}

export function fromComment(c: ApiComentario): Comment {
  return {
    id: c.id,
    author: clean(c.autor_nombre) ?? null,
    text: c.contenido,
    likes: c.likes_conteo,
    createdAt: c.created_at,
    likedByMe: c.le_di_like,
  }
}

// Resumen a partir de la ficha completa (p. ej. al llegar un evento de tiempo real)
export function toSummary(d: TestimonyDetail): TestimonySummary {
  const { id, folio, date, place, coordinates, approximate, category, title, reactions, comments, cover } = d
  return { id, folio, date, place, coordinates, approximate, category, title, reactions, comments, cover }
}

export function fromDetail(d: ApiTestimonioDetalle): TestimonyDetail {
  return {
    dossier: d.expediente_codigo,
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
    data:
      d.dato_fuente_anio?.trim() || d.fuentes?.length
        ? {
            text: d.dato_fuente_anio?.trim() ?? '',
            sources: (d.fuentes ?? []).map((f) => ({ source: f.fuente, year: f.anio, link: f.enlace })),
            pendingVerification: d.fuente_pendiente_verificacion,
          }
        : undefined,
    tribunalQuestion: clean(d.pregunta_tribunal),
    anythingElse: clean(d.algo_mas),
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
    reactionCounts: fromReactionCounts(d.reacciones_conteo),
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

// 04 · Fuentes con algo escrito (las filas vacías del formulario no se envían)
function sourcesOf(d: TestimonyDraft): ApiFuente[] {
  return d.sources
    .filter((s) => asText(s.source).trim())
    .map((s) => compact({ fuente: asText(s.source).trim(), anio: asText(s.year).trim() ? Number(s.year) : undefined, enlace: clean(asText(s.link)) }))
}

// El borrador ya pasó la validación del wizard: los campos obligatorios existen
export function toCreatePayload(d: TestimonyDraft): ApiCrearTestimonio {
  const fuentes = sourcesOf(d)
  const hasData = !!clean(d.dataText) || fuentes.length > 0
  const contact = compact({ correo: clean(d.email), telefono: clean(d.phone) })

  return compact({
    categoria: d.topic!,
    fecha: d.date || undefined,
    titulo: clean(d.title),
    lugar_territorio: clean(d.place),
    entidad: clean(d.state),
    municipio: clean(d.municipality),
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
    dato_fuente_anio: clean(d.dataText),
    fuentes: fuentes.length ? fuentes : undefined,
    fuente_pendiente_verificacion: hasData ? d.dataPendingVerification : undefined,
    pregunta_tribunal: clean(d.tribunalQuestion),
    algo_mas: clean(d.anythingElse),
    registro_voz: clean(d.voiceRecord),
    autorizacion: CONSENT[d.consent!],
    autoriza_multimedia: d.mediaConsent ?? undefined,
    autoriza_voz_imagen: d.voiceImage ?? undefined,
    info_sensible: d.sensitive ?? false,
    info_menores: d.minors ?? false,
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

// --- Mi folio ---

export function fromMine(t: ApiMiTestimonioResumen): MyTestimony {
  return {
    id: t.id,
    folio: t.folio,
    title: clean(t.titulo) ?? 'Testimonio sin título',
    category: t.categoria_slug,
    date: t.fecha,
    place: clean(t.lugar_territorio) ?? null,
    status: t.estado,
    active: t.activo,
    public: t.es_publico,
    rejectionReason: clean(t.motivo_rechazo) ?? null,
    reactions: t.reacciones_total,
    comments: t.comentarios_conteo,
    updatedAt: t.updated_at,
  }
}

export function fromProfile(p: ApiMiPerfil): ParticipantProfile {
  return {
    hint: p.folio_pista,
    publicProfile: p.perfil_publico,
    publicName: p.nombre_publico,
    hasName: p.dejo_nombre,
    hasEmail: p.dejo_correo,
    hasPhone: p.dejo_telefono,
    testimonies: p.testimonios,
    published: p.aprobados,
    createdAt: p.created_at,
  }
}

export function fromPersonalData(p: ApiMiPerfil): PersonalData {
  const d = p.datos_personales
  return { name: d?.nombre ?? null, email: d?.correo ?? null, phone: d?.telefono ?? null }
}

export function fromMyEvidence(e: ApiMiEvidencia): MyEvidence {
  return {
    id: e.id,
    folio: e.folio,
    type: e.tipo,
    name: e.nombre_original,
    mime: e.mime,
    size: e.bytes,
    uploaded: e.estado_subida === 'subida',
    public: e.publica,
    active: e.activo,
  }
}

const CONSENT_FROM_API = Object.fromEntries(Object.entries(CONSENT).map(([k, v]) => [v, k])) as Record<
  ApiCrearTestimonio['autorizacion'],
  Consent
>
const SENSITIVE_FROM_API = Object.fromEntries(Object.entries(SENSITIVE).map(([k, v]) => [v, k])) as Record<
  NonNullable<ApiCrearTestimonio['sensible_accion']>,
  SensitiveHandling
>

// Ficha propia → borrador del wizard (para editar). Archivos, folio y contacto no se editan aquí
export function draftFromMine(t: ApiMiTestimonio): TestimonyDraft {
  const point = t.centroide?.coordinates
  return {
    topic: t.categoria?.slug ?? null,
    title: t.titulo ?? '',
    place: t.lugar_territorio ?? '',
    coordinates: point ? [point[0], point[1]] : null,
    state: t.entidad ?? '',
    municipality: t.municipio ?? '',
    locationSource: t.origen_ubicacion === 'gps' ? 'gps' : 'mapa',
    gpsAccuracy: null,
    date: t.fecha,
    name: t.nombre_publico ?? '',
    visibility: t.aparecer_como,
    facilitator: t.facilitador_nombre ?? '',
    testimony: t.relato,
    territory: t.territorio_dice ?? '',
    community: t.comunidad_dice ?? '',
    documentStatus: t.tiene_evidencia,
    documentDescription: t.evidencia_descripcion ?? '',
    evidence: t.evidencia_tipos ?? [],
    evidenceOther: t.evidencia_otro ?? '',
    files: [],
    dataText: t.dato_fuente_anio ?? '',
    sources: (t.fuentes ?? []).map((f) => ({ id: crypto.randomUUID(), source: f.fuente, year: f.anio ? String(f.anio) : '', link: f.enlace ?? '' })),
    anythingElse: t.algo_mas ?? '',
    voiceRecord: t.registro_voz ?? '',
    dataPendingVerification: t.fuente_pendiente_verificacion,
    tribunalQuestion: t.pregunta_tribunal ?? '',
    voluntary: true,
    consent: CONSENT_FROM_API[t.autorizacion] ?? null,
    mediaConsent: t.autoriza_multimedia,
    voiceImage: t.autoriza_voz_imagen,
    sensitive: t.info_sensible,
    minors: t.info_menores ?? false,
    stripMetadata: true,
    sensitiveHandling: t.sensible_accion ? SENSITIVE_FROM_API[t.sensible_accion] : null,
    folio: '',
    email: '',
    phone: '',
  }
}

// Borrador editado → PATCH. Sin consentimiento, contacto ni auditoría (eso no se edita)
export function toUpdatePayload(d: TestimonyDraft): ApiEditarMiTestimonio {
  const {
    consentimiento_aceptado: _c,
    contacto: _contact,
    auditoria: _a,
    expediente: _e,
    nombre,
    ...rest
  } = toCreatePayload(d)
  return compact({
    ...rest,
    nombre_publico: d.visibility === 'nombre' ? nombre : undefined,
    // Vaciar un campo opcional también debe guardarse
    titulo: d.title.trim(),
    territorio_dice: d.territory.trim(),
    comunidad_dice: d.community.trim(),
    evidencia_descripcion: d.documentDescription.trim(),
    evidencia_tipos: [...d.evidence],
    dato_fuente_anio: d.dataText.trim(),
    fuentes: sourcesOf(d),
    pregunta_tribunal: d.tribunalQuestion.trim(),
    algo_mas: d.anythingElse.trim(),
    registro_voz: d.voiceRecord.trim(),
  })
}
