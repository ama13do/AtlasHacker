import { desc, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { getDb } from '../db/client.js';
import { usuarios, type Rol } from '../db/schema.js';
import { E, esViolacionUnica } from '../lib/errors.js';
import { generarPasswordTemporal, hashPassword } from '../lib/passwords.js';
import { esSuperadmin } from '../middleware/seguridad.js';
import type { AppEnv, UsuarioAuth } from '../types.js';
import { buscarUsuarioPorEmail, normalizarEmail, revocarSesionesDeUsuario } from './auth.js';
import { registrarBitacora } from './bitacora.js';

type Ctx = Context<AppEnv>;

const columnas = {
  id: usuarios.id, email: usuarios.email, nombre: usuarios.nombre, rol: usuarios.rol, activo: usuarios.activo,
  debe_cambiar_password: usuarios.debe_cambiar_password, ultimo_login_at: usuarios.ultimo_login_at,
  bloqueado_hasta: usuarios.bloqueado_hasta, created_at: usuarios.created_at, updated_at: usuarios.updated_at,
};

export const listarUsuarios = () => getDb().select(columnas).from(usuarios).orderBy(desc(usuarios.created_at));

/** El rol superadmin no se asigna desde el panel (es uno solo, alta por script); el de admin solo lo da el superadmin. */
function exigirPuedeAsignar(actor: UsuarioAuth, rol: Rol) {
  if (rol === 'superadmin') throw E.prohibido('El rol de superadmin no se asigna desde el panel');
  if (rol === 'admin' && !esSuperadmin(actor)) throw E.prohibido('Solo el superadmin puede dar el rol de administración');
}

/** Admin gestiona moderación, facilitación y lectura; las cuentas de administración, solo el superadmin; al superadmin, nadie más. */
function exigirGestionable(actor: UsuarioAuth, objetivo: { id: string; rol: Rol }) {
  if (objetivo.rol === 'superadmin' && objetivo.id !== actor.id) throw E.prohibido('Nadie más puede modificar la cuenta del superadmin');
  if (objetivo.rol === 'admin' && !esSuperadmin(actor)) throw E.prohibido('Solo el superadmin puede modificar cuentas de administración');
}

async function obtener(id: string) {
  const [u] = await getDb().select(columnas).from(usuarios).where(eq(usuarios.id, id)).limit(1);
  if (!u) throw E.noEncontrado('Usuario');
  return u;
}

export async function crearUsuario(c: Ctx, actor: UsuarioAuth, d: { email: string; nombre: string; rol: Rol; password?: string }) {
  exigirPuedeAsignar(actor, d.rol);
  if (await buscarUsuarioPorEmail(d.email)) throw E.conflicto('Ya existe un usuario con ese correo', 'EMAIL_DUPLICADO');
  const temporal = d.password ? null : generarPasswordTemporal();
  try {
    const [u] = await getDb()
      .insert(usuarios)
      .values({ email: normalizarEmail(d.email), nombre: d.nombre.trim(), rol: d.rol, password_hash: await hashPassword(d.password ?? temporal!), debe_cambiar_password: true })
      .returning(columnas);
    await registrarBitacora(c, { accion: 'usuario.crear', entidad: 'usuario', entidadId: u!.id, despues: { email: u!.email, nombre: u!.nombre, rol: u!.rol } });
    return { usuario: u!, password_temporal: temporal };
  } catch (err) {
    if (esViolacionUnica(err)) throw E.conflicto('Ya existe un usuario con ese correo', 'EMAIL_DUPLICADO');
    throw err;
  }
}

export async function actualizarUsuario(c: Ctx, actor: UsuarioAuth, id: string, cambios: { nombre?: string; rol?: Rol; activo?: boolean; email?: string }) {
  const actual = await obtener(id);
  if (id === actor.id && (cambios.activo === false || (cambios.rol && cambios.rol !== actor.rol))) {
    throw E.conflicto('No puedes desactivarte ni cambiar tu propio rol', 'AUTO_MODIFICACION');
  }
  exigirGestionable(actor, actual);
  if (cambios.rol !== undefined && cambios.rol !== actual.rol) exigirPuedeAsignar(actor, cambios.rol);
  const set: Partial<typeof usuarios.$inferInsert> = {};
  if (cambios.nombre !== undefined) set.nombre = cambios.nombre.trim();
  if (cambios.rol !== undefined) set.rol = cambios.rol;
  if (cambios.activo !== undefined) set.activo = cambios.activo;
  if (cambios.email !== undefined) set.email = normalizarEmail(cambios.email);
  if (Object.keys(set).length === 0) throw E.invalido('No hay cambios que aplicar');
  try {
    const [u] = await getDb().update(usuarios).set(set).where(eq(usuarios.id, id)).returning(columnas);
    // Un cambio de rol o una baja deben surtir efecto de inmediato: se cierran sus sesiones
    if (cambios.rol !== undefined || cambios.activo === false) await revocarSesionesDeUsuario(id);
    const antes = Object.fromEntries(Object.keys(set).map((k) => [k, actual[k as keyof typeof actual]]));
    await registrarBitacora(c, { accion: 'usuario.actualizar', entidad: 'usuario', entidadId: id, antes, despues: set, detalle: { email: actual.email } });
    return u!;
  } catch (err) {
    if (esViolacionUnica(err)) throw E.conflicto('Ya existe un usuario con ese correo', 'EMAIL_DUPLICADO');
    throw err;
  }
}

export async function restablecerPassword(c: Ctx, actor: UsuarioAuth, id: string) {
  const objetivo = await obtener(id);
  exigirGestionable(actor, objetivo);
  const temporal = generarPasswordTemporal();
  await getDb()
    .update(usuarios)
    .set({ password_hash: await hashPassword(temporal), debe_cambiar_password: true, intentos_fallidos: 0, bloqueado_hasta: null, password_cambiada_at: new Date() })
    .where(eq(usuarios.id, id));
  await revocarSesionesDeUsuario(id);
  await registrarBitacora(c, { accion: 'usuario.restablecer_password', entidad: 'usuario', entidadId: id, detalle: { email: objetivo.email } });
  return { password_temporal: temporal };
}

export async function cerrarSesionesUsuario(c: Ctx, actor: UsuarioAuth, id: string) {
  const objetivo = await obtener(id);
  exigirGestionable(actor, objetivo);
  await revocarSesionesDeUsuario(id);
  await registrarBitacora(c, { accion: 'usuario.cerrar_sesiones', entidad: 'usuario', entidadId: id, detalle: { email: objetivo.email } });
}

/** Borrado definitivo de una cuenta (solo superadmin). La bitácora conserva su correo, nombre y rol de cada acción. */
export async function eliminarUsuario(c: Ctx, actor: UsuarioAuth, id: string) {
  const objetivo = await obtener(id);
  if (id === actor.id || objetivo.rol === 'superadmin') throw E.conflicto('No puedes eliminar la cuenta del superadmin', 'AUTO_MODIFICACION');
  await getDb().delete(usuarios).where(eq(usuarios.id, id)); // cascada: sesiones; en lo demás queda en null
  await registrarBitacora(c, { accion: 'usuario.eliminar', entidad: 'usuario', entidadId: id, antes: { email: objetivo.email, nombre: objetivo.nombre, rol: objetivo.rol } });
}
