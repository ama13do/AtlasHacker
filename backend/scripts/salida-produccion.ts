/**
 * Salida a producción (una sola vez): deja a una persona como superadmin, borra las cuentas de prueba y reinicia la bitácora.
 *
 *   npm run produccion:preparar                                   → solo muestra lo que haría
 *   npm run produccion:preparar -- --confirmar SALIR-A-PRODUCCION → lo hace
 *
 * La bitácora es de solo agregar (un trigger impide UPDATE/DELETE); para reiniciarla se usa TRUNCATE, que solo
 * puede hacer el dueño de la tabla. Queda un primer evento del sistema que deja constancia del reinicio.
 */
import { sql } from 'drizzle-orm';
import { initEnv } from '../src/config/env.js';
import { cerrarDb, getDb } from '../src/db/client.js';

const SUPERADMIN = 'amadosanti546@gmail.com';
const CUENTAS_DE_PRUEBA = ['admin@hxnf.org', 'carga-datos-prueba@atlashacker.local'];

const confirmado = process.argv[process.argv.indexOf('--confirmar') + 1] === 'SALIR-A-PRODUCCION';

await initEnv();
const db = getDb();
try {
  const lista = sql.join(CUENTAS_DE_PRUEBA.map((e) => sql`${e}`), sql`, `);
  const [sup] = [...(await db.execute<{ email: string; rol: string }>(sql`select email, rol from usuarios where lower(email) = ${SUPERADMIN}`))];
  const prueba = [...(await db.execute<{ email: string }>(sql`select email from usuarios where lower(email) in (${lista})`))];
  const [bit] = [...(await db.execute<{ n: number }>(sql`select count(*)::int as n from bitacora`))];
  if (!sup) throw new Error(`No existe la cuenta ${SUPERADMIN}`);
  console.log(`Superadmin: ${sup.email} (hoy: ${sup.rol})`);
  console.log(`Cuentas de prueba a borrar: ${prueba.map((p) => p.email).join(', ') || '(ninguna)'}`);
  console.log(`Eventos en la bitácora: ${bit?.n ?? 0}`);

  if (!confirmado) {
    console.log('\nNo se cambió nada. Para hacerlo: --confirmar SALIR-A-PRODUCCION');
  } else {
    await db.transaction(async (tx) => {
      await tx.execute(sql`update usuarios set rol = 'superadmin' where lower(email) = ${SUPERADMIN}`);
      await tx.execute(sql`delete from usuarios where lower(email) in (${lista})`);
      await tx.execute(sql`truncate table bitacora`);
      await tx.execute(sql`
        insert into bitacora (actor_tipo, accion, entidad, detalle)
        values ('sistema', 'mantenimiento.reiniciar_bitacora', 'sistema',
                ${JSON.stringify({ motivo: 'Salida a producción', superadmin: SUPERADMIN, cuentas_borradas: prueba.map((p) => p.email) })}::jsonb)`);
    });
    console.log('\nListo. Cuentas que quedan:');
    console.table([...(await db.execute(sql`select email, nombre, rol, activo from usuarios order by created_at`))]);
  }
} catch (err) {
  console.error('Error:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
