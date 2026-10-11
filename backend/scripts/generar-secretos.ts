/**
 * Genera los secretos propios de la API y los AGREGA a backend/.env solo si faltan (nunca sobrescribe).
 *   npm run secretos:generar              → agrega los que falten al .env
 *   npm run secretos:generar -- --imprimir → solo los muestra (p. ej. para otro ambiente)
 *
 * IMPORTANTE: respalda ENCRYPTION_KEY y HASH_PEPPER en un gestor de contraseñas. Si se pierden, los datos
 * personales cifrados NO se pueden recuperar; si cambian, dejan de funcionar los folios existentes.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';

const generados: Record<string, string> = {
  JWT_SECRET: randomBytes(48).toString('base64url'),
  ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  HASH_PEPPER: randomBytes(48).toString('base64url'),
};

if (process.argv.includes('--imprimir')) {
  for (const [k, v] of Object.entries(generados)) console.log(`${k}=${v}`);
} else {
  const ruta = new URL('../.env', import.meta.url);
  const actual = existsSync(ruta) ? readFileSync(ruta, 'utf8') : '';
  const faltan = Object.entries(generados).filter(([k]) => !new RegExp(`^${k}=.+`, 'm').test(actual));
  if (faltan.length === 0) {
    console.log('El .env ya tiene JWT_SECRET, ENCRYPTION_KEY y HASH_PEPPER. No se cambió nada.');
  } else {
    const bloque = ['', '# ------------------------------------------', '# SECRETOS PROPIOS (generados con npm run secretos:generar)', '# Respalda ENCRYPTION_KEY y HASH_PEPPER: si se pierden, los datos cifrados no se recuperan.', '# ------------------------------------------', ...faltan.map(([k, v]) => `${k}=${v}`), ''].join('\n');
    appendFileSync(ruta, (actual.endsWith('\n') || actual === '' ? '' : '\n') + bloque);
    console.log(`Agregados al .env: ${faltan.map(([k]) => k).join(', ')}`);
  }
}
