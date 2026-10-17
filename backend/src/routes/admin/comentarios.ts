import { createRoute, z } from '@hono/zod-openapi';
import { ESTADOS_MODERACION } from '../../db/schema.js';
import { PaginacionOffset } from '../../lib/paginacion.js';
import { E } from '../../lib/errors.js';
import { esAdmin, requiereUsuario } from '../../middleware/seguridad.js';
import { ERRORES, IdParam, SEG_USUARIO, Uuid, cuerpo, resp } from '../../schemas/comunes.js';
import { editarComentarioStaff, eliminarComentarioStaff, listarComentariosStaff } from '../../services/social.js';
import { nuevoRouter, ok } from '../base.js';

export const adminComentarios = nuevoRouter();
const TAG = ['Dashboard · Comentarios'];
const LEER = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador', 'lector')] };
const MODERAR = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador')] };
const SUPERADMIN = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('superadmin')] };

adminComentarios.openapi(
  createRoute({
    ...LEER, method: 'get', path: '/api/admin/comentarios', summary: 'Listar comentarios (moderación)',
    description: 'Fuera de administración no aparecen los comentarios de testimonios con información sensible.',
    request: {
      query: z
        .object({
          estado: z.enum(ESTADOS_MODERACION).optional(),
          activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
          testimonio_id: Uuid.optional(),
        })
        .extend(PaginacionOffset.shape),
    },
    responses: { 200: resp('Comentarios'), ...ERRORES },
  }),
  async (c) => {
    const q = c.req.valid('query');
    const r = await listarComentariosStaff(q, !esAdmin(c.get('usuario')!));
    return c.json({ success: true as const, data: r.filas, total: r.total, pagina: q.pagina, por_pagina: q.por_pagina }, 200);
  },
);

adminComentarios.openapi(
  createRoute({
    ...MODERAR, method: 'patch', path: '/api/admin/comentarios/{id}', summary: 'Aprobar, rechazar, ocultar (activo=false) o editar un comentario',
    description: 'La moderación solo puede aprobar o rechazar (`estado`); ocultar y editar el texto es de administración.',
    request: { params: IdParam, body: cuerpo(z.object({ estado: z.enum(ESTADOS_MODERACION), activo: z.boolean(), contenido: z.string().trim().min(1).max(2000) }).partial()) },
    responses: { 200: resp('Comentario actualizado'), ...ERRORES },
  }),
  async (c) => {
    const cambios = c.req.valid('json');
    const admin = esAdmin(c.get('usuario')!);
    if (!admin && Object.keys(cambios).some((k) => k !== 'estado')) throw E.prohibido('Tu rol solo puede aprobar o rechazar comentarios');
    await editarComentarioStaff(c, c.req.valid('param').id, cambios, !admin);
    return c.json(ok({ actualizado: true }), 200);
  },
);

adminComentarios.openapi(
  createRoute({
    ...SUPERADMIN, method: 'delete', path: '/api/admin/comentarios/{id}', summary: 'Eliminar un comentario de la base de datos (permanente)',
    description: 'Solo superadmin. Para solo ocultarlo, usa PATCH con `activo: false`.', request: { params: IdParam }, responses: { 200: resp('Eliminado'), ...ERRORES },
  }),
  async (c) => {
    await eliminarComentarioStaff(c, c.req.valid('param').id);
    return c.json(ok({ eliminado: true }), 200);
  },
);
