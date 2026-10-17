/**
 * ESQUEMA DE BASE DE DATOS · AtlasHacker (Tribunal Popular por Nuestro Futuro)
 * ---------------------------------------------------------------------------
 * Fuente de verdad del modelo. Basado en la "Ficha de Testimonio y Evidencia" (FUTURO/001).
 *
 *  - Todas las llaves primarias son UUID v4 aleatorios (nada secuencial).
 *  - Los nombres de propiedad son snake_case a propósito: coinciden con las columnas y con el JSON de la API.
 *  - Los datos personales (nombre, correo, teléfono, IP) se guardan CIFRADOS (AES-256-GCM, ver lib/crypto.ts)
 *    y, cuando hay que buscarlos, con un índice ciego (HMAC) aparte.
 *  - Las geometrías son PostGIS (SRID 4326): puntos, líneas y polígonos exactos.
 *  - Lo que no se puede expresar aquí (triggers, vistas, índices parciales/GiST, RLS, extensiones, datos
 *    semilla) vive en drizzle/*_postgis_extras.sql y se aplica con las mismas migraciones.
 *
 * Este archivo NO debe importar nada relativo (lo carga drizzle-kit directamente).
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ────────────────────────────── Tipos PostGIS ────────────────────────────── */

export type GeoJSONGeometry =
  | { type: 'Point'; coordinates: number[] }
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPoint'; coordinates: number[][] }
  | { type: 'MultiLineString'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

/**
 * geometry(Geometry, 4326). Se escribe con GeoJSON (la API recibe GeoJSON) y se LEE siempre con
 * ST_AsGeoJSON (ver db/geo.ts); no se selecciona la columna "cruda" (sería EWKB en hexadecimal).
 */
export const geometria = customType<{ data: GeoJSONGeometry; driverData: string }>({
  dataType: () => 'geometry(Geometry,4326)',
  toDriver: (v) => sql`ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(v)}), 4326))` as unknown as string,
});

/** geometry(Point, 4326): la calcula un trigger (ST_PointOnSurface), no se escribe desde la API. */
export const punto = customType<{ data: string | null }>({
  dataType: () => 'geometry(Point,4326)',
});

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

/* ─────────────────────────────────── Enums ───────────────────────────────── */

/** superadmin: una sola persona (alta por script); es la única que borra definitivamente, exporta y ve la bitácora. */
export const ROLES = ['superadmin', 'admin', 'moderador', 'facilitador', 'lector'] as const;
export const ESTADOS_MODERACION = ['pendiente', 'aprobado', 'rechazado'] as const;
export const AUTORIZACIONES = ['publico_con_nombre', 'publico_anonimo', 'solo_documentacion_interna', 'no_autoriza'] as const;
export const APARECER_COMO = ['nombre', 'anonimo'] as const;
export const TIENE_EVIDENCIA = ['si', 'no', 'pendiente'] as const;
export const MULTIMEDIA = ['si', 'no', 'na'] as const;
export const SENSIBLE_ACCIONES = ['anonimizar', 'uso_interno', 'revision_antes_publicar'] as const;
// Lista del Manual (C.7). 'recibo_factura' y 'documento_oficial' son de la primera versión: se conservan para
// los testimonios que ya los usan, pero ya no se ofrecen (ver TIPOS_EVIDENCIA_VIGENTES).
export const TIPOS_EVIDENCIA = [
  'recibo_factura', 'documento_oficial', 'foto', 'video', 'audio', 'mapa', 'estudio', 'datos', 'otro',
  'recibo', 'factura', 'oficio', 'contrato', 'registro_oficial', 'testimonio_escrito', 'testimonio_oral', 'nota_prensa',
] as const;
export const TIPOS_EVIDENCIA_LEGADOS = ['recibo_factura', 'documento_oficial'] as const;
/** Manual C.4: «¿Autoriza transmisión en vivo o grabación de su voz o imagen?» */
export const VOZ_IMAGEN = ['voz_imagen', 'solo_voz', 'ninguna'] as const;
export const TIPOS_REACCION = ['like', 'apoyo', 'alerta', 'fuego'] as const;
export const ORIGENES_TESTIMONIO = ['web', 'facilitador', 'importacion'] as const;
export const ORIGENES_UBICACION = ['gps', 'mapa', 'manual', 'importada'] as const;
export const ESTADOS_SUBIDA = ['pendiente', 'subida'] as const;
export const ACTORES = ['usuario', 'participante', 'anonimo', 'sistema'] as const;

export const rolUsuario = pgEnum('rol_usuario', ROLES);
export const estadoModeracion = pgEnum('estado_moderacion', ESTADOS_MODERACION);
export const autorizacionPublicacion = pgEnum('autorizacion_publicacion', AUTORIZACIONES);
export const aparecerComo = pgEnum('aparecer_como', APARECER_COMO);
export const tieneEvidencia = pgEnum('tiene_evidencia', TIENE_EVIDENCIA);
export const multimedia = pgEnum('autoriza_multimedia', MULTIMEDIA);
export const vozImagen = pgEnum('autoriza_voz_imagen', VOZ_IMAGEN);
export const sensibleAccion = pgEnum('sensible_accion', SENSIBLE_ACCIONES);
export const tipoEvidencia = pgEnum('tipo_evidencia', TIPOS_EVIDENCIA);
export const tipoReaccion = pgEnum('tipo_reaccion', TIPOS_REACCION);
export const origenTestimonio = pgEnum('origen_testimonio', ORIGENES_TESTIMONIO);
export const origenUbicacion = pgEnum('origen_ubicacion', ORIGENES_UBICACION);
export const estadoSubida = pgEnum('estado_subida', ESTADOS_SUBIDA);
export const actorTipo = pgEnum('actor_tipo', ACTORES);

const ts = (nombre: string) => timestamp(nombre, { withTimezone: true, mode: 'date' });
const creado = () => ts('created_at').notNull().defaultNow();
const actualizado = () => ts('updated_at').notNull().defaultNow();

/* ─────────────────────────── Catálogos: expediente y categoría ─────────────────────────── */

/** "Expediente FUTURO/001 · Materia: Sistema Energético Nacional". Apartado propio, con su número. */
export const expedientes = pgTable('expedientes', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull().unique(), // FUTURO/001
  titulo: text('titulo').notNull(),
  materia: text('materia').notNull(), // Sistema Energético Nacional
  descripcion: text('descripcion'),
  activo: boolean('activo').notNull().default(true),
  created_at: creado(),
  updated_at: actualizado(),
});

export const categorias = pgTable('categorias', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  color: text('color'), // #RRGGBB para el mapa
  icono: text('icono'),
  orden: integer('orden').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  created_at: creado(),
  updated_at: actualizado(),
});

/* ───────────────────────────── Usuarios del dashboard ───────────────────────────── */

export const usuarios = pgTable(
  'usuarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    nombre: text('nombre').notNull(),
    password_hash: text('password_hash').notNull(), // argon2id
    rol: rolUsuario('rol').notNull().default('lector'),
    activo: boolean('activo').notNull().default(true),
    intentos_fallidos: integer('intentos_fallidos').notNull().default(0),
    bloqueado_hasta: ts('bloqueado_hasta'),
    ultimo_login_at: ts('ultimo_login_at'),
    debe_cambiar_password: boolean('debe_cambiar_password').notNull().default(false),
    password_cambiada_at: ts('password_cambiada_at'),
    // Los access tokens emitidos antes de esta fecha dejan de valer (cerrar sesión en todos lados, cambio de contraseña)
    tokens_validos_desde: ts('tokens_validos_desde').notNull().defaultNow(),
    created_at: creado(),
    updated_at: actualizado(),
  },
  (t) => [uniqueIndex('uq_usuarios_email').on(sql`lower(${t.email})`), index('idx_usuarios_rol').on(t.rol)],
);

/** Refresh tokens (solo su hash). Rotación en cada uso + detección de reutilización por "familia". */
export const sesiones = pgTable(
  'sesiones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuario_id: uuid('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
    familia_id: uuid('familia_id').notNull(),
    token_hash: text('token_hash').notNull().unique(),
    expira_en: ts('expira_en').notNull(),
    revocada_at: ts('revocada_at'),
    reemplazada_por: uuid('reemplazada_por'),
    user_agent: text('user_agent'),
    ip_hash: text('ip_hash'),
    created_at: creado(),
  },
  (t) => [index('idx_sesiones_usuario').on(t.usuario_id), index('idx_sesiones_familia').on(t.familia_id), index('idx_sesiones_expira').on(t.expira_en)],
);

/* ─────────────────────────────── Participantes (folio) ─────────────────────────────── */

/**
 * Toda persona que aporta recibe un folio/token (aunque sea anónima). Con él puede subir y administrar sus
 * testimonios, y el equipo sabe cuántos aporta cada persona. Del folio solo se guarda el HMAC.
 */
export const participantes = pgTable(
  'participantes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    folio_hash: text('folio_hash').notNull().unique(),
    folio_pista: text('folio_pista').notNull(), // últimos 4 caracteres, para recuperación asistida
    // Datos personales opcionales (cifrados) + índices ciegos para buscar sin descifrar
    nombre_enc: text('nombre_enc'),
    correo_enc: text('correo_enc'),
    correo_hash: text('correo_hash'),
    telefono_enc: text('telefono_enc'),
    telefono_hash: text('telefono_hash'),
    // "Hacerlo público": perfil visible con el nombre que la persona decida mostrar (opcional)
    perfil_publico: boolean('perfil_publico').notNull().default(false),
    nombre_publico: text('nombre_publico'),
    aviso_privacidad_version: text('aviso_privacidad_version'),
    aviso_privacidad_at: ts('aviso_privacidad_at'),
    creado_por_usuario_id: uuid('creado_por_usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
    activo: boolean('activo').notNull().default(true),
    datos_cancelados_at: ts('datos_cancelados_at'), // derecho de cancelación (ARCO)
    created_at: creado(),
    updated_at: actualizado(),
  },
  (t) => [index('idx_participantes_correo_hash').on(t.correo_hash), index('idx_participantes_telefono_hash').on(t.telefono_hash)],
);

/* ───────────────────────────────────── Testimonios ───────────────────────────────────── */

export const testimonios = pgTable(
  'testimonios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    folio: text('folio').notNull().unique(), // FUTURO/001-T7K3MQ9X
    expediente_id: uuid('expediente_id').notNull().references(() => expedientes.id, { onDelete: 'restrict' }),
    categoria_id: uuid('categoria_id').notNull().references(() => categorias.id, { onDelete: 'restrict' }),
    participante_id: uuid('participante_id').notNull().references(() => participantes.id, { onDelete: 'restrict' }),
    origen: origenTestimonio('origen').notNull().default('web'),

    // Encabezado de la ficha: fecha, lugar/territorio, facilitador/a, cómo desea aparecer
    fecha: date('fecha', { mode: 'string' }).notNull().default(sql`current_date`),
    titulo: text('titulo'),
    lugar_territorio: text('lugar_territorio'),
    entidad: text('entidad'),
    municipio: text('municipio'),
    facilitador_id: uuid('facilitador_id').references(() => usuarios.id, { onDelete: 'set null' }),
    facilitador_nombre: text('facilitador_nombre'),
    aparecer_como: aparecerComo('aparecer_como').notNull().default('anonimo'),
    nombre_publico: text('nombre_publico'), // solo si aparecer_como = 'nombre'; la vista pública lo oculta si aplica

    // Geografía (PostGIS). "ubicacion" es la exacta (privada); "ubicacion_publica" es la que ve el mapa.
    ubicacion: geometria('ubicacion').notNull(),
    tipo_geometria: text('tipo_geometria'), // trigger: ST_GeometryType
    centroide: punto('centroide'), // trigger: ST_PointOnSurface (pin del mapa para líneas y polígonos)
    ubicacion_aproximada: boolean('ubicacion_aproximada').notNull().default(false),
    ubicacion_publica: geometria('ubicacion_publica'), // trigger
    centroide_publico: punto('centroide_publico'), // trigger
    origen_ubicacion: origenUbicacion('origen_ubicacion').notNull().default('mapa'),

    // 1 · EL TESTIMONIO · 2 · EL TERRITORIO DICE · 3 · LA COMUNIDAD DICE
    relato: text('relato').notNull(),
    territorio_dice: text('territorio_dice'),
    comunidad_dice: text('comunidad_dice'),

    // 4 · EL RECIBO / DOCUMENTO DICE · EVIDENCIAS QUE ACOMPAÑAN
    tiene_evidencia: tieneEvidencia('tiene_evidencia').notNull().default('no'),
    evidencia_descripcion: text('evidencia_descripcion'),
    evidencia_tipos: tipoEvidencia('evidencia_tipos').array().notNull().default(sql`'{}'::tipo_evidencia[]`),
    evidencia_otro: text('evidencia_otro'),

    // 04 · LOS DATOS DICEN (datos + varias fuentes) · 05 · LA PREGUNTA DEL TRIBUNAL
    dato_fuente_anio: text('dato_fuente_anio'), // «Datos» (texto libre)
    fuentes: jsonb('fuentes').$type<{ fuente: string; anio?: number; enlace?: string }[]>().notNull().default([]),
    fuente_pendiente_verificacion: boolean('fuente_pendiente_verificacion').notNull().default(false),
    pregunta_tribunal: text('pregunta_tribunal'),

    // Manual C.11 · La última pregunta: «¿Hay algo que no te preguntamos…?» (público) y «¿Cómo te gustaría que
    // quedara registrada tu voz?» (indicación para el equipo, no se publica)
    algo_mas: text('algo_mas'),
    registro_voz: text('registro_voz'),

    // CONSENTIMIENTO
    consentimiento_aceptado: boolean('consentimiento_aceptado').notNull(),
    autorizacion: autorizacionPublicacion('autorizacion').notNull(),
    // Manual C.10: «¿Las personas fotografiadas autorizaron el uso de su imagen?» (sí / no / no aplica)
    autoriza_multimedia: multimedia('autoriza_multimedia').notNull().default('na'),
    // Manual C.4: transmisión en vivo o grabación (null = no se preguntó, fichas anteriores)
    autoriza_voz_imagen: vozImagen('autoriza_voz_imagen'),
    consentimiento_version: text('consentimiento_version').notNull(),
    consentimiento_at: ts('consentimiento_at').notNull().defaultNow(),

    // INFORMACIÓN SENSIBLE
    info_sensible: boolean('info_sensible').notNull().default(false),
    // Manual C.10: información de niñas, niños o adolescentes (nunca se publica sola: ver reglas)
    info_menores: boolean('info_menores').notNull().default(false),
    sensible_accion: sensibleAccion('sensible_accion'),

    // Moderación y visibilidad. activo = baja lógica (true/false); es_publico lo mantiene un trigger.
    estado: estadoModeracion('estado').notNull().default('pendiente'),
    moderado_por: uuid('moderado_por').references(() => usuarios.id, { onDelete: 'set null' }),
    moderado_at: ts('moderado_at'),
    motivo_rechazo: text('motivo_rechazo'),
    notas_internas: text('notas_internas'),
    activo: boolean('activo').notNull().default(true),
    es_publico: boolean('es_publico').notNull().default(false),
    publicado_at: ts('publicado_at'),

    // Contadores (los mantienen triggers, sin condiciones de carrera)
    reacciones_conteo: jsonb('reacciones_conteo').$type<Record<string, number>>().notNull().default({}),
    reacciones_total: integer('reacciones_total').notNull().default(0),
    comentarios_conteo: integer('comentarios_conteo').notNull().default(0),

    busqueda: tsvector('busqueda').generatedAlwaysAs(
      sql`to_tsvector('spanish', coalesce(titulo,'') || ' ' || coalesce(lugar_territorio,'') || ' ' || coalesce(relato,'') || ' ' || coalesce(territorio_dice,'') || ' ' || coalesce(comunidad_dice,'') || ' ' || coalesce(pregunta_tribunal,''))`,
    ),

    created_at: creado(),
    updated_at: actualizado(),
  },
  (t) => [
    index('idx_testimonios_estado_fecha').on(t.estado, t.created_at.desc()),
    index('idx_testimonios_categoria').on(t.categoria_id),
    index('idx_testimonios_expediente').on(t.expediente_id),
    index('idx_testimonios_participante').on(t.participante_id),
    index('idx_testimonios_facilitador').on(t.facilitador_id),
    index('idx_testimonios_created').on(t.created_at.desc(), t.id.desc()),
    index('idx_testimonios_entidad').on(t.entidad),
    check('chk_consentimiento', sql`${t.consentimiento_aceptado} = true`),
    check('chk_sensible_accion', sql`NOT ${t.info_sensible} OR ${t.sensible_accion} IS NOT NULL`),
    check('chk_nombre_publico', sql`${t.aparecer_como} = 'nombre' OR ${t.nombre_publico} IS NULL`),
  ],
);

/** Auditoría OPCIONAL del envío (se activa en configuración): lo necesario para validar un testimonio. */
export const testimonios_auditoria = pgTable(
  'testimonios_auditoria',
  {
    testimonio_id: uuid('testimonio_id').primaryKey().references(() => testimonios.id, { onDelete: 'cascade' }),
    ip_enc: text('ip_enc'),
    ip_hash: text('ip_hash'),
    user_agent: text('user_agent'),
    huella_dispositivo_hash: text('huella_dispositivo_hash'),
    captcha_ok: boolean('captcha_ok'),
    origen_ubicacion: origenUbicacion('origen_ubicacion'),
    precision_gps_m: real('precision_gps_m'),
    zona_horaria: text('zona_horaria'),
    idioma: text('idioma'),
    pantalla: text('pantalla'),
    referer: text('referer'),
    consentimiento_version: text('consentimiento_version'),
    extra: jsonb('extra').$type<Record<string, unknown>>(),
    retener_hasta: ts('retener_hasta'), // purga automática pasada esta fecha
    created_at: creado(),
  },
  (t) => [index('idx_auditoria_ip_hash').on(t.ip_hash), index('idx_auditoria_retener').on(t.retener_hasta)],
);

/* ──────────────────────────────────── Evidencias (R2) ──────────────────────────────────── */

export const evidencias = pgTable(
  'evidencias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    folio: text('folio').notNull().unique(), // FUTURO/001-E4XA9ZP2
    testimonio_id: uuid('testimonio_id').notNull().references(() => testimonios.id, { onDelete: 'cascade' }),
    tipo: tipoEvidencia('tipo').notNull(),
    estado_subida: estadoSubida('estado_subida').notNull().default('pendiente'),
    storage_key: text('storage_key').notNull().unique(), // clave en R2 (aleatoria; el bucket es privado)
    nombre_original: text('nombre_original'),
    mime: text('mime').notNull(),
    bytes_declarados: bigint('bytes_declarados', { mode: 'number' }).notNull(),
    bytes: bigint('bytes', { mode: 'number' }), // tamaño real verificado en R2
    descripcion: text('descripcion'),
    publica: boolean('publica').notNull().default(false),
    activo: boolean('activo').notNull().default(true),
    subida_por_usuario_id: uuid('subida_por_usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
    created_at: creado(),
    confirmada_at: ts('confirmada_at'),
  },
  (t) => [index('idx_evidencias_testimonio').on(t.testimonio_id), check('chk_evidencia_bytes', sql`${t.bytes_declarados} > 0`)],
);

/* ──────────────────────────── Comentarios, likes y reacciones ──────────────────────────── */

export const comentarios = pgTable(
  'comentarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    testimonio_id: uuid('testimonio_id').notNull().references(() => testimonios.id, { onDelete: 'cascade' }),
    participante_id: uuid('participante_id').references(() => participantes.id, { onDelete: 'set null' }),
    autor_nombre: text('autor_nombre'),
    contenido: text('contenido').notNull(),
    estado: estadoModeracion('estado').notNull().default('aprobado'),
    activo: boolean('activo').notNull().default(true),
    likes_conteo: integer('likes_conteo').notNull().default(0),
    huella_hash: text('huella_hash'),
    created_at: creado(),
    updated_at: actualizado(),
  },
  (t) => [index('idx_comentarios_testimonio').on(t.testimonio_id, t.created_at, t.id), check('chk_comentario_len', sql`char_length(${t.contenido}) BETWEEN 1 AND 2000`)],
);

/** Un like por dispositivo y comentario (la huella es un HMAC, nunca el dato original). */
export const comentarios_likes = pgTable(
  'comentarios_likes',
  {
    comentario_id: uuid('comentario_id').notNull().references(() => comentarios.id, { onDelete: 'cascade' }),
    huella_hash: text('huella_hash').notNull(),
    created_at: creado(),
  },
  (t) => [primaryKey({ columns: [t.comentario_id, t.huella_hash] })],
);

export const reacciones = pgTable(
  'reacciones',
  {
    testimonio_id: uuid('testimonio_id').notNull().references(() => testimonios.id, { onDelete: 'cascade' }),
    huella_hash: text('huella_hash').notNull(),
    tipo: tipoReaccion('tipo').notNull(),
    created_at: creado(),
  },
  (t) => [primaryKey({ columns: [t.testimonio_id, t.huella_hash, t.tipo] })],
);

/* ───────────────────────────── Configuración y bitácora ───────────────────────────── */

/** Clave/valor editable desde el dashboard (modo de publicación, límites de archivos, captcha, auditoría...). */
export const configuracion = pgTable('configuracion', {
  clave: text('clave').primaryKey(),
  valor: jsonb('valor').notNull(),
  descripcion: text('descripcion'),
  updated_by: uuid('updated_by').references(() => usuarios.id, { onDelete: 'set null' }),
  updated_at: actualizado(),
});

/** Bitácora de acciones: quién hizo qué y qué cambió. Solo se agrega (un trigger impide UPDATE/DELETE). */
export const bitacora = pgTable(
  'bitacora',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    created_at: creado(),
    actor_tipo: actorTipo('actor_tipo').notNull(),
    usuario_id: uuid('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
    usuario_email: text('usuario_email'), // instantánea: se conserva aunque el usuario se elimine
    usuario_nombre: text('usuario_nombre'), // instantánea
    usuario_rol: text('usuario_rol'), // instantánea (el rol que tenía al actuar)
    participante_id: uuid('participante_id'),
    accion: text('accion').notNull(), // p. ej. testimonio.aprobar
    entidad: text('entidad').notNull(),
    entidad_id: text('entidad_id'),
    folio: text('folio'), // folio del testimonio afectado, para buscar y leer sin cruzar tablas
    antes: jsonb('antes'),
    despues: jsonb('despues'),
    detalle: jsonb('detalle'),
    ip_enc: text('ip_enc'),
    user_agent: text('user_agent'),
    request_id: text('request_id'),
  },
  (t) => [
    index('idx_bitacora_fecha').on(t.created_at.desc(), t.id.desc()),
    index('idx_bitacora_usuario').on(t.usuario_id, t.created_at.desc()),
    index('idx_bitacora_entidad').on(t.entidad, t.entidad_id),
    index('idx_bitacora_accion').on(t.accion),
    index('idx_bitacora_folio').on(t.folio),
  ],
);

/* ───────────────────────────── Enlace /ir (QR impreso) y eventos ───────────────────────────── */

/**
 * Visitas a atlashacker.hxnf.mx/ir: una fila por hora (no por visita) con el total y las personas distintas
 * (IP + dispositivo, una vez al día; la huella vive en la tabla UNLOGGED ir_vistos del SQL extra y se purga a diario).
 */
export const ir_visitas = pgTable('ir_visitas', {
  hora: ts('hora').primaryKey(),
  total: integer('total').notNull().default(0),
  unicos: integer('unicos').notNull().default(0),
});

/** Evento (feria, foro…): solo nombre y horario. Las visitas de /ir dentro del horario cuentan para el evento. */
export const eventos = pgTable(
  'eventos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nombre: text('nombre').notNull(),
    lugar: text('lugar'),
    inicio: ts('inicio').notNull(),
    fin: ts('fin').notNull(),
    created_by: uuid('created_by').references(() => usuarios.id, { onDelete: 'set null' }),
    created_at: creado(),
    updated_at: actualizado(),
  },
  (t) => [check('chk_eventos_horario', sql`${t.fin} > ${t.inicio}`), index('idx_eventos_inicio').on(t.inicio.desc())],
);

/* ──────────────── Vista pública (definida en el SQL extra; aquí solo su forma) ──────────────── */

/**
 * v_testimonios_publicos: ÚNICA fuente de lo que ve el público (y el rol de solo lectura para QGIS).
 * Aplica las reglas: es_publico, nombre oculto si es anónimo/sensible, geometría pública (exacta o aproximada).
 */
export const v_testimonios_publicos = pgView('v_testimonios_publicos', {
  id: uuid('id'),
  folio: text('folio'),
  expediente_id: uuid('expediente_id'),
  expediente_codigo: text('expediente_codigo'),
  categoria_id: uuid('categoria_id'),
  categoria_slug: text('categoria_slug'),
  categoria_nombre: text('categoria_nombre'),
  categoria_color: text('categoria_color'),
  titulo: text('titulo'),
  fecha: date('fecha', { mode: 'string' }),
  lugar_territorio: text('lugar_territorio'),
  entidad: text('entidad'),
  municipio: text('municipio'),
  nombre_publico: text('nombre_publico'),
  relato: text('relato'),
  territorio_dice: text('territorio_dice'),
  comunidad_dice: text('comunidad_dice'),
  tiene_evidencia: tieneEvidencia('tiene_evidencia'),
  evidencia_tipos: tipoEvidencia('evidencia_tipos').array(),
  dato_fuente_anio: text('dato_fuente_anio'),
  fuente_pendiente_verificacion: boolean('fuente_pendiente_verificacion'),
  pregunta_tribunal: text('pregunta_tribunal'),
  tipo_geometria: text('tipo_geometria'),
  ubicacion_aproximada: boolean('ubicacion_aproximada'),
  ubicacion_publica: geometria('ubicacion_publica'),
  centroide_publico: punto('centroide_publico'),
  reacciones_conteo: jsonb('reacciones_conteo').$type<Record<string, number>>(),
  reacciones_total: integer('reacciones_total'),
  comentarios_conteo: integer('comentarios_conteo'),
  publicado_at: ts('publicado_at'),
  created_at: ts('created_at'),
  busqueda: tsvector('busqueda'),
  // Agregadas en 0002 (al final: CREATE OR REPLACE VIEW solo admite columnas nuevas al final)
  fuentes: jsonb('fuentes').$type<{ fuente: string; anio?: number; enlace?: string }[]>(),
  algo_mas: text('algo_mas'),
}).existing();

export type Testimonio = typeof testimonios.$inferSelect;
export type NuevoTestimonio = typeof testimonios.$inferInsert;
export type Participante = typeof participantes.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
export type Rol = (typeof ROLES)[number];
