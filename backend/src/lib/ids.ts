import { randomInt } from 'node:crypto';

// Alfabeto Crockford (sin I, L, O, U): legible al transcribir desde papel. Todo es aleatorio, nada secuencial.
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function codigoAleatorio(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

/** FUTURO/001-T7K3MQ9X */
export const folioTestimonio = (codigoExpediente: string) => `${codigoExpediente}-T${codigoAleatorio(8)}`;
/** FUTURO/001-E4XA9ZP2 */
export const folioEvidencia = (codigoExpediente: string) => `${codigoExpediente}-E${codigoAleatorio(8)}`;

/** Folio/token de la persona: P-XXXX-XXXX-XXXX-XXXX (80 bits). Es una credencial: solo se guarda su hash. */
export function nuevoFolioParticipante(): string {
  return `P-${[0, 1, 2, 3].map(() => codigoAleatorio(4)).join('-')}`;
}

/** Acepta mayúsculas/minúsculas, sin guiones, y corrige confusiones típicas (O→0, I/L→1). Devuelve null si no es válido. */
export function normalizarFolioParticipante(crudo: string | undefined | null): string | null {
  if (!crudo) return null;
  let s = crudo.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.startsWith('P')) s = s.slice(1);
  s = s.replace(/[IL]/g, '1').replace(/O/g, '0');
  if (!/^[0-9A-HJKMNP-TV-Z]{16}$/.test(s)) return null;
  return `P-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
}

/** Últimos 4 caracteres: pista para que el equipo identifique al participante sin conocer el folio completo. */
export const pistaFolio = (folio: string) => folio.slice(-4);
