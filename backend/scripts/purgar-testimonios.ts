/**
 * Limpia los datos de prueba: borra TODOS los testimonios (con sus evidencias, comentarios, reacciones y
 * auditoría), las personas participantes y TODOS los objetos del bucket de R2.
 * NO toca usuarios del dashboard, categorías, expedientes, configuración ni bitácora.
 *
 *   npm run datos:purgar                                         → solo cuenta (no borra nada)
 *   npm run datos:purgar -- --confirmar BORRAR-TODO --respaldo ruta/respaldo.json
 *
 * Antes de borrar guarda un respaldo JSON (filas de testimonios, comentarios y evidencias; los datos personales
 * de participantes van cifrados) y deja el evento en la bitácora. Usa SQL directo para no depender de columnas
 * que la base aún no tenga.
 */
import fs from 'node:fs';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { sql } from 'drizzle-orm';
import { env, initEnv } from '../src/config/env.js';
import { cerrarDb, getDb } from '../src/db/client.js';

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

await initEnv();
const db = getDb();
const e = env();

const r2 =
  e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET_NAME
    ? {
        bucket: e.R2_BUCKET_NAME,
        client: new S3Client({
          region: 'auto',
          endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
        }),
      }
    : null;

async function listarObjetos(): Promise<string[]> {
  if (!r2) return [];
  const claves: string[] = [];
  let token: string | undefined;
  do {
    const r = await r2.client.send(new ListObjectsV2Command({ Bucket: r2.bucket, ContinuationToken: token }));
    for (const o of r.Contents ?? []) if (o.Key) claves.push(o.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return claves;
}

const contar = async (tabla: string) => (await db.execute<{ n: number }>(sql.raw(`select count(*)::int as n from ${tabla}`)))[0]!.n;

try {
  const conteo = {
    testimonios: await contar('testimonios'),
    comentarios: await contar('comentarios'),
    reacciones: await contar('reacciones'),
    evidencias: await contar('evidencias'),
    participantes: await contar('participantes'),
  };
  const objetos = await listarObjetos();
  console.log('Base:', conteo);
  console.log(`R2: ${objetos.length} objeto(s) en ${r2?.bucket ?? '(sin R2 configurado)'}`);

  if (argumento('confirmar') !== 'BORRAR-TODO') {
    console.log('\nNo se borró nada. Para borrar: --confirmar BORRAR-TODO --respaldo ruta.json');
    process.exit(0);
  }

  const respaldo = argumento('respaldo');
  if (!respaldo) {
    console.error('Falta --respaldo ruta.json (se guarda antes de borrar).');
    process.exit(1);
  }
  const filas = async (q: string) => [...(await db.execute(sql.raw(q)))];
  fs.writeFileSync(
    respaldo,
    JSON.stringify(
      {
        fecha: new Date().toISOString(),
        conteo,
        objetos_r2: objetos,
        testimonios: await filas('select to_jsonb(t) - \'busqueda\' as fila from testimonios t'),
        comentarios: await filas('select to_jsonb(c) as fila from comentarios c'),
        evidencias: await filas('select to_jsonb(v) as fila from evidencias v'),
      },
      null,
      2,
    ),
  );
  console.log(`Respaldo guardado en ${respaldo}`);

  // 1) Archivos de R2 (de mil en mil, el máximo por petición)
  if (r2) {
    for (let i = 0; i < objetos.length; i += 1000) {
      const lote = objetos.slice(i, i + 1000).map((Key) => ({ Key }));
      await r2.client.send(new DeleteObjectsCommand({ Bucket: r2.bucket, Delete: { Objects: lote, Quiet: true } }));
    }
    console.log(`R2: ${objetos.length} objeto(s) borrados`);
  }

  // 2) Base: los testimonios arrastran (cascade) auditoría, evidencias, comentarios con sus likes y reacciones
  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from testimonios`);
    await tx.execute(sql`delete from participantes`);
    await tx.execute(sql`
      insert into bitacora (actor_tipo, accion, entidad, detalle)
      values ('sistema', 'mantenimiento.purgar_testimonios', 'sistema', ${JSON.stringify({ ...conteo, objetos_r2: objetos.length })}::jsonb)`);
  });
  console.log('Base: testimonios, comentarios, reacciones, evidencias y participantes borrados');
} catch (err) {
  console.error('Error:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
