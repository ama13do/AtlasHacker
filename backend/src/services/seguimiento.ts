import { and, asc, eq, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { getDb } from '../db/client.js';
import { seguimiento_compromisos, testimonios, usuarios } from '../db/schema.js';
import { E } from '../lib/errors.js';
import type { SeguimientoInput } from '../schemas/testimonios.js';
import type { AppEnv, UsuarioAuth } from '../types.js';
import { registrarBitacora } from './bitacora.js';

type Ctx = Context<AppEnv>;
type Fila = typeof seguimiento_compromisos.$inferSelect;
const MAX_COMPROMISOS = 40; // la guía muestra el principal y los de «Ver más» (menos de 10 por caso)

export type EstadoHallazgo = 'E1' | 'E2' | 'E3' | 'cerrado';

/**
 * Estado del hallazgo (Excel, Mi folio, fórmula G5):
 * E3 = registró una solicitud y la autoridad no acreditó o no respondió · cerrado = acreditó implementación ·
 * E2 = respondió que no ha llegado (o no lo conocía) · E1 = compromiso identificado.
 */
export function estadoHallazgo(s: Pick<Fila, 'llego' | 'solicitud' | 'respuesta'>): EstadoHallazgo {
  if (s.solicitud && (s.respuesta === 'no_acredita' || s.respuesta === 'sin_respuesta')) return 'E3';
  if (s.respuesta === 'acredita') return 'cerrado';
  if (s.llego === 'no' || s.llego === 'no_lo_conocia') return 'E2';
  return 'E1';
}

export async function listarSeguimiento(testimonioId: string) {
  const filas = await getDb()
    .select({
      compromiso_id: seguimiento_compromisos.compromiso_id,
      llego: seguimiento_compromisos.llego,
      solicitud: seguimiento_compromisos.solicitud,
      folio_solicitud: seguimiento_compromisos.folio_solicitud,
      respuesta: seguimiento_compromisos.respuesta,
      omision_confirmada: seguimiento_compromisos.omision_confirmada,
      confirmado_at: seguimiento_compromisos.confirmado_at,
      confirmado_por_nombre: usuarios.nombre,
      updated_at: seguimiento_compromisos.updated_at,
    })
    .from(seguimiento_compromisos)
    .leftJoin(usuarios, eq(usuarios.id, seguimiento_compromisos.confirmado_por))
    .where(eq(seguimiento_compromisos.testimonio_id, testimonioId))
    .orderBy(asc(seguimiento_compromisos.created_at));
  return filas.map((f) => ({ ...f, estado: estadoHallazgo(f) }));
}

/** Lo que responde la persona en su guía. Si cambia algo, la omisión confirmada se vuelve a revisar. */
export async function guardarSeguimiento(c: Ctx, testimonioId: string, compromisoId: string, input: SeguimientoInput) {
  const db = getDb();
  const [t] = await db.select({ folio: testimonios.folio, activo: testimonios.activo }).from(testimonios).where(eq(testimonios.id, testimonioId)).limit(1);
  if (!t) throw E.noEncontrado('Testimonio');
  if (!t.activo) throw E.prohibido('Este testimonio está dado de baja');

  const donde = and(eq(seguimiento_compromisos.testimonio_id, testimonioId), eq(seguimiento_compromisos.compromiso_id, compromisoId));
  const [actual] = await db.select().from(seguimiento_compromisos).where(donde).limit(1);
  if (!actual) {
    const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(seguimiento_compromisos).where(eq(seguimiento_compromisos.testimonio_id, testimonioId));
    if ((n?.n ?? 0) >= MAX_COMPROMISOS) throw E.invalido('Demasiados compromisos en seguimiento');
  }

  const base = actual ?? { llego: null, folio_solicitud: null, respuesta: 'pendiente' as const };
  const folio = input.folio_solicitud !== undefined ? input.folio_solicitud || null : base.folio_solicitud;
  const nuevo = {
    llego: input.llego !== undefined ? input.llego : base.llego,
    folio_solicitud: folio,
    solicitud: Boolean(folio), // como en el Excel: hay solicitud si escribió su folio
    respuesta: input.respuesta ?? base.respuesta,
  };
  const cambio = !actual || (['llego', 'folio_solicitud', 'respuesta'] as const).some((k) => nuevo[k] !== actual[k]);
  if (!cambio) return listarSeguimiento(testimonioId);

  const reinicio = { omision_confirmada: false, confirmado_por: null, confirmado_at: null };
  if (actual) await db.update(seguimiento_compromisos).set({ ...nuevo, ...reinicio }).where(donde);
  else await db.insert(seguimiento_compromisos).values({ testimonio_id: testimonioId, compromiso_id: compromisoId, ...nuevo });

  // Sin el folio de la solicitud en la bitácora: solo qué compromiso y en qué estado quedó
  await registrarBitacora(c, {
    accion: 'seguimiento.editar',
    entidad: 'testimonio',
    entidadId: testimonioId,
    folio: t.folio,
    despues: { compromiso: compromisoId, estado: estadoHallazgo(nuevo), llego: nuevo.llego, respuesta: nuevo.respuesta },
  });
  return listarSeguimiento(testimonioId);
}

/** Moderación o administración confirma (o retira) la omisión documentada (E3) de un compromiso. */
export async function confirmarOmision(c: Ctx, usuario: UsuarioAuth, testimonioId: string, compromisoId: string, confirmada: boolean) {
  const db = getDb();
  const donde = and(eq(seguimiento_compromisos.testimonio_id, testimonioId), eq(seguimiento_compromisos.compromiso_id, compromisoId));
  const [actual] = await db.select().from(seguimiento_compromisos).where(donde).limit(1);
  if (!actual) throw E.noEncontrado('Seguimiento del compromiso');
  if (confirmada && estadoHallazgo(actual) !== 'E3') throw E.invalido('Solo se confirma una omisión documentada (E3): solicitud registrada sin acreditación o sin respuesta');

  await db
    .update(seguimiento_compromisos)
    .set(confirmada ? { omision_confirmada: true, confirmado_por: usuario.id, confirmado_at: new Date() } : { omision_confirmada: false, confirmado_por: null, confirmado_at: null })
    .where(donde);
  const [t] = await db.select({ folio: testimonios.folio }).from(testimonios).where(eq(testimonios.id, testimonioId)).limit(1);
  await registrarBitacora(c, {
    accion: confirmada ? 'seguimiento.confirmar_omision' : 'seguimiento.retirar_omision',
    entidad: 'testimonio',
    entidadId: testimonioId,
    folio: t?.folio,
    antes: { compromiso: compromisoId, omision_confirmada: actual.omision_confirmada },
    despues: { compromiso: compromisoId, omision_confirmada: confirmada },
  });
  return listarSeguimiento(testimonioId);
}
