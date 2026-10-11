import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { getDb } from '../db/client.js';
import { usuarios, type Rol } from '../db/schema.js';
import { E, esViolacionUnica } from '../lib/errors.js';
import { generarPasswordTemporal, hashPassword } from '../lib/passwords.js';
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

/** Siempre debe quedar al menos un admin activo. */
async function exigirOtroAdmin(idExcluido: string) {
  const [r] = await getDb().select({ n: sql<number>`count(*)::int` }).from(usuarios).where(and(eq(usuarios.rol, 'admin'), eq(usuarios.activo, true), ne(usuarios.id, idExcluido)));
  if (!r || r.n < 1) throw E.conflicto('Debe existir al menos un administrador activo', 'ULTIMO_ADMIN');
}

export async function crearUsuario(c: Ctx, d: { email: string; nombre: string; rol: Rol; password?: string }) {
  if (await buscarUsuarioPorEmail(d.email)) throw E.conflicto('Ya existe un usuario con ese correo', 'EMAIL_DUPLICADO');
  const temporal = d.password ? null : generarPasswordTemporal();
  try {
    const [u] = await getDb()
      .insert(usuarios)
      .values({ email: normalizarEmail(d.email), nombre: d.nombre.trim(), rol: d.rol, password_hash: await hashPassword(d.password ?? temporal!), debe_cambiar_password: true })
      .returning(columnas);
    await registrarBitacora(c, { accion: 'usuario.crear', entidad: 'usuario', entidadId: u!.id, despues: { email: u!.email, rol: u!.rol } });
    return { usuario: u!, password_temporal: temporal };
  } catch (err) {
    if (esViolacionUnica(err)) throw E.conflicto('Ya existe un usuario con ese correo', 'EMAIL_DUPLICADO');
    throw err;
  }
}

export async function actualizarUsuario(c: Ctx, actor: UsuarioAuth, id: string, cambios: { nombre?: string; rol?: Rol; activo?: boolean; email?: string }) {
  const [actual] = await getDb().select(columnas).from(usuarios).where(eq(usuarios.id, id)).limit(1);
  if (!actual) throw E.noEncontrado('Usuario');
  const pierdeAdmin = actual.rol === 'admin' && ((cambios.rol && cambios.rol !== 'admin') || cambios.activo === false);
  if (pierdeAdmin) await exigirOtroAdmin(id);
  if (id === actor.id && (cambios.activo === false || (cambios.rol && cambios.rol !== actor.rol))) {
    throw E.conflicto('No puedes desactivarte ni cambiar tu propio rol', 'AUTO_MODIFICACION');
  }
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
    await registrarBitacora(c, { accion: 'usuario.actualizar', entidad: 'usuario', entidadId: id, antes: { rol: actual.rol, activo: actual.activo }, despues: cambios });
    return u!;
  } catch (err) {
    if (esViolacionUnica(err)) throw E.conflicto('Ya existe un usuario con ese correo', 'EMAIL_DUPLICADO');
    throw err;
  }
}

export async function restablecerPassword(c: Ctx, id: string) {
  const temporal = generarPasswordTemporal();
  const [u] = await getDb()
    .update(usuarios)
    .set({ password_hash: await hashPassword(temporal), debe_cambiar_password: true, intentos_fallidos: 0, bloqueado_hasta: null, password_cambiada_at: new Date() })
    .where(eq(usuarios.id, id))
    .returning({ id: usuarios.id });
  if (!u) throw E.noEncontrado('Usuario');
  await revocarSesionesDeUsuario(id);
  await registrarBitacora(c, { accion: 'usuario.restablecer_password', entidad: 'usuario', entidadId: id });
  return { password_temporal: temporal };
}
