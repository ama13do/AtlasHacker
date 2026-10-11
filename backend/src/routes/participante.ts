import { createRoute, z } from '@hono/zod-openapi';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { testimonios } from '../db/schema.js';
import { E } from '../lib/errors.js';
import { requiereFolio } from '../middleware/seguridad.js';
import { ERRORES, IdParam, SEG_FOLIO, cuerpo, resp } from '../schemas/comunes.js';
import { EvidenciaParams, PresignEvidenciasSchema } from '../schemas/evidencias.js';
import { ContactoSchema, EditarMiTestimonioSchema } from '../schemas/testimonios.js';
import { confirmarEvidencia, eliminarEvidencia, listarEvidencias, presignarEvidencias } from '../services/evidencias.js';
import { actualizarPerfil, conteosParticipante, descifrarDatos, obtenerParticipante, resumenParticipante } from '../services/participantes.js';
import { darDeBajaPropio, editarPropio, listarPropios, obtenerPropio } from '../services/testimonios.js';
import { nuevoRouter, ok, sinCache } from './base.js';

/**
 * Zona de "mi folio": la persona que aporta (anónima o no) se identifica con su folio en la cabecera X-Folio.
 */
export const participante = nuevoRouter();
const TAG = ['Mi folio (persona que aporta)'];
const base = { tags: TAG, security: SEG_FOLIO, middleware: [requiereFolio] };

async function exigirPropio(participanteId: string, testimonioId: string) {
  const [t] = await getDb().select({ id: testimonios.id }).from(testimonios).where(and(eq(testimonios.id, testimonioId), eq(testimonios.participante_id, participanteId))).limit(1);
  if (!t) throw E.noEncontrado('Testimonio');
}

/* ───────────────────────────────────────────────── Perfil ───────────────────────────────────────────────── */

const PerfilSchema = z
  .object({
    nombre: z.string().trim().max(150).nullable(),
    correo: ContactoSchema.shape.correo.nullable(),
    telefono: ContactoSchema.shape.telefono.nullable(),
    perfil_publico: z.boolean().openapi({ description: 'true = aparecer en la lista pública de colaboradores' }),
    nombre_publico: z.string().trim().max(150).nullable().openapi({ description: 'Nombre a mostrar en el perfil público (opcional)' }),
  })
  .partial()
  .openapi('EditarMiPerfil');

participante.openapi(
  createRoute({
    ...base, method: 'get', path: '/api/mi-perfil', summary: 'Mi perfil y cuántos testimonios he subido',
    description: 'Devuelve QUÉ datos dejó la persona (sin revelar su valor) y sus conteos. Para ver sus datos personales descifrados usa `?datos=true`.',
    request: { query: z.object({ datos: z.enum(['true', 'false']).optional() }) },
    responses: { 200: resp('Perfil'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const id = c.get('participante')!.id;
    const p = await obtenerParticipante(id);
    const perfil = resumenParticipante(p, await conteosParticipante(id));
    return c.json(ok(c.req.valid('query').datos === 'true' ? { ...perfil, datos_personales: descifrarDatos(p) } : perfil), 200);
  },
);

participante.openapi(
  createRoute({
    ...base, method: 'patch', path: '/api/mi-perfil', summary: 'Actualizar mis datos opcionales / hacer público mi perfil',
    description: 'Datos opcionales (nombre, correo, teléfono) que se guardan CIFRADOS. `null` borra el dato.',
    request: { body: cuerpo(PerfilSchema) }, responses: { 200: resp('Perfil actualizado'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const id = c.get('participante')!.id;
    const p = await actualizarPerfil(c, id, c.req.valid('json'));
    return c.json(ok(resumenParticipante(p, await conteosParticipante(id))), 200);
  },
);

/* ─────────────────────────────────────────────── Mis testimonios ─────────────────────────────────────────────── */

participante.openapi(
  createRoute({ ...base, method: 'get', path: '/api/mis-testimonios', summary: 'Mis testimonios', responses: { 200: resp('Lista (incluye estado de revisión)'), ...ERRORES } }),
  async (c) => {
    sinCache(c);
    return c.json(ok(await listarPropios(c.get('participante')!.id)), 200);
  },
);

participante.openapi(
  createRoute({ ...base, method: 'get', path: '/api/mis-testimonios/{id}', summary: 'Ver uno de mis testimonios (completo)', request: { params: IdParam }, responses: { 200: resp('Testimonio'), ...ERRORES } }),
  async (c) => {
    sinCache(c);
    return c.json(ok(await obtenerPropio(c.get('participante')!.id, c.req.valid('param').id)), 200);
  },
);

participante.openapi(
  createRoute({
    ...base, method: 'patch', path: '/api/mis-testimonios/{id}', summary: 'Editar uno de mis testimonios',
    description: 'Cualquier campo de la ficha. Tras editar, el testimonio vuelve a revisión (configurable en el dashboard).',
    request: { params: IdParam, body: cuerpo(EditarMiTestimonioSchema) }, responses: { 200: resp('Testimonio actualizado'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    return c.json(ok(await editarPropio(c, c.get('participante')!.id, c.req.valid('param').id, c.req.valid('json'))), 200);
  },
);

participante.openapi(
  createRoute({
    ...base, method: 'delete', path: '/api/mis-testimonios/{id}', summary: 'Dar de baja uno de mis testimonios',
    description: 'Baja lógica (`activo = false`): deja de verse en el mapa pero no se borra de la base de datos.',
    request: { params: IdParam }, responses: { 200: resp('Dado de baja'), ...ERRORES },
  }),
  async (c) => {
    await darDeBajaPropio(c, c.get('participante')!.id, c.req.valid('param').id);
    return c.json(ok({ activo: false }), 200);
  },
);

/* ──────────────────────────────────────────────── Evidencias ──────────────────────────────────────────────── */

participante.openapi(
  createRoute({
    ...base, method: 'get', path: '/api/mis-testimonios/{id}/evidencias', summary: 'Mis evidencias de un testimonio',
    request: { params: IdParam }, responses: { 200: resp('Evidencias'), ...ERRORES },
  }),
  async (c) => {
    const pid = c.get('participante')!.id;
    await exigirPropio(pid, c.req.valid('param').id);
    return c.json(ok(await listarEvidencias(c.req.valid('param').id)), 200);
  },
);

participante.openapi(
  createRoute({
    ...base, method: 'post', path: '/api/mis-testimonios/{id}/evidencias', summary: 'Paso 1 · Reservar y pedir URLs de subida (R2)',
    description:
      'Máximo de archivos por testimonio y tamaño total configurables (por defecto **5 archivos** y **20 MB** en total). Devuelve una URL firmada por archivo: ' +
      'sube cada uno con `PUT` a esa URL usando exactamente las cabeceras indicadas, y luego llama a **confirmar**.',
    request: { params: IdParam, body: cuerpo(PresignEvidenciasSchema) }, responses: { 201: resp('URLs de subida'), ...ERRORES },
  }),
  async (c) => {
    const pid = c.get('participante')!.id;
    const { id } = c.req.valid('param');
    await exigirPropio(pid, id);
    return c.json(ok(await presignarEvidencias(c, id, c.req.valid('json'))), 201);
  },
);

participante.openapi(
  createRoute({
    ...base, method: 'post', path: '/api/mis-testimonios/{id}/evidencias/{evidenciaId}/confirmar', summary: 'Paso 2 · Confirmar un archivo ya subido',
    description: 'El servidor verifica en R2 el tamaño y el tipo reales del archivo; si no coinciden con lo declarado, se descarta.',
    request: { params: EvidenciaParams }, responses: { 200: resp('Evidencia confirmada'), ...ERRORES },
  }),
  async (c) => {
    const pid = c.get('participante')!.id;
    const { id, evidenciaId } = c.req.valid('param');
    await exigirPropio(pid, id);
    const e = await confirmarEvidencia(c, id, evidenciaId);
    return c.json(ok({ id: e.id, folio: e.folio, estado_subida: e.estado_subida, bytes: e.bytes, publica: e.publica }), 200);
  },
);

participante.openapi(
  createRoute({
    ...base, method: 'delete', path: '/api/mis-testimonios/{id}/evidencias/{evidenciaId}', summary: 'Eliminar una de mis evidencias',
    request: { params: EvidenciaParams }, responses: { 200: resp('Evidencia eliminada'), ...ERRORES },
  }),
  async (c) => {
    const pid = c.get('participante')!.id;
    const { id, evidenciaId } = c.req.valid('param');
    await exigirPropio(pid, id);
    await eliminarEvidencia(c, id, evidenciaId);
    return c.json(ok({ eliminada: true }), 200);
  },
);
