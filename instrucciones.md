# Guía de configuración y despliegue · AtlasHacker (backend)

Todo se ejecuta desde `backend/`. Cada paso dice **qué obtener, dónde guardarlo y cómo comprobarlo**.
Los secretos viven **solo** en `backend/.env` (ignorado por git) y, en AWS, en **SSM Parameter Store** (cifrados). No se pegan en chats ni en el código.

```bash
cd backend
npm install
cp .env.example .env          # y rellena lo que sigue
npm run secretos:generar      # genera JWT_SECRET, ENCRYPTION_KEY y HASH_PEPPER (no sobrescribe)
npm run entorno:verificar     # revisa que .env sea válido, sin mostrar secretos
```

> **Respalda `ENCRYPTION_KEY` y `HASH_PEPPER`** en un gestor de contraseñas. Si se pierde la primera, nombres/correos/teléfonos/IP cifrados no se recuperan; si cambia el segundo, los folios existentes dejan de funcionar. Usa valores distintos en dev y prod.

---

## 1. Supabase (base de datos PostGIS + tiempo real)

1. Proyecto en [supabase.com](https://supabase.com) → **Project Settings → API**: copia `Project URL` → `SUPABASE_URL` y la `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (solo backend). La `anon` key va **en el frontend**.
2. Botón **Connect** → sección **Pooler**:
   - **Transaction pooler** (puerto `6543`) → `DATABASE_URL` (lo que usa la API / Lambda).
   - **Session pooler** (puerto `5432`) → `DIRECT_URL` (lo que usan las migraciones).
   - ⚠️ No uses `db.<ref>.supabase.co`: es solo IPv6 y **no funciona en AWS Lambda** ni en muchas redes.
   - Si la contraseña tiene `/ @ # ? :` o espacios, codifícalos en la URL (`/` → `%2F`).
3. Crea las tablas, vistas, triggers, índices espaciales, RLS y datos semilla (categorías y expediente FUTURO/001):
   ```bash
   npm run db:migrate
   ```
   PostGIS se activa solo (esquema `extensions`). No hace falta pegar SQL a mano: las migraciones están versionadas en `backend/drizzle/`.
4. Crea el primer administrador:
   ```bash
   npm run admin:crear -- --email tu@correo.org --nombre "Tu Nombre"
   ```
   Sin `--password` genera una temporal y la muestra **una vez**.
5. (Opcional) **QGIS**: la migración crea el rol `lector_qgis`, de solo lectura y **únicamente** sobre la vista pública. Para habilitarlo, en el SQL Editor de Supabase:
   `ALTER ROLE lector_qgis LOGIN PASSWORD '<contraseña fuerte>';` y conecta QGIS por el *Session pooler* con el usuario `lector_qgis.<ref>`.

## 2. Cloudflare R2 (evidencias)

1. **R2 → Create bucket** (`atlashacker-media`). **No actives el acceso público** (`r2.dev`): las evidencias se sirven con URLs firmadas temporales.
   Si ya lo habías activado, desactívalo en *Settings → Public access*.
2. **R2 → Manage API tokens → Create API token** con permiso **Object Read & Write** limitado a ese bucket → `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.
3. **CORS del bucket** (Settings → CORS policy) para que el navegador suba directo con la URL firmada:
   ```json
   [{
     "AllowedOrigins": ["http://localhost:5173", "https://TU-DOMINIO-FRONT"],
     "AllowedMethods": ["PUT", "GET"],
     "AllowedHeaders": ["Content-Type"],
     "MaxAgeSeconds": 3600
   }]
   ```

## 3. Cloudflare Turnstile (captcha)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile → Add widget**. Dominios: `localhost` (y después el dominio real). Modo *Managed*.
2. Te da una **Site key** (va en el **frontend**) y una **Secret key** → `TURNSTILE_SECRET_KEY` (backend).
3. Para pruebas hay claves que siempre pasan: site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`.
4. El frontend manda el token en la cabecera `X-Captcha-Token`. En desarrollo, si `TURNSTILE_SECRET_KEY` está vacío, el captcha se omite; **en producción es obligatorio**. También se puede apagar desde el dashboard (`captcha_requerido`).

## 4. Probar en local

```bash
npm run dev                   # http://localhost:3000
npm test                      # 70 pruebas con Postgres+PostGIS embebido (no usa Docker ni toca servicios reales)
npm run typecheck
```
- **Swagger:** `http://localhost:3000/docs` → pide **usuario y contraseña de un usuario del dashboard** (HTTP Basic). Para probar rutas protegidas: `POST /api/auth/login`, copia el `access_token` y pulsa **Authorize**.
- El frontend local (`http://localhost:5173` y `:3000`) ya está permitido por CORS; cámbialo con `CORS_ORIGINS`.

## 5. AWS (despliegue serverless) — ya desplegado

**Producción actual:** `https://rwxdsyv0c2.execute-api.us-west-2.amazonaws.com` (stage `prod`, región `us-west-2`, la misma de Supabase) · Swagger en `/docs`.
Front permitido por CORS: `https://atlashacker.vercel.app`.

1. Credenciales de despliegue: no uses `AdministratorAccess`. Usuario/rol con permisos para CloudFormation, Lambda, API Gateway, IAM (roles de la función), CloudWatch Logs, S3 (artefactos de Serverless), EventBridge y SSM. Configúralo con `aws configure`.
2. Secretos a SSM (cifrados con KMS; la Lambda los lee en runtime). En producción el CORS lleva SOLO el dominio del front:
   ```bash
   npm run secretos:subir -- --stage prod --set CORS_ORIGINS=https://atlashacker.vercel.app --set PUBLIC_API_URL=https://rwxdsyv0c2.execute-api.us-west-2.amazonaws.com
   ```
   `ENCRYPTION_KEY` y `HASH_PEPPER` deben ser **los mismos** que se usaron para crear los datos de esa base.
3. Desplegar: `npm run deploy:prod` (≈1 min). Los cambios de SSM se toman en los arranques nuevos de la Lambda; para forzarlo, vuelve a desplegar.
4. CORS del bucket R2 (para que el navegador suba evidencias): `npm run r2:cors -- https://atlashacker.vercel.app http://localhost:5173`.
5. Tarea diaria `mantenimiento`: purga auditoría vencida, sesiones y límites caducados.
6. Logs: CloudWatch → `/aws/lambda/atlashacker-api-prod-api`.

> Regla técnica: no usar `Promise.all` con consultas a la base (con el pooler de Supabase en modo transacción y 1 conexión por Lambda se cuelga). Usar `enSerie()` de `src/db/client.ts`; hay una prueba que lo vigila.

## 6. Si cambia el dominio del front

Repite el paso 2 con el nuevo `CORS_ORIGINS` (separa varios con coma), `npm run deploy:prod`, `npm run r2:cors -- <dominios>` y agrega el dominio al widget de Turnstile en Cloudflare.

## Tiempo real

El mapa escucha el canal **privado** `mapa` de Supabase Realtime con la `anon` key (solo lectura: nadie puede inyectar eventos). Ver `docs/INTEGRACION_FRONTEND.md`. La migración ya crea la política de lectura.
