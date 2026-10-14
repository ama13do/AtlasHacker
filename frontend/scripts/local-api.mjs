#!/usr/bin/env node
/**
 * Levanta la API del back EN LOCAL para pruebas, sin tocar su código ni su .env:
 *   - base Postgres + PostGIS embebida (PGlite, la misma que usan los tests del back) en frontend/.local-db
 *   - aplica las migraciones de ../backend/drizzle (solo las que falten)
 *   - arranca ../backend/src/local.ts en http://localhost:3000 con variables de desarrollo
 *
 *   npm run api:local              # arranca (Ctrl+C para detener)
 *   npm run api:local -- --reset   # borra los datos locales y empieza de cero
 *   npm run api:local:admin -- --email tu@correo.org --nombre "Tu nombre"   # crea un admin (con la API detenida)
 *
 * En local NO funcionan: la subida real de evidencias a R2 (credenciales falsas) ni la emisión de tiempo real.
 * El captcha se omite (NODE_ENV=development sin TURNSTILE_SECRET_KEY).
 */
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND = path.resolve(FRONTEND, '../backend')
const DATA_DIR = path.join(FRONTEND, '.local-db')
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json')
const DB_PORT = 54329
const API_PORT = 3000

const args = process.argv.slice(2)
const command = args[0] === 'admin' ? 'admin' : 'serve'

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

// Los paquetes viven en backend/node_modules: se resuelve su entrada ESM a mano
async function importFromBackend(name) {
  const dir = path.join(BACKEND, 'node_modules', name)
  const pkgFile = path.join(dir, 'package.json')
  if (!fs.existsSync(pkgFile)) fail(`Falta ${name} en ../backend/node_modules. Corre "npm install" en ../backend.`)
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
  const entry = pkg.exports?.['.']?.import?.default ?? pkg.exports?.['.']?.import ?? pkg.module ?? pkg.main
  return import(pathToFileURL(path.join(dir, entry)).href)
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1')
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
  })
}

// Secretos de desarrollo: se generan una vez y se reutilizan (los folios y datos cifrados dependen de ellos)
function devSecrets() {
  if (fs.existsSync(SECRETS_FILE)) return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'))
  const secrets = {
    JWT_SECRET: randomBytes(48).toString('base64url'),
    ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    HASH_PEPPER: randomBytes(48).toString('base64url'),
  }
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 })
  return secrets
}

function apiEnv() {
  return {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(API_PORT),
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
    DATABASE_SSL: 'false',
    DB_POOL_MAX: '1', // el socket de PGlite atiende una conexión a la vez
    ...devSecrets(),
    // El login valida el origen: puertos habituales de Vite en local
    CORS_ORIGINS: ['5173', '5174', '5175', '5180'].map((p) => `http://localhost:${p}`).join(','),
    DOCS_ENABLED: 'true',
    TURNSTILE_SECRET_KEY: '', // en desarrollo el captcha se omite
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    // Credenciales FALSAS de R2: se firman URLs (cálculo local) pero la subida real falla
    R2_ACCOUNT_ID: 'local',
    R2_ACCESS_KEY_ID: 'local',
    R2_SECRET_ACCESS_KEY: 'local',
    R2_BUCKET_NAME: 'local',
    SSM_PREFIX: '',
  }
}

// Aplica las migraciones del back que aún no estén en esta base
async function migrate(db) {
  await db.exec('CREATE TABLE IF NOT EXISTS _local_migraciones (nombre text PRIMARY KEY, aplicada_at timestamptz DEFAULT now())')
  const applied = new Set((await db.query('SELECT nombre FROM _local_migraciones')).rows.map((r) => r.nombre))
  const dir = path.join(BACKEND, 'drizzle')
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files.filter((f) => !applied.has(f))) {
    process.stdout.write(`  · migración ${file} … `)
    // En una transacción: si falla, la base no queda a medias
    await db.transaction(async (tx) => {
      for (const part of fs.readFileSync(path.join(dir, file), 'utf8').split('--> statement-breakpoint')) {
        if (part.trim()) await tx.exec(part)
      }
      await tx.query('INSERT INTO _local_migraciones (nombre) VALUES ($1)', [file])
    })
    console.log('ok')
  }
}

async function openDatabase() {
  if (args.includes('--reset') && fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true })
    console.log('Datos locales borrados.')
  }
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const { PGlite } = await importFromBackend('@electric-sql/pglite')
  const { postgis } = await importFromBackend('@electric-sql/pglite-postgis')
  const { PGLiteSocketServer } = await importFromBackend('@electric-sql/pglite-socket')

  console.log(`Base local en ${path.relative(process.cwd(), DATA_DIR) || DATA_DIR}`)
  const db = new PGlite(path.join(DATA_DIR, 'pgdata'), { extensions: { postgis } })
  await db.waitReady
  // PostGIS vive en el esquema "extensions" (convención de Supabase), igual que en los tests del back
  await db.exec('SET search_path = public, extensions')
  await migrate(db)
  const server = new PGLiteSocketServer({ db, port: DB_PORT, host: '127.0.0.1' })
  await server.start()
  return { db, server }
}

function run(cmd, cmdArgs) {
  return spawn(cmd, cmdArgs, { cwd: BACKEND, env: apiEnv(), stdio: 'inherit' })
}

async function main() {
  if (!fs.existsSync(path.join(BACKEND, 'src/local.ts'))) fail(`No encontré el back en ${BACKEND}`)
  if (await portInUse(DB_PORT)) fail(`El puerto ${DB_PORT} ya está en uso: ¿la API local ya está corriendo?`)
  if (command === 'serve' && (await portInUse(API_PORT))) fail(`El puerto ${API_PORT} ya está en uso.`)

  const { db, server } = await openDatabase()
  // CLI de tsx con el mismo Node (node_modules/.bin/tsx es un script de shell que spawn no ejecuta en Windows)
  const tsx = path.join(BACKEND, 'node_modules/tsx/dist/cli.mjs')

  const child =
    command === 'admin'
      ? run(process.execPath, [tsx, 'scripts/crear-admin.ts', ...args.slice(1).filter((a) => a !== '--reset')])
      : run(process.execPath, [tsx, 'src/local.ts'])

  if (command === 'serve') console.log(`\nAPI local: http://localhost:${API_PORT}  ·  front: npm run dev:local\n`)

  let closing = false
  const shutdown = async (code = 0) => {
    if (closing) return
    closing = true
    if (child.exitCode === null) child.kill('SIGTERM')
    await server.stop().catch(() => {})
    await db.close().catch(() => {})
    process.exit(code)
  }
  child.on('exit', (code) => shutdown(code ?? 0))
  process.on('SIGINT', () => shutdown(0))
  process.on('SIGTERM', () => shutdown(0))
}

main().catch((err) => fail(err?.stack ?? String(err)))
