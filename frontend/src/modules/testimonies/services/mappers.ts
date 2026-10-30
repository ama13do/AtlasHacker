import { asksThreats, classifyFacts, FACT_KEYS, protectionMode } from '@testimonies/data/facts'
import type {
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
  ApiSeguimiento,
  ApiTestimonioDetalle,
} from '@testimonies/types/api'
import type { GuideReview } from '@testimonies/utils/guideInput'
import { REACTION_TYPES } from '@testimonies/types/testimony'
import type {
  Category,
  Comment,
  Consent,
  CreateTestimonyResult,
  FollowUp,
  MyEvidence,
  MyTestimony,
  ParticipantProfile,
  PersonalData,
  ReactionType,
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
    links: d.enlaces ?? [],
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

// Quita las llaves sin valor para no mandar strings vacíos
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

// El formulario no pregunta la autorización: se publica (tras revisión) como la persona eligió aparecer.
// Un testimonio anterior que se edita y era solo para documentación interna (o no autorizado) lo sigue siendo
function authorizationOf(d: TestimonyDraft): ApiCrearTestimonio['autorizacion'] {
  if (d.consent === 'interno' || d.consent === 'no-publicar') return CONSENT[d.consent]
  return d.visibility === 'nombre' && !protectionMode(d.facts, d.threats) ? 'publico_con_nombre' : 'publico_anonimo'
}

// El borrador ya pasó la validación del wizard: los campos obligatorios existen
export function toCreatePayload(d: TestimonyDraft): ApiCrearTestimonio {
  const contact = compact({ correo: clean(d.email), telefono: clean(d.phone) })
  const protection = protectionMode(d.facts, d.threats)
  const hasEvidence = d.files.length > 0 || d.links.length > 0

  return compact({
    categoria: d.topic!,
    hechos: d.facts.length ? [...d.facts] : undefined,
    subcategoria: classifyFacts(d.facts)?.subcategory,
    desde_cuando: d.since ?? undefined,
    sigue_pasando: d.ongoing ?? undefined,
    reclamo_previo: d.complaint ?? undefined,
    amenazas: asksThreats(d.facts) ? (d.threats ?? undefined) : undefined,
    titulo: clean(d.title),
    lugar_territorio: clean(d.place),
    entidad: clean(d.state),
    municipio: clean(d.municipality),
    ubicacion: { type: 'Point', coordinates: [d.coordinates![0], d.coordinates![1]] },
    origen_ubicacion: d.locationSource ?? 'mapa',
    aparecer_como: protection ? 'anonimo' : d.visibility,
    nombre: clean(d.name),
    facilitador_nombre: clean(d.facilitator),
    relato: d.testimony.trim(),
    pregunta_tribunal: clean(d.tribunalQuestion),
    tiene_evidencia: hasEvidence ? 'si' : 'no',
    evidencia_tipos: d.files.length ? [...new Set(d.files.map((f) => f.type))] : undefined,
    enlaces_evidencia: d.links.length ? [...d.links] : undefined,
    autorizacion: authorizationOf(d),
    // Modo protección: la información es de riesgo y siempre se revisa antes de publicar
    info_sensible: protection,
    sensible_accion: protection ? 'revision_antes_publicar' : undefined,
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
    hasGuide: !!t.hechos?.length,
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

// Ficha propia → borrador del wizard (para editar). Archivos, folio y contacto no se editan aquí.
// Las respuestas del formato anterior (territorio, comunidad, datos…) no se tocan: siguen en la base
export function fromFollowUp(s: ApiSeguimiento): FollowUp {
  return {
    commitmentId: s.compromiso_id,
    arrived: s.llego,
    requestFolio: s.folio_solicitud ?? '',
    answer: s.respuesta,
    state: s.estado,
    confirmed: s.omision_confirmada,
    confirmedBy: s.confirmado_por_nombre,
    confirmedAt: s.confirmado_at,
  }
}

type ApiRevision = Pick<ApiMiTestimonio, 'revision_subcategoria' | 'revision_derecho' | 'revision_gobierno' | 'revision_compromiso' | 'aviso_hxnf' | 'aviso_cifras'>

export function reviewFromApi(t: ApiRevision): GuideReview {
  return {
    subcategory: t.revision_subcategoria ?? null,
    right: t.revision_derecho ?? null,
    government: t.revision_gobierno ?? null,
    commitment: t.revision_compromiso ?? null,
    hxnf: t.aviso_hxnf === true,
    figures: t.aviso_cifras === true,
  }
}

export function draftFromMine(t: ApiMiTestimonio): TestimonyDraft {
  const point = t.centroide?.coordinates
  return {
    facts: (t.hechos ?? []).filter((f) => FACT_KEYS.includes(f)),
    topic: t.categoria?.slug ?? null,
    coordinates: point ? [point[0], point[1]] : null,
    state: t.entidad ?? '',
    municipality: t.municipio ?? '',
    place: t.lugar_territorio ?? '',
    locationSource: t.origen_ubicacion === 'gps' ? 'gps' : 'mapa',
    gpsAccuracy: null,
    since: t.desde_cuando ?? null,
    ongoing: t.sigue_pasando ?? null,
    title: t.titulo ?? '',
    testimony: t.relato,
    tribunalQuestion: t.pregunta_tribunal ?? '',
    links: (t.enlaces_evidencia ?? []).map((e) => e.url),
    files: [],
    complaint: t.reclamo_previo ?? null,
    threats: t.amenazas ?? null,
    // «Con mi nombre» solo si además lo había autorizado (antes eran dos preguntas): así no se publica un nombre sin pedirlo
    visibility: t.aparecer_como === 'nombre' && t.autorizacion === 'publico_con_nombre' ? 'nombre' : 'anonimo',
    name: t.nombre_publico ?? '',
    facilitator: t.facilitador_nombre ?? '',
    consent: CONSENT_FROM_API[t.autorizacion] ?? null,
    voluntary: true,
    folio: '',
    email: '',
    phone: '',
  }
}

// Borrador editado → PATCH: solo lo que pregunta el formulario (sin consentimiento, contacto ni auditoría).
// La evidencia, la información sensible y la fecha de un testimonio anterior se conservan
export function toUpdatePayload(d: TestimonyDraft): ApiEditarMiTestimonio {
  const {
    consentimiento_aceptado: _c,
    contacto: _contact,
    auditoria: _a,
    expediente: _e,
    tiene_evidencia: _t,
    evidencia_tipos: _et,
    info_sensible: infoSensible,
    sensible_accion: sensibleAccion,
    nombre,
    ...rest
  } = toCreatePayload(d)
  return compact({
    ...rest,
    nombre_publico: rest.aparecer_como === 'nombre' ? nombre : undefined,
    // Solo se activa; quitarla es decisión del equipo
    ...(infoSensible ? { info_sensible: true, sensible_accion: sensibleAccion } : {}),
    // Vaciar un campo opcional también debe guardarse
    titulo: d.title.trim(),
    lugar_territorio: d.place.trim(),
    pregunta_tribunal: d.tribunalQuestion.trim(),
    enlaces_evidencia: [...d.links],
  })
}
