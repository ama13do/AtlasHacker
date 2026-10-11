import { and, desc, eq, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { getDb, type Ejecutor } from '../db/client.js';
import { colDe } from '../db/geo.js';
import { participantes, testimonios, type Participante } from '../db/schema.js';
import { cifrarOpcional, descifrarOpcional, hashCorreo, hashTelefono, hmac, normalizarCorreo, normalizarTelefono } from '../lib/crypto.js';
import { E } from '../lib/errors.js';
import { nuevoFolioParticipante, pistaFolio } from '../lib/ids.js';
import type { AppEnv } from '../types.js';
import { registrarBitacora } from './bitacora.js';

type Ctx = Context<AppEnv>;

export type DatosPersonales = { nombre?: string | null; correo?: string | null; telefono?: string | null };

/** Crea a la persona y devuelve su folio EN CLARO (única vez que existe así: en la BD solo queda su HMAC). */
export async function crearParticipante(
  tx: Ejecutor,
  datos: DatosPersonales,
  opciones: { creadoPorUsuarioId?: string; avisoVersion: string },
): Promise<{ id: string; folio: string }> {
  const folio = nuevoFolioParticipante();
  const [fila] = await tx
    .insert(participantes)
    .values({
      folio_hash: hmac(folio, 'folio'),
      folio_pista: pistaFolio(folio),
      nombre_enc: cifrarOpcional(datos.nombre?.trim(), 'participantes.nombre'),
      correo_enc: cifrarOpcional(datos.correo ? normalizarCorreo(datos.correo) : null, 'participantes.correo'),
      correo_hash: datos.correo ? hashCorreo(datos.correo) : null,
      telefono_enc: cifrarOpcional(datos.telefono ? normalizarTelefono(datos.telefono) : null, 'participantes.telefono'),
      telefono_hash: datos.telefono ? hashTelefono(datos.telefono) : null,
      aviso_privacidad_version: opciones.avisoVersion,
      aviso_privacidad_at: new Date(),
      creado_por_usuario_id: opciones.creadoPorUsuarioId ?? null,
    })
    .returning({ id: participantes.id });
  return { id: fila!.id, folio };
}

/** Descifra los datos personales. Úsese solo en endpoints con permiso y dejando rastro en la bitácora. */
export function descifrarDatos(p: Participante) {
  return {
    nombre: descifrarOpcional(p.nombre_enc, 'participantes.nombre'),
    correo: descifrarOpcional(p.correo_enc, 'participantes.correo'),
    telefono: descifrarOpcional(p.telefono_enc, 'participantes.telefono'),
  };
}

/** Resumen sin datos personales (indica solo QUÉ datos dejó la persona). */
export function resumenParticipante(p: Participante, conteos?: { testimonios: number; aprobados: number }) {
  return {
    id: p.id,
    folio_pista: p.folio_pista,
    perfil_publico: p.perfil_publico,
    nombre_publico: p.nombre_publico,
    dejo_nombre: Boolean(p.nombre_enc),
    dejo_correo: Boolean(p.correo_enc),
    dejo_telefono: Boolean(p.telefono_enc),
    aviso_privacidad_version: p.aviso_privacidad_version,
    aviso_privacidad_at: p.aviso_privacidad_at,
    activo: p.activo,
    datos_cancelados_at: p.datos_cancelados_at,
    created_at: p.created_at,
    ...(conteos ?? {}),
  };
}

export async function obtenerParticipante(id: string): Promise<Participante> {
  const [p] = await getDb().select().from(participantes).where(eq(participantes.id, id)).limit(1);
  if (!p) throw E.noEncontrado('Participante');
  return p;
}

export async function conteosParticipante(id: string) {
  const [r] = await getDb()
    .select({
      testimonios: sql<number>`count(*)::int`,
      aprobados: sql<number>`count(*) filter (where ${testimonios.es_publico})::int`,
    })
    .from(testimonios)
    .where(eq(testimonios.participante_id, id));
  return { testimonios: r?.testimonios ?? 0, aprobados: r?.aprobados ?? 0 };
}

/** Actualiza datos personales / perfil. Los campos con null se borran; los omitidos no cambian. */
export async function actualizarPerfil(
  c: Ctx,
  id: string,
  cambios: { nombre?: string | null; correo?: string | null; telefono?: string | null; perfil_publico?: boolean; nombre_publico?: string | null; activo?: boolean },
) {
  const set: Partial<typeof participantes.$inferInsert> = {};
  if (cambios.nombre !== undefined) set.nombre_enc = cifrarOpcional(cambios.nombre?.trim(), 'participantes.nombre');
  if (cambios.correo !== undefined) {
    set.correo_enc = cifrarOpcional(cambios.correo ? normalizarCorreo(cambios.correo) : null, 'participantes.correo');
    set.correo_hash = cambios.correo ? hashCorreo(cambios.correo) : null;
  }
  if (cambios.telefono !== undefined) {
    set.telefono_enc = cifrarOpcional(cambios.telefono ? normalizarTelefono(cambios.telefono) : null, 'participantes.telefono');
    set.telefono_hash = cambios.telefono ? hashTelefono(cambios.telefono) : null;
  }
  if (cambios.perfil_publico !== undefined) set.perfil_publico = cambios.perfil_publico;
  if (cambios.nombre_publico !== undefined) set.nombre_publico = cambios.nombre_publico;
  if (cambios.activo !== undefined) set.activo = cambios.activo;
  if (Object.keys(set).length === 0) throw E.invalido('No hay cambios que aplicar');

  const [p] = await getDb().update(participantes).set(set).where(eq(participantes.id, id)).returning();
  if (!p) throw E.noEncontrado('Participante');
  // Solo se registran los NOMBRES de los campos, nunca los valores personales
  await registrarBitacora(c, { accion: 'participante.actualizar', entidad: 'participante', entidadId: id, detalle: { campos: Object.keys(cambios) } });
  return p;
}

/**
 * Recuperación asistida: la persona escribió al equipo y se le emite un folio NUEVO (el anterior deja de servir).
 * El folio nuevo se devuelve una sola vez.
 */
export async function rotarFolio(c: Ctx, id: string) {
  await obtenerParticipante(id);
  const folio = nuevoFolioParticipante();
  await getDb().update(participantes).set({ folio_hash: hmac(folio, 'folio'), folio_pista: pistaFolio(folio) }).where(eq(participantes.id, id));
  await registrarBitacora(c, { accion: 'participante.rotar_folio', entidad: 'participante', entidadId: id });
  return { folio };
}

/**
 * Derecho de cancelación (ARCO): borra nombre, correo y teléfono (y sus índices). Opcionalmente anonimiza
 * los testimonios (se quita el nombre público y se generaliza la ubicación). Los testimonios en sí no se borran.
 */
export async function cancelarDatosPersonales(c: Ctx, id: string, anonimizarTestimonios: boolean) {
  await obtenerParticipante(id);
  await getDb().transaction(async (tx) => {
    await tx
      .update(participantes)
      .set({
        nombre_enc: null, correo_enc: null, correo_hash: null, telefono_enc: null, telefono_hash: null,
        nombre_publico: null, perfil_publico: false, datos_cancelados_at: new Date(),
      })
      .where(eq(participantes.id, id));
    if (anonimizarTestimonios) {
      await tx
        .update(testimonios)
        .set({ aparecer_como: 'anonimo', nombre_publico: null, ubicacion_aproximada: true })
        .where(eq(testimonios.participante_id, id));
    }
  });
  await registrarBitacora(c, { accion: 'participante.cancelar_datos', entidad: 'participante', entidadId: id, detalle: { anonimizarTestimonios } });
}

export async function buscarParticipantes(filtros: { correo?: string; telefono?: string; folio_pista?: string; pagina: number; por_pagina: number }) {
  const db = getDb();
  const condiciones = [];
  if (filtros.correo) condiciones.push(eq(participantes.correo_hash, hashCorreo(filtros.correo)));
  if (filtros.telefono) condiciones.push(eq(participantes.telefono_hash, hashTelefono(filtros.telefono)));
  if (filtros.folio_pista) condiciones.push(eq(participantes.folio_pista, filtros.folio_pista.toUpperCase()));
  const donde = condiciones.length ? and(...condiciones) : undefined;

  const filas = await db
    .select({
      p: participantes,
      testimonios: sql<number>`(select count(*)::int from testimonios t where t.participante_id = ${colDe('participantes', 'id')})`,
      aprobados: sql<number>`(select count(*)::int from testimonios t where t.participante_id = ${colDe('participantes', 'id')} and t.es_publico)`,
    })
    .from(participantes)
    .where(donde)
    .orderBy(desc(participantes.created_at), desc(participantes.id))
    .limit(filtros.por_pagina)
    .offset((filtros.pagina - 1) * filtros.por_pagina);
  const [{ total } = { total: 0 }] = await db.select({ total: sql<number>`count(*)::int` }).from(participantes).where(donde);
  return { filas: filas.map((f) => resumenParticipante(f.p, { testimonios: f.testimonios, aprobados: f.aprobados })), total };
}

/** Para el log de acceso a datos personales: nunca debe ir el valor, solo la acción. */
export async function registrarAccesoPII(c: Ctx, participanteId: string) {
  await registrarBitacora(c, { accion: 'participante.ver_datos_personales', entidad: 'participante', entidadId: participanteId });
}

