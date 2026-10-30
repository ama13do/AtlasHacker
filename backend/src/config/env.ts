import dotenv from 'dotenv';
import { z } from 'zod';

// En Lambda las variables vienen del entorno (y los secretos de SSM); en local, del .env
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) dotenv.config();

const clave32 = z.string().refine((v) => {
  try {
    return Buffer.from(v, 'base64').length === 32;
  } catch {
    return false;
  }
}, 'Debe ser una clave de 32 bytes en base64 (npm run secretos:generar)');

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  PUBLIC_API_URL: z.string().url().optional(),

  // Base de datos. DATABASE_URL = pooler de Supabase (puerto 6543, modo transacción) para la API.
  // DIRECT_URL = conexión directa/sesión (5432) solo para migraciones.
  DATABASE_URL: z.string().min(10),
  DIRECT_URL: z.string().min(10).optional(),
  DATABASE_SSL: z.stringbool().default(true),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),

  // Secretos propios (NUNCA reutilizar entre ambientes)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  ENCRYPTION_KEY: clave32,
  ENCRYPTION_KEY_ANTERIOR: clave32.optional(),
  HASH_PEPPER: z.string().min(32, 'HASH_PEPPER debe tener al menos 32 caracteres'),

  ACCESS_TTL_MIN: z.coerce.number().int().min(1).default(15),
  REFRESH_TTL_DIAS: z.coerce.number().int().min(1).default(14),

  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  DOCS_ENABLED: z.stringbool().default(true),

  TURNSTILE_SECRET_KEY: z.string().optional(),

  // Realtime (Supabase Broadcast, solo se usa para emitir desde el servidor)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  REALTIME_TOPIC: z.string().default('mapa'),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),

  // Asistente de IA para la pregunta al Tribunal: Groq primero y OpenRouter de respaldo si Groq falla.
  // Apagado salvo que ASISTENTE_IA_ACTIVO=true y haya al menos una de las dos claves
  ASISTENTE_IA_ACTIVO: z.stringbool().default(false),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('qwen/qwen3.8-27b'), // id de console.groq.com/docs/models
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('anthropic/claude-haiku-5.5'), // id de openrouter.ai/models

  // Si se define, los secretos se leen en runtime desde AWS SSM Parameter Store (/prefijo/NOMBRE)
  SSM_PREFIX: z.string().optional(),
});

export type Env = z.infer<typeof esquema> & { corsOrigins: string[]; esProduccion: boolean };

let cache: Env | null = null;
let cargando: Promise<Env> | null = null;

async function leerSecretosSsm(prefijo: string): Promise<Record<string, string>> {
  const { SSMClient, GetParametersByPathCommand } = await import('@aws-sdk/client-ssm');
  const ssm = new SSMClient({});
  const resultado: Record<string, string> = {};
  let token: string | undefined;
  do {
    const r = await ssm.send(
      new GetParametersByPathCommand({ Path: prefijo, WithDecryption: true, Recursive: false, NextToken: token }),
    );
    for (const p of r.Parameters ?? []) {
      if (p.Name && p.Value) resultado[p.Name.split('/').pop()!] = p.Value;
    }
    token = r.NextToken;
  } while (token);
  return resultado;
}

/** Valida y cachea el entorno. Debe ejecutarse una vez al arrancar (cold start) antes de usar env(). */
export function initEnv(): Promise<Env> {
  if (cache) return Promise.resolve(cache);
  cargando ??= (async () => {
    const crudo: Record<string, string | undefined> = { ...process.env };
    if (process.env.SSM_PREFIX) Object.assign(crudo, await leerSecretosSsm(process.env.SSM_PREFIX));
    for (const k of Object.keys(crudo)) if (crudo[k] === '') delete crudo[k];

    const r = esquema.safeParse(crudo);
    if (!r.success) {
      const faltan = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Configuración de entorno inválida:\n${faltan}`);
    }
    cache = {
      ...r.data,
      corsOrigins: r.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
      esProduccion: r.data.NODE_ENV === 'production',
    };
    return cache;
  })();
  return cargando;
}

export function env(): Env {
  if (!cache) throw new Error('initEnv() no se ha ejecutado todavía');
  return cache;
}

/** Dominios oficiales (siempre permitidos, además de CORS_ORIGINS): el sitio de HxNF y el atlas. */
const ORIGENES_OFICIALES = ['https://atlashacker.hxnf.mx', 'https://hxnf.mx', 'https://www.hxnf.mx'];

/**
 * ¿Origen autorizado para CORS y para la cookie de sesión?
 * Solo los nuestros: lista blanca, dominios oficiales, despliegues de ESTE proyecto en Vercel
 * (atlashacker.vercel.app y sus previews atlashacker-…vercel.app) y localhost (para entrar al panel desde la
 * máquina de desarrollo contra producción; una página atacante tendría que servirse en el equipo de la víctima).
 * Nunca cualquier *.vercel.app: cualquiera puede publicar ahí y usaría la sesión del panel (CSRF).
 */
export function esOrigenPermitido(origin: string | undefined): boolean {
  if (!origin) return false;
  if (env().corsOrigins.includes(origin) || ORIGENES_OFICIALES.includes(origin)) return true;
  if (/^https:\/\/atlashacker(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}
