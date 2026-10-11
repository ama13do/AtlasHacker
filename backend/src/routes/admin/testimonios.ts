import { createRoute, z } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { testimonios, testimonios_auditoria } from '../../db/schema.js';
import { descifrarOpcional } from '../../lib/crypto.js';
import { E } from '../../lib/errors.js';
import { PaginacionOffset } from '../../lib/paginacion.js';
import { requiereUsuario } from '../../middleware/seguridad.js';
import { ERRORES, IdParam, SEG_USUARIO, Uuid, cuerpo, resp } from '../../schemas/comunes.js';
import { EditarEvidenciaSchema, EvidenciaParams, PresignEvidenciasSchema } from '../../schemas/evidencias.js';
import { CrearTestimonioStaffSchema, EditarTestimonioStaffSchema, FiltrosStaffQuery } from '../../schemas/testimonios.js';
import { registrarBitacora } from '../../services/bitacora.js';
import { actualizarEvidencia, confirmarEvidencia, eliminarEvidencia, listarEvidencias, presignarEvidencias, urlEvidenciaStaff } from '../../services/evidencias.js';
import { crearTestimonio, editarStaff, eliminarPermanente, listarStaff, moderar, obtenerStaff, type AccionModeracion } from '../../services/testimonios.js';
import type { UsuarioAuth } from '../../types.js';
import { nuevoRouter, ok, sinCache } from '../base.js';

export const adminTestimonios = nuevoRouter();
const TAG = ['Dashboard · Testimonios'];
const TAG_EVID = ['Dashboard · Evidencias'];

// Roles: lectura (admin, moderador, lector + facilitador solo lo suyo), moderación (admin, moderador), captura (admin, moderador, facilitador)
const LEER = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador', 'lector', 'facilitador')] };
const MODERAR = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador')] };
const CAPTURAR = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador', 'facilitador')] };
const SOLO_ADMIN = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin')] };

/** El facilitador solo ve y trabaja con los testimonios que él capturó. */
async function exigirAcceso(usuario: UsuarioAuth, testimonioId: string) {
  if (usuario.rol !== 'facilitador') return;
  const [t] = await getDb().select({ f: testimonios.facilitador_id }).from(testimonios).where(eq(testimonios.id, testimonioId)).limit(1);
  if (!t || t.f !== usuario.id) throw E.noEncontrado('Testimonio');
}

/* ───────────────────────────────────────────────── Lectura ───────────────────────────────────────────────── */

adminTestimonios.openapi(
  createRoute({
    ...LEER, method: 'get', path: '/api/admin/testimonios', summary: 'Listado de testimonios (cola de moderación y consulta)',
    description: 'Filtros combinables: estado, activo, categoría, expediente, entidad, autorización, sensibles, origen, persona, facilitador, folio, texto y fechas. Roles: admin, moderador, lector; el facilitador solo ve los suyos.',
    request: { query: FiltrosStaffQuery.extend(PaginacionOffset.shape) },
    responses: { 200: resp('Página de testimonios'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const { pagina, por_pagina, ...filtros } = c.req.valid('query');
    const u = c.get('usuario')!;
    const r = await listarStaff(filtros, pagina, por_pagina, u.rol === 'facilitador' ? u.id : undefined);
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
    ...SOLO_ADMIN, method: 'get', path: '/api/admin/testimonios/{id}/auditoria', summary: 'Auditoría del envío (IP, navegador, captcha, GPS…)',
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
    ...MODERAR, method: 'patch', path: '/api/admin/testimonios/{id}', summary: 'Editar cualquier aspecto de un testimonio',
    description: 'Contenido de la ficha, categoría, expediente, ubicación (y si es aproximada), estado, activo (1/0), notas internas… Cada cambio queda en la bitácora con el antes y el después.',
    request: { params: IdParam, body: cuerpo(EditarTestimonioStaffSchema) }, responses: { 200: resp('Testimonio actualizado'), ...ERRORES },
  }),
  async (c) => c.json(ok(await editarStaff(c, c.get('usuario')!, c.req.valid('param').id, c.req.valid('json'))), 200),
);

/* ───────────────────────────────────────────────── Moderación ───────────────────────────────────────────────── */

const MotivoSchema = z.object({ motivo: z.string().trim().max(1000).optional() });
const AprobarSchema = z.object({ publicar_evidencias: z.boolean().optional().openapi({ description: 'Por defecto: true si la persona autorizó foto/audio/video. Recibos y documentos oficiales nunca se publican solos.' }) });

function accion(nombre: AccionModeracion, resumen: string, descripcion: string, schema: z.ZodObject<z.ZodRawShape>) {
  adminTestimonios.openapi(
    createRoute({
      ...MODERAR, method: 'post', path: `/api/admin/testimonios/{id}/${nombre}`, summary: resumen, description: descripcion,
      request: { params: IdParam, body: { content: { 'application/json': { schema } }, required: false } },
      responses: { 200: resp('Testimonio actualizado'), ...ERRORES },
    }),
    async (c) => {
      const body = (c.req.valid('json') ?? {}) as { motivo?: string; publicar_evidencias?: boolean };
      return c.json(ok(await moderar(c, c.get('usuario')!, c.req.valid('param').id, nombre, body.motivo, body.publicar_evidencias)), 200);
    },
  );
}
accion('aprobar', 'Aprobar (publica en el mapa si cumple las reglas)', 'Si la persona no autorizó publicar o es «solo uso interno», se aprueba pero NO se publica.', AprobarSchema.extend(MotivoSchema.shape));
accion('rechazar', 'Rechazar', 'El motivo es obligatorio y la persona lo ve en «mis testimonios».', MotivoSchema);
accion('desaprobar', 'Regresar a revisión (retira del mapa)', 'Un testimonio aprobado vuelve a «pendiente».', MotivoSchema);
accion('activar', 'Activar (activo = 1)', 'Reactiva un testimonio dado de baja.', MotivoSchema);
accion('desactivar', 'Desactivar (activo = 0, baja lógica)', 'Lo oculta del mapa sin borrarlo de la base de datos.', MotivoSchema);

const LoteSchema = z.object({
  ids: z.array(Uuid).min(1).max(100),
  accion: z.enum(['aprobar', 'rechazar', 'desaprobar', 'activar', 'desactivar']),
  motivo: z.string().trim().max(1000).optional(),
});

adminTestimonios.openapi(
  createRoute({
    ...MODERAR, method: 'post', path: '/api/admin/testimonios/moderar-lote', summary: 'Moderar varios testimonios a la vez (máx. 100)',
    request: { body: cuerpo(LoteSchema) }, responses: { 200: resp('Resultado por testimonio'), ...ERRORES },
  }),
  async (c) => {
    const { ids, accion: a, motivo } = c.req.valid('json');
    const u = c.get('usuario')!;
    const resultados: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
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
    ...SOLO_ADMIN, method: 'delete', path: '/api/admin/testimonios/{id}', summary: 'ELIMINAR PERMANENTEMENTE de la base de datos',
    description:
      '⚠️ Irreversible: borra el testimonio, sus comentarios, reacciones, auditoría y archivos de R2. Solo si se pide explícitamente: exige `confirmar=<folio del testimonio>`. ' +
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
const EV_MODERAR = { tags: TAG_EVID, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador')] };

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
    description: 'Mismos límites configurables que en la zona pública (por defecto 5 archivos / 20 MB en total).',
    request: { params: IdParam, body: cuerpo(PresignEvidenciasSchema) }, responses: { 201: resp('URLs de subida'), ...ERRORES },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const u = c.get('usuario')!;
    await exigirAcceso(u, id);
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
    await exigirAcceso(c.get('usuario')!, id);
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
    return c.json(ok(await urlEvidenciaStaff(c, c.req.valid('param').id)), 200);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...EV_MODERAR, method: 'patch', path: '/api/admin/testimonios/{id}/evidencias/{evidenciaId}', summary: 'Hacer pública/privada u ocultar una evidencia',
    request: { params: EvidenciaParams, body: cuerpo(EditarEvidenciaSchema) }, responses: { 200: resp('Actualizada'), ...ERRORES },
  }),
  async (c) => {
    const { id, evidenciaId } = c.req.valid('param');
    await actualizarEvidencia(c, id, evidenciaId, c.req.valid('json'));
    return c.json(ok(await listarEvidencias(id)), 200);
  },
);

adminTestimonios.openapi(
  createRoute({
    ...EV_MODERAR, method: 'delete', path: '/api/admin/testimonios/{id}/evidencias/{evidenciaId}', summary: 'Eliminar una evidencia (también de R2)',
    description: 'Para solo ocultarla, usa PATCH con `activo: false`.', request: { params: EvidenciaParams }, responses: { 200: resp('Eliminada'), ...ERRORES },
  }),
  async (c) => {
    const { id, evidenciaId } = c.req.valid('param');
    await eliminarEvidencia(c, id, evidenciaId);
    return c.json(ok({ eliminada: true }), 200);
  },
);

