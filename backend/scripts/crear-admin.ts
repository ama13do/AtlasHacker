/**
 * Crea el primer usuario del dashboard (por defecto el superadmin: el único que borra, exporta y ve la bitácora).
 *   npm run admin:crear -- --email admin@dominio.org --nombre "Nombre Apellido" [--rol superadmin|admin] [--password "..."]
 * Sin --password se genera una temporal y se muestra UNA vez (el usuario deberá cambiarla al entrar).
 * Con --forzar sobre una cuenta existente: nueva contraseña (y el rol, solo si se pasa --rol).
 */
import { eq } from 'drizzle-orm';
import { initEnv } from '../src/config/env.js';
import { cerrarDb, getDb } from '../src/db/client.js';
import { usuarios } from '../src/db/schema.js';
import { generarPasswordTemporal, hashPassword } from '../src/lib/passwords.js';
import { PasswordSchema, buscarUsuarioPorEmail, normalizarEmail } from '../src/services/auth.js';

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function tieneBandera(nombre: string): boolean {
  return process.argv.includes(`--${nombre}`);
}

await initEnv();
const email = argumento('email');
const nombre = argumento('nombre') ?? 'Administrador';
const forzar = tieneBandera('forzar');
const rolDado = argumento('rol');
if (rolDado && rolDado !== 'superadmin' && rolDado !== 'admin') {
  console.error('--rol debe ser superadmin o admin');
  process.exit(1);
}
const rol = (rolDado ?? 'superadmin') as 'superadmin' | 'admin';

if (!email || !email.includes('@')) {
  console.error('Uso: npm run admin:crear -- --email correo@dominio.org --nombre "Nombre" [--password "..."] [--forzar]');
  process.exit(1);
}

try {
  const existente = await buscarUsuarioPorEmail(email);
  if (existente) {
    if (!forzar) {
      console.error(`Ya existe un usuario con el correo ${email}. Usa --forzar para actualizar su contraseña y rol.`);
      process.exitCode = 1;
    } else {
      const dada = argumento('password');
      const password = dada ?? generarPasswordTemporal();
      await getDb()
        .update(usuarios)
        .set({
          nombre: argumento('nombre') ?? existente.nombre,
          rol: rolDado ? rol : existente.rol,
          password_hash: await hashPassword(password),
          activo: true,
          intentos_fallidos: 0,
          bloqueado_hasta: null,
          debe_cambiar_password: false,
          tokens_validos_desde: new Date(),
        })
        .where(eq(usuarios.id, existente.id));
      console.log(`Cuenta actualizada con éxito: ${normalizarEmail(email)} (${rolDado ? rol : existente.rol})`);
      if (!dada) console.log(`Nueva contraseña temporal: ${password}`);
    }
  } else {
    const dada = argumento('password');
    if (dada && !forzar) {
      const r = PasswordSchema.safeParse(dada);
      if (!r.success) throw new Error(r.error.issues.map((i) => i.message).join('; '));
    }
    const password = dada ?? generarPasswordTemporal();
    await getDb().insert(usuarios).values({
      email: normalizarEmail(email),
      nombre,
      rol,
      password_hash: await hashPassword(password),
      debe_cambiar_password: false,
    });
    console.log(`Cuenta creada: ${normalizarEmail(email)} (${rol})`);
    if (!dada) console.log(`Contraseña temporal (guárdala ahora, no se vuelve a mostrar): ${password}`);
  }
} catch (err) {
  console.error('No se pudo crear o actualizar el administrador:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
