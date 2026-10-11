import { createRoute, z } from '@hono/zod-openapi';
import { getDb } from '../../db/client.js';
import { PaginacionOffset } from '../../lib/paginacion.js';
import { requiereUsuario } from '../../middleware/seguridad.js';
import { ERRORES, IdParam, SEG_USUARIO, cuerpo, resp } from '../../schemas/comunes.js';
import { ContactoSchema, FiltrosStaffQuery } from '../../schemas/testimonios.js';
import { registrarBitacora } from '../../services/bitacora.js';
import { actualizarPerfil, buscarParticipantes, cancelarDatosPersonales, conteosParticipante, crearParticipante, descifrarDatos, obtenerParticipante, registrarAccesoPII, resumenParticipante, rotarFolio } from '../../services/participantes.js';
import { obtenerConfiguracion } from '../../services/configuracion.js';
import { listarStaff } from '../../services/testimonios.js';
import { nuevoRouter, ok, sinCache } from '../base.js';

export const adminParticipantes = nuevoRouter();
const TAG = ['Dashboard · Personas (folios)'];
const GESTION = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador')] };
const SOLO_ADMIN = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin')] };
const CAPTURA = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador', 'facilitador')] };

adminParticipantes.openapi(
  createRoute({
    ...GESTION, method: 'get', path: '/api/admin/participantes', summary: 'Buscar/listar personas (folios)',
    description:
      'Cuántos testimonios aporta cada persona. Para **recuperar un folio perdido**: busca por `correo`, `telefono` o los últimos 4 caracteres del folio (`folio_pista`) y usa `rotar-folio`. ' +
      'Las búsquedas por correo y teléfono usan un índice ciego (HMAC): los datos nunca se descifran para buscar. No devuelve datos personales.',
    request: { query: z.object({ correo: z.email().optional(), telefono: ContactoSchema.shape.telefono, folio_pista: z.string().length(4).optional() }).extend(PaginacionOffset.shape) },
    responses: { 200: resp('Personas'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const q = c.req.valid('query');
    const r = await buscarParticipantes(q);
    return c.json({ success: true as const, data: r.filas, total: r.total, pagina: q.pagina, por_pagina: q.por_pagina }, 200);
  },
);

adminParticipantes.openapi(
  createRoute({
    ...CAPTURA, method: 'post', path: '/api/admin/participantes', summary: 'Crear persona y emitir su folio',
    description: 'Para dar el folio a alguien antes de capturar su ficha. El folio se devuelve UNA sola vez.',
    request: { body: cuerpo(z.object({ nombre: z.string().trim().max(150).optional(), contacto: ContactoSchema.optional() })) },
    responses: { 201: resp('Persona creada con su folio'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const { nombre, contacto } = c.req.valid('json');
    const cfg = await obtenerConfiguracion();
    const r = await crearParticipante(getDb(), { nombre, correo: contacto?.correo, telefono: contacto?.telefono }, { creadoPorUsuarioId: c.get('usuario')!.id, avisoVersion: cfg.consentimiento_version_actual });
    await registrarBitacora(c, { accion: 'participante.crear', entidad: 'participante', entidadId: r.id });
    return c.json(ok({ id: r.id, folio: r.folio }), 201);
  },
);

adminParticipantes.openapi(
  createRoute({
    ...GESTION, method: 'get', path: '/api/admin/participantes/{id}', summary: 'Ver una persona (incluye sus datos personales descifrados)',
    description: 'Cada consulta de datos personales queda registrada en la bitácora (quién y cuándo, sin copiar los datos).',
    request: { params: IdParam }, responses: { 200: resp('Persona'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    const { id } = c.req.valid('param');
    const p = await obtenerParticipante(id);
    await registrarAccesoPII(c, id);
    return c.json(ok({ ...resumenParticipante(p, await conteosParticipante(id)), datos_personales: descifrarDatos(p) }), 200);
  },
);

adminParticipantes.openapi(
  createRoute({
    ...GESTION, method: 'get', path: '/api/admin/participantes/{id}/testimonios', summary: 'Testimonios de una persona',
    request: { params: IdParam, query: FiltrosStaffQuery.omit({ participante_id: true }).extend(PaginacionOffset.shape) },
    responses: { 200: resp('Testimonios'), ...ERRORES },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const { pagina, por_pagina, ...filtros } = c.req.valid('query');
    const r = await listarStaff({ ...filtros, participante_id: id }, pagina, por_pagina);
    return c.json({ success: true as const, data: r.filas, total: r.total, pagina, por_pagina }, 200);
  },
);

const EditarPersonaSchema = z
  .object({
    nombre: z.string().trim().max(150).nullable(),
    correo: ContactoSchema.shape.correo.nullable(),
    telefono: ContactoSchema.shape.telefono.nullable(),
    perfil_publico: z.boolean(),
    nombre_publico: z.string().trim().max(150).nullable(),
    activo: z.boolean().openapi({ description: 'false = el folio deja de funcionar (no puede subir ni editar); sus testimonios se conservan' }),
  })
  .partial()
  .openapi('EditarPersona');

adminParticipantes.openapi(
  createRoute({
    ...GESTION, method: 'patch', path: '/api/admin/participantes/{id}', summary: 'Rectificar datos de una persona (derecho de rectificación)',
    request: { params: IdParam, body: cuerpo(EditarPersonaSchema) }, responses: { 200: resp('Persona actualizada'), ...ERRORES },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const p = await actualizarPerfil(c, id, c.req.valid('json'));
    return c.json(ok(resumenParticipante(p, await conteosParticipante(id))), 200);
  },
);

adminParticipantes.openapi(
  createRoute({
    ...GESTION, method: 'post', path: '/api/admin/participantes/{id}/rotar-folio', summary: 'Recuperar acceso: emitir un folio NUEVO',
    description: 'Cuando la persona escribió al equipo porque perdió su folio. El folio anterior deja de funcionar y el nuevo se muestra una sola vez para entregárselo por un canal seguro.',
    request: { params: IdParam }, responses: { 200: resp('Folio nuevo'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    return c.json(ok(await rotarFolio(c, c.req.valid('param').id)), 200);
  },
);

adminParticipantes.openapi(
  createRoute({
    ...SOLO_ADMIN, method: 'delete', path: '/api/admin/participantes/{id}/datos-personales', summary: 'Cancelar datos personales (derecho de cancelación)',
    description: 'Borra nombre, correo, teléfono y sus índices. Con `anonimizar_testimonios=true` también oculta el nombre público de sus testimonios y generaliza su ubicación. Los testimonios NO se eliminan.',
    request: { params: IdParam, query: z.object({ anonimizar_testimonios: z.enum(['true', 'false']).default('true').transform((v) => v === 'true') }) },
    responses: { 200: resp('Datos cancelados'), ...ERRORES },
  }),
  async (c) => {
    await cancelarDatosPersonales(c, c.req.valid('param').id, c.req.valid('query').anonimizar_testimonios);
    return c.json(ok({ cancelados: true }), 200);
  },
);
