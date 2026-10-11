/**
 * Crea el primer usuario administrador del dashboard.
 *   npm run admin:crear -- --email admin@dominio.org --nombre "Nombre Apellido" [--password "..."]
 * Sin --password se genera una temporal y se muestra UNA vez (el usuario deberá cambiarla al entrar).
 */
import { initEnv } from '../src/config/env.js';
import { cerrarDb, getDb } from '../src/db/client.js';
import { usuarios } from '../src/db/schema.js';
import { generarPasswordTemporal, hashPassword } from '../src/lib/passwords.js';
import { PasswordSchema, buscarUsuarioPorEmail, normalizarEmail } from '../src/services/auth.js';

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

await initEnv();
const email = argumento('email');
const nombre = argumento('nombre') ?? 'Administrador';
if (!email || !email.includes('@')) {
  console.error('Uso: npm run admin:crear -- --email correo@dominio.org --nombre "Nombre" [--password "..."]');
  process.exit(1);
}

try {
  if (await buscarUsuarioPorEmail(email)) {
    console.error(`Ya existe un usuario con el correo ${email}`);
    process.exitCode = 1;
  } else {
    const dada = argumento('password');
    if (dada) {
      const r = PasswordSchema.safeParse(dada);
      if (!r.success) throw new Error(r.error.issues.map((i) => i.message).join('; '));
    }
    const password = dada ?? generarPasswordTemporal();
    await getDb().insert(usuarios).values({
      email: normalizarEmail(email),
      nombre,
      rol: 'admin',
      password_hash: await hashPassword(password),
      debe_cambiar_password: !dada,
    });
    console.log(`Administrador creado: ${normalizarEmail(email)}`);
    if (!dada) console.log(`Contraseña temporal (guárdala ahora, no se vuelve a mostrar): ${password}`);
  }
} catch (err) {
  console.error('No se pudo crear el administrador:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
