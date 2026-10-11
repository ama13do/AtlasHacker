import { randomBytes } from 'node:crypto';
import { argon2Verify, argon2id } from 'hash-wasm';

// Argon2id con parámetros OWASP (m=19 MiB, t=2, p=1). hash-wasm es WASM puro: no requiere binarios nativos en Lambda.
export async function hashPassword(password: string): Promise<string> {
  return argon2id({
    password,
    salt: randomBytes(16),
    parallelism: 1,
    iterations: 2,
    memorySize: 19456,
    hashLength: 32,
    outputType: 'encoded',
  });
}

export async function verificarPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
}

let hashFalso: Promise<string> | undefined;
/** Se verifica contra un hash falso cuando el usuario no existe, para que el tiempo de respuesta no revele si el correo existe. */
export async function verificacionFalsa(password: string): Promise<void> {
  hashFalso ??= hashPassword(randomBytes(16).toString('hex'));
  await verificarPassword(password, await hashFalso);
}

export function generarPasswordTemporal(): string {
  return randomBytes(15).toString('base64url');
}
