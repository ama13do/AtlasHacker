import { createRoute, z } from '@hono/zod-openapi';
import { ROLES } from '../../db/schema.js';
import { requiereUsuario } from '../../middleware/seguridad.js';
import { ERRORES, IdParam, SEG_USUARIO, cuerpo, resp } from '../../schemas/comunes.js';
import { PasswordSchema, revocarSesionesDeUsuario } from '../../services/auth.js';
import { registrarBitacora } from '../../services/bitacora.js';
import { actualizarUsuario, crearUsuario, listarUsuarios, restablecerPassword } from '../../services/usuarios.js';
import { nuevoRouter, ok, sinCache } from '../base.js';

export const adminUsuarios = nuevoRouter();
const TAG = ['Dashboard · Usuarios y roles'];
const ADMIN = { tags: TAG, security: SEG_USUARIO, middleware: [requiereUsuario('admin')] };

const CrearUsuarioSchema = z
  .object({
    email: z.email().max(200),
    nombre: z.string().trim().min(2).max(120),
    rol: z.enum(ROLES).openapi({ description: 'admin: todo · moderador: aprobar/desaprobar y editar · facilitador: subir testimonios · lector: solo lectura' }),
    password: PasswordSchema.optional().openapi({ description: 'Opcional. Si se omite se genera una temporal que se muestra una sola vez.' }),
  })
  .openapi('CrearUsuario');

adminUsuarios.openapi(
  createRoute({ ...ADMIN, method: 'get', path: '/api/admin/usuarios', summary: 'Usuarios del dashboard', responses: { 200: resp('Usuarios'), ...ERRORES } }),
  async (c) => c.json(ok(await listarUsuarios()), 200),
);

adminUsuarios.openapi(
  createRoute({
    ...ADMIN, method: 'post', path: '/api/admin/usuarios', summary: 'Crear usuario',
    description: 'El usuario deberá cambiar su contraseña al primer inicio de sesión.', request: { body: cuerpo(CrearUsuarioSchema) }, responses: { 201: resp('Usuario creado'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    return c.json(ok(await crearUsuario(c, c.req.valid('json'))), 201);
  },
);

adminUsuarios.openapi(
  createRoute({
    ...ADMIN, method: 'patch', path: '/api/admin/usuarios/{id}', summary: 'Editar rol, nombre, correo o activar/desactivar',
    description: 'Un cambio de rol o una baja cierran sus sesiones de inmediato. Siempre debe quedar un admin activo; no puedes desactivarte ni cambiar tu propio rol.',
    request: { params: IdParam, body: cuerpo(z.object({ email: z.email().max(200), nombre: z.string().trim().min(2).max(120), rol: z.enum(ROLES), activo: z.boolean() }).partial()) },
    responses: { 200: resp('Usuario actualizado'), ...ERRORES },
  }),
  async (c) => c.json(ok(await actualizarUsuario(c, c.get('usuario')!, c.req.valid('param').id, c.req.valid('json'))), 200),
);

adminUsuarios.openapi(
  createRoute({
    ...ADMIN, method: 'post', path: '/api/admin/usuarios/{id}/restablecer-password', summary: 'Restablecer contraseña (genera una temporal)',
    request: { params: IdParam }, responses: { 200: resp('Contraseña temporal (se muestra una sola vez)'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    return c.json(ok(await restablecerPassword(c, c.req.valid('param').id)), 200);
  },
);

adminUsuarios.openapi(
  createRoute({
    ...ADMIN, method: 'post', path: '/api/admin/usuarios/{id}/cerrar-sesiones', summary: 'Cerrar todas las sesiones de un usuario',
    request: { params: IdParam }, responses: { 200: resp('Sesiones cerradas'), ...ERRORES },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    await revocarSesionesDeUsuario(id);
    await registrarBitacora(c, { accion: 'usuario.cerrar_sesiones', entidad: 'usuario', entidadId: id });
    return c.json(ok({ cerradas: true }), 200);
  },
);
