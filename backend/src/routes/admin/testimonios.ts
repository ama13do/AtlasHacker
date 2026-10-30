import { createRoute, z } from '@hono/zod-openapi';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { evidencias, testimonios, testimonios_auditoria } from '../../db/schema.js';
import { descifrarOpcional } from '../../lib/crypto.js';
import { E } from '../../lib/errors.js';
import { PaginacionOffset } from '../../lib/paginacion.js';
import { esAdmin, requiereUsuario } from '../../middleware/seguridad.js';
import { ERRORES, IdParam, SEG_USUARIO, Uuid, cuerpo, resp } from '../../schemas/comunes.js';
import { EditarEvidenciaSchema, EvidenciaParams, PresignEvidenciasSchema } from '../../schemas/evidencias.js';
import { CompromisoParam, CrearTestimonioStaffSchema, EditarTestimonioStaffSchema, FiltrosStaffQuery, RevisionTestimonioSchema } from '../../schemas/testimonios.js';
import { registrarBitacora } from '../../services/bitacora.js';
import { actualizarEvidencia, confirmarEvidencia, eliminarEvidencia, listarEvidencias, presignarEvidencias, urlEvidenciaStaff } from '../../services/evidencias.js';
import { confirmarOmision } from '../../services/seguimiento.js';
import { crearTestimonio, editarStaff, eliminarPermanente, listarStaff, moderar, obtenerStaff, publicarEnlace, revisarTestimonio, type AccionModeracion } from '../../services/testimonios.js';
import type { UsuarioAuth } from '../../types.js';
import { nuevoRouter, ok, sinCache } from '../base.js';

export const adminTestimonios = nuevoRouter();
const TAG = ['Dashboard · Testimonios'];
const TAG_EVID = ['Dashboard · Evidencias'];

// Roles (el superadmin pasa siempre):
//  · lectura: admin, moderador, lector y facilitador (este último solo lo que capturó); fuera de admin no se ven sensibles
//  · aprobar/rechazar: admin y moderador · editar, regresar a revisión y dar de baja: admin · eliminar: solo superadmin
//  · captura: admin, moderador y facilitador
const LEER = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador', 'lector', 'facilitador')] };
const APROBAR = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador')] };
const ADMIN = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin')] };
const CAPTURAR = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador', 'facilitador')] };
const SUPERADMIN = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('superadmin')] };

/** Acciones de moderación que también puede hacer el moderador (las demás son de administración). */
const ACCIONES_MODERADOR: AccionModeracion[] = ['aprobar', 'rechazar'];

/**
 * Administración ve todo. El facilitador solo lo que capturó; moderación y lectura no ven testimonios con
 * información sensible o de menores (esos son solo para administración).
 */
async function exigirAcceso(usuario: UsuarioAuth, testimonioId: string) {
  if (esAdmin(usuario)) return;
  const [t] = await getDb()
    .select({ f: testimonios.facilitador_id, sensible: sql<boolean>`${testimonios.info_sensible} or ${testimonios.info_menores}` })
    .from(testimonios)
    .where(eq(testimonios.id, testimonioId))
    .limit(1);
  const permitido = t && (usuario.rol === 'facilitador' ? t.f === usuario.id : !t.sensible);
  if (!permitido) throw E.noEncontrado('Testimonio');
}

/** Subir evidencias a una ficha: administración a cualquiera; los demás solo a las que capturaron. */
async function exigirCaptura(usuario: UsuarioAuth, testimonioId: string) {
  if (esAdmin(usuario)) return;
  const [t] = await getDb().select({ f: testimonios.facilitador_id }).from(testimonios).where(eq(testimonios.id, testimonioId)).limit(1);
  if (!t || t.f !== usuario.id) throw E.noEncontrado('Testimonio');
}

const alcance = (u: UsuarioAuth) => (esAdmin(u) ? {} : u.rol === 'facilitador' ? { facilitadorId: u.id } : { sinSensibles: true });

/* ───────────────────────────────────────────────── Lectura ───────────────────────────────────────────────── */

adminTestimonios.openapi(
  createRoute({
    ...LEER, method: 'get', path: '/api/admin/testimonios', summary: 'Listado de testimonios (cola de moderación y consulta)',
    description: 'Filtros combinables: estado, activo, categoría, expediente, entidad, autorización, sensibles, origen, persona, facilitador, folio, texto y fechas. Roles: admin, moderador, lector (estos dos sin los sensibles); el facilitador solo ve los suyos.',
    request: { query: FiltrosStaffQuery.extend(PaginacionOffset.shape) },
    responses: { 200: resp('Página de testimonios'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const { pagina, por_pagina, ...filtros } = c.req.valid('query');
    const u = c.get('usuario')!;
    const r = await listarStaff(filtros, pagina, por_pagina, alcance(u));
    return c.json({ success: true as const, data: r.filas, total: r.total, pagina, por_pagina, paginas: Math.ceil(r.total / por_pagina) }, 200);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...LEER, method: 'get', path: '/api/admin/testimonios/{id}', summary: 'Detalle completo de un testimonio',
    description: 'Ficha completa, ubicación exacta y pública, evidencias y estado. No incluye datos personales de la persona (para eso: `/api/admin/participantes/{id}`).',
    request: { params: IdParam }, responses: { 200: resp('Testimonio'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const { id } = c.req.valid('param');
    await exigirAcceso(c.get('usuario')!, id);
    return c.json(ok(await obtenerStaff(id)), 200);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...ADMIN, method: 'get', path: '/api/admin/testimonios/{id}/auditoria', summary: 'Auditoría del envío (IP, navegador, captcha, GPS…)',
    description: 'Solo admin. La IP se guarda cifrada y se descifra aquí; cada consulta queda en la bitácora. Solo existe si la auditoría de envío estaba activa al recibir el testimonio.',
    request: { params: IdParam }, responses: { 200: resp('Auditoría'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const { id } = c.req.valid('param');
    const [a] = await getDb().select().from(testimonios_auditoria).where(eq(testimonios_auditoria.testimonio_id, id)).limit(1);
    if (!a) throw E.noEncontrado('Auditoría de este testimonio');
    await registrarBitacora(c, { accion: 'auditoria.ver', entidad: 'testimonio', entidadId: id });
    const { ip_enc, ip_hash, ...resto } = a;
    return c.json(ok({ ...resto, ip: descifrarOpcional(ip_enc, 'auditoria.ip'), ip_hash }), 200);
  },
);

/* ─────────────────────────────────────────────── Crear / editar ─────────────────────────────────────────────── */

adminTestimonios.openapi(
  createRoute({
    ...CAPTURAR, method: 'post', path: '/api/admin/testimonios', summary: 'Capturar un testimonio (ficha en papel)',
    description:
      'Para facilitadores/as, moderadores y admin. Si no se indica `participante_id` se crea la persona y se devuelve su **folio** para entregárselo (aparece una sola vez). ' +
      'El testimonio queda registrado con el facilitador que lo capturó y sigue las reglas de publicación configuradas.',
    request: { body: cuerpo(CrearTestimonioStaffSchema) }, responses: { 201: resp('Testimonio creado'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const u = c.get('usuario')!;
    const input = c.req.valid('json');
    const r = await crearTestimonio(c, input, { origen: 'facilitador', usuario: u, participanteId: input.participante_id });
    return c.json(
      ok({
        testimonio: { id: r.id, folio: r.folio, estado: r.estado, publicado: r.es_publico },
        participante: { id: r.participante_id, folio: r.folio_participante ?? null },
        razon: r.razon,
      }),
      201,
    );
  },
);

adminTestimonios.openapi(
  createRoute({
    ...ADMIN, method: 'patch', path: '/api/admin/testimonios/{id}', summary: 'Editar cualquier aspecto de un testimonio',
    description: 'Solo administración. Contenido de la ficha, categoría, expediente, ubicación (y si es aproximada), estado, activo (1/0), notas internas… Cada cambio queda en la bitácora con el antes y el después.',
    request: { params: IdParam, body: cuerpo(EditarTestimonioStaffSchema) }, responses: { 200: resp('Testimonio actualizado'), ...ERRORES },
  }),
  async (c) => c.json(ok(await editarStaff(c, c.get('usuario')!, c.req.valid('param').id, c.req.valid('json'))), 200),
);

adminTestimonios.openapi(
  createRoute({
    ...APROBAR, method: 'patch', path: '/api/admin/testimonios/{id}/revision', summary: 'Ajustes del revisor para la guía',
    description:
      'Admin y moderación. Subcategoría corregida (mueve también la categoría y, si es megaproyecto, el pin público al centro del municipio), derecho adicional, ' +
      'gobierno que también debe responder, compromiso destacado y avisos (HxNF participa / cifras no verificadas). `null` vuelve a lo automático.',
    request: { params: IdParam, body: cuerpo(RevisionTestimonioSchema) }, responses: { 200: resp('Testimonio actualizado'), ...ERRORES },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    await exigirAcceso(c.get('usuario')!, id);
    return c.json(ok(await revisarTestimonio(c, id, c.req.valid('json'))), 200);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...APROBAR, method: 'post', path: '/api/admin/testimonios/{id}/seguimiento/{compromisoId}/confirmar', summary: 'Confirmar (o retirar) una omisión documentada (E3)',
    description: 'Admin y moderación. Solo se confirma si la persona registró una solicitud y la autoridad no acreditó implementación o no respondió.',
    request: { params: CompromisoParam, body: cuerpo(z.object({ confirmada: z.boolean() })) }, responses: { 200: resp('Seguimiento actualizado'), ...ERRORES },
  }),
  async (c) => {
    const u = c.get('usuario')!;
    const { id, compromisoId } = c.req.valid('param');
    await exigirAcceso(u, id);
    return c.json(ok(await confirmarOmision(c, u, id, compromisoId, c.req.valid('json').confirmada)), 200);
  },
);

/* ───────────────────────────────────────────────── Moderación ───────────────────────────────────────────────── */

const MotivoSchema = z.object({ motivo: z.string().trim().max(1000).optional() });
const AprobarSchema = z.object({ publicar_evidencias: z.boolean().optional().openapi({ description: 'Por defecto: true si la persona autorizó foto/audio/video. Recibos y documentos oficiales nunca se publican solos.' }) });

function accion(nombre: AccionModeracion, resumen: string, descripcion: string, schema: z.ZodObject<z.ZodRawShape>) {
  adminTestimonios.openapi(
    createRoute({
      ...(ACCIONES_MODERADOR.includes(nombre) ? APROBAR : ADMIN), method: 'post', path: `/api/admin/testimonios/{id}/${nombre}`, summary: resumen, description: descripcion,
      request: { params: IdParam, body: { content: { 'application/json': { schema } }, required: false } },
      responses: { 200: resp('Testimonio actualizado'), ...ERRORES },
    }),
    async (c) => {
      const body = (c.req.valid('json') ?? {}) as { motivo?: string; publicar_evidencias?: boolean };
      const u = c.get('usuario')!;
      const { id } = c.req.valid('param');
      await exigirAcceso(u, id);
      return c.json(ok(await moderar(c, u, id, nombre, body.motivo, body.publicar_evidencias)), 200);
    },
  );
}
accion('aprobar', 'Aprobar (publica en el mapa si cumple las reglas)', 'Admin y moderación. Si la persona no autorizó publicar o es «solo uso interno», se aprueba pero NO se publica.', AprobarSchema.extend(MotivoSchema.shape));
accion('rechazar', 'Rechazar', 'Admin y moderación. El motivo es obligatorio y la persona lo ve en «mis testimonios».', MotivoSchema);
accion('desaprobar', 'Regresar a revisión (retira del mapa)', 'Solo administración. Un testimonio aprobado vuelve a «pendiente».', MotivoSchema);
accion('activar', 'Activar (activo = 1)', 'Solo administración. Reactiva un testimonio dado de baja.', MotivoSchema);
accion('desactivar', 'Desactivar (activo = 0, baja lógica)', 'Solo administración. Lo oculta del mapa sin borrarlo de la base de datos.', MotivoSchema);

const LoteSchema = z.object({
  ids: z.array(Uuid).min(1).max(100),
  accion: z.enum(['aprobar', 'rechazar', 'desaprobar', 'activar', 'desactivar']),
  motivo: z.string().trim().max(1000).optional(),
});

adminTestimonios.openapi(
  createRoute({
    ...APROBAR, method: 'post', path: '/api/admin/testimonios/moderar-lote', summary: 'Moderar varios testimonios a la vez (máx. 100)',
    description: 'La moderación solo puede aprobar o rechazar; las demás acciones son de administración.',
    request: { body: cuerpo(LoteSchema) }, responses: { 200: resp('Resultado por testimonio'), ...ERRORES },
  }),
  async (c) => {
    const { ids, accion: a, motivo } = c.req.valid('json');
    const u = c.get('usuario')!;
    if (!esAdmin(u) && !ACCIONES_MODERADOR.includes(a)) throw E.prohibido('Tu rol solo puede aprobar o rechazar');
    const resultados: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        await exigirAcceso(u, id);
        await moderar(c, u, id, a, motivo);
        resultados.push({ id, ok: true });
      } catch (err) {
        resultados.push({ id, ok: false, error: (err as Error).message });
      }
    }
    return c.json(ok({ procesados: resultados.length, correctos: resultados.filter((r) => r.ok).length, resultados }), 200);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...SUPERADMIN, method: 'delete', path: '/api/admin/testimonios/{id}', summary: 'ELIMINAR PERMANENTEMENTE de la base de datos',
    description:
      '⚠️ Solo superadmin. Irreversible: borra el testimonio, sus comentarios, reacciones, auditoría y archivos de R2. Solo si se pide explícitamente: exige `confirmar=<folio del testimonio>`. ' +
      'Para ocultarlo sin borrarlo usa `POST /desactivar`.',
    request: { params: IdParam, query: z.object({ confirmar: z.string().min(3).openapi({ description: 'Folio exacto del testimonio, p. ej. FUTURO/001-T7K3MQ9X' }) }) },
    responses: { 200: resp('Eliminado'), ...ERRORES },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const { confirmar } = c.req.valid('query');
    const [t] = await getDb().select({ folio: testimonios.folio }).from(testimonios).where(eq(testimonios.id, id)).limit(1);
    if (!t) throw E.noEncontrado('Testimonio');
    if (confirmar.toUpperCase() !== t.folio.toUpperCase()) throw E.invalido('La confirmación no coincide con el folio del testimonio');
    await eliminarPermanente(c, id);
    return c.json(ok({ eliminado: true, folio: t.folio }), 200);
  },
);

/* ─────────────────────────────────────────────────── Evidencias ─────────────────────────────────────────────────── */

const EV_LEER = { tags: TAG_EVID, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador', 'lector', 'facilitador')] };
const EV_CAPTURAR = { tags: TAG_EVID, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador', 'facilitador')] };
const EV_SUPERADMIN = { tags: TAG_EVID, security: SEG_USUARIO, middleware: [requiereUsuario('superadmin')] };

adminTestimonios.openapi(
  createRoute({ ...EV_LEER, method: 'get', path: '/api/admin/testimonios/{id}/evidencias', summary: 'Evidencias de un testimonio', request: { params: IdParam }, responses: { 200: resp('Evidencias'), ...ERRORES } }),
  async (c) => {
    const { id } = c.req.valid('param');
    await exigirAcceso(c.get('usuario')!, id);
    return c.json(ok(await listarEvidencias(id)), 200);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...EV_CAPTURAR, method: 'post', path: '/api/admin/testimonios/{id}/evidencias', summary: 'Paso 1 · Reservar y pedir URLs de subida (R2)',
    description: 'Mismos límites configurables que en la zona pública (por defecto 5 archivos / 20 MB en total). Fuera de administración, solo en las fichas que capturó quien sube.',
    request: { params: IdParam, body: cuerpo(PresignEvidenciasSchema) }, responses: { 201: resp('URLs de subida'), ...ERRORES },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const u = c.get('usuario')!;
    await exigirCaptura(u, id);
    return c.json(ok(await presignarEvidencias(c, id, c.req.valid('json'), u.id)), 201);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...EV_CAPTURAR, method: 'post', path: '/api/admin/testimonios/{id}/evidencias/{evidenciaId}/confirmar', summary: 'Paso 2 · Confirmar archivo subido',
    request: { params: EvidenciaParams }, responses: { 200: resp('Evidencia confirmada'), ...ERRORES },
  }),
  async (c) => {
    const { id, evidenciaId } = c.req.valid('param');
    await exigirCaptura(c.get('usuario')!, id);
    const e = await confirmarEvidencia(c, id, evidenciaId);
    return c.json(ok({ id: e.id, folio: e.folio, estado_subida: e.estado_subida, bytes: e.bytes, publica: e.publica }), 200);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...EV_LEER, method: 'get', path: '/api/admin/evidencias/{id}/url', summary: 'URL temporal (5 min) para ver/descargar una evidencia',
    description: 'Cada consulta queda registrada en la bitácora.', request: { params: IdParam }, responses: { 200: resp('URL firmada'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const { id } = c.req.valid('param');
    const [ev] = await getDb().select({ testimonio_id: evidencias.testimonio_id }).from(evidencias).where(eq(evidencias.id, id)).limit(1);
    if (!ev) throw E.noEncontrado('Evidencia');
    await exigirAcceso(c.get('usuario')!, ev.testimonio_id);
    return c.json(ok(await urlEvidenciaStaff(c, id)), 200);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...EV_CAPTURAR, method: 'patch', path: '/api/admin/testimonios/{id}/evidencias/{evidenciaId}', summary: 'Hacer pública/privada u ocultar una evidencia',
    description: 'Administración: cualquier cambio. Quien capturó la ficha (facilitador/moderación): solo hacerla pública o privada.',
    request: { params: EvidenciaParams, body: cuerpo(EditarEvidenciaSchema) }, responses: { 200: resp('Actualizada'), ...ERRORES },
  }),
  async (c) => {
    const { id, evidenciaId } = c.req.valid('param');
    const u = c.get('usuario')!;
    const cambios = c.req.valid('json');
    await exigirCaptura(u, id);
    if (!esAdmin(u) && Object.keys(cambios).some((k) => k !== 'publica')) throw E.prohibido('Solo puedes hacer pública o privada la evidencia');
    await actualizarEvidencia(c, id, evidenciaId, cambios);
    return c.json(ok(await listarEvidencias(id)), 200);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...EV_CAPTURAR, method: 'patch', path: '/api/admin/testimonios/{id}/enlaces', summary: 'Hacer público/privado un link de evidencia',
    description: 'Administración en cualquier ficha; facilitador/moderación solo en las que capturó.',
    request: { params: IdParam, body: cuerpo(z.object({ url: z.string().max(2000), publica: z.boolean() }).openapi('PublicarEnlace')) },
    responses: { 200: resp('Links actualizados'), ...ERRORES },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    await exigirCaptura(c.get('usuario')!, id);
    const { url, publica } = c.req.valid('json');
    return c.json(ok(await publicarEnlace(c, id, url, publica)), 200);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...EV_SUPERADMIN, method: 'delete', path: '/api/admin/testimonios/{id}/evidencias/{evidenciaId}', summary: 'Eliminar una evidencia (también de R2)',
    description: 'Solo superadmin. Para solo ocultarla, usa PATCH con `activo: false`.', request: { params: EvidenciaParams }, responses: { 200: resp('Eliminada'), ...ERRORES },
  }),
  async (c) => {
    const { id, evidenciaId } = c.req.valid('param');
    await eliminarEvidencia(c, id, evidenciaId);
    return c.json(ok({ eliminada: true }), 200);
  },
);

