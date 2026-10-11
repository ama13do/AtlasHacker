# 🗺️ Guía Paso a Paso: Credenciales, Configuración y Despliegue de AtlasHacker

Esta guía explica **dónde sacar cada API Key**, **dónde colocarlas de forma 100% segura**, y **cómo probar y desplegar el backend**.

---

## 🔒 1. ¿Dónde me pasas o colocas las credenciales?

Para proteger tu seguridad y que **NUNCA** se suban credenciales privadas a GitHub:

1. Ve a la carpeta `backend/`.
2. Crea un archivo llamado exactamente `.env` (copiando como plantilla `.env.example`).
3. El archivo `.env` ya está protegido en `.gitignore`.
4. Si quieres que yo las configure por ti, puedes pegármelas aquí en el chat y yo las coloco directamente en tu archivo local `backend/.env` sin subirlas a git.

---

## 🗄️ 2. Supabase: Base de Datos, PostGIS y Realtime

### A. Dónde sacar las credenciales:
1. Inicia sesión en [supabase.com](https://supabase.com) y entra a tu proyecto (o crea uno nuevo gratuito).
2. En el menú lateral izquierdo, haz clic en **Project Settings** (el icono de engranaje ⚙️ abajo a la izquierda).
3. Haz clic en **API**:
   - **`SUPABASE_URL`**: Copia el valor de **Project URL** (ejemplo: `https://abcdefghijklmno.supabase.co`).
   - **`SUPABASE_ANON_KEY`**: Copia la clave bajo **Project API keys** que dice `anon` `public`.
   - **`SUPABASE_SERVICE_ROLE_KEY`**: Haz clic en *Reveal* en la clave que dice `service_role` `secret` y cópiala (¡esta es la clave maestra para el backend!).

### B. Cómo instalar PostGIS y crear las tablas:
1. En el menú lateral de Supabase, entra al **SQL Editor** (icono con `>_`).
2. Abre el archivo [`backend/database/schema.sql`](file:///c:/Users/amado/OneDrive/Escritorio/HXNF/AtlasHacker/backend/database/schema.sql) de este proyecto.
3. Copia todo su contenido y pégalo en el SQL Editor de Supabase.
4. Haz clic en el botón verde **RUN**.
5. ¡Listo! Esto activará **PostGIS**, creará las tablas `testimonios`, `comentarios`, `reacciones`, las funciones espaciales y habilitará **Supabase Realtime** automáticamente.

---

## ☁️ 3. Cloudflare R2: Almacenamiento de Fotos, Audios y Archivos

### A. Crear el Bucket:
1. Inicia sesión en [dash.cloudflare.com](https://dash.cloudflare.com).
2. En el menú lateral izquierdo, haz clic en **R2 Object Storage**.
3. Haz clic en **Create bucket**.
4. Nómbralo (por ejemplo: `atlashacker-media`) y haz clic en **Create Bucket**.

### B. Obtener las Claves de API de R2:
1. En la página principal de R2, a la derecha verás tu **Account ID** (una serie de 32 letras y números). Cópialo como `R2_ACCOUNT_ID`.
2. En la misma pantalla, haz clic en el botón **Manage R2 API Tokens** (Administrar tokens de API de R2).
3. Haz clic en **Create API Token**:
   - Permisos: Selecciona **Object Read & Write** (Lectura y Escritura).
   - Aplica a: Todos los buckets o solo a `atlashacker-media`.
   - Haz clic en **Create API Token**.
4. Te mostrará en pantalla:
   - **Access Key ID**: Cópialo como `R2_ACCESS_KEY_ID`.
   - **Secret Access Key**: Cópialo como `R2_SECRET_ACCESS_KEY` *(solo se muestra una vez)*.

### C. Habilitar Acceso Público al Bucket:
1. Entra a tu bucket `atlashacker-media` -> pestaña **Settings**.
2. Busca la sección **Public Access** -> **R2.dev subdomain**.
3. Haz clic en **Allow Access** (o conecta un subdominio propio si tienes).
4. Copia la URL pública que te da (ejemplo: `https://pub-xxxxxxxx.r2.dev`) y colócala en `R2_PUBLIC_URL`.

---

## ⚡ 4. AWS: Para el Backend Serverless (API Gateway + Lambdas)

### A. Crear el Usuario IAM en AWS:
1. Entra a la consola de [AWS Console](https://console.aws.amazon.com).
2. En el buscador superior escribe **IAM** y entra a IAM.
3. En el menú lateral izquierdo, ve a **Users** (Usuarios) -> **Create user** (Crear usuario).
4. Nombre de usuario: `atlashacker-deployer`.
5. En el paso de permisos (*Set permissions*), selecciona **Attach policies directly** (Asociar directivas directamente):
   - Para desplegar sin problemas de permisos, selecciona `AdministratorAccess` (o crea un rol con permisos para Lambda, APIGateway, CloudWatch, S3, IAM).
6. Haz clic en **Next** y luego en **Create user**.

### B. Generar Access Key y Secret Key:
1. Haz clic sobre el usuario recién creado `atlashacker-deployer`.
2. Ve a la pestaña **Security credentials** (Credenciales de seguridad).
3. Baja hasta la sección **Access keys** y haz clic en **Create access key**.
4. Selecciona la opción **Command Line Interface (CLI)**, marca la casilla de confirmación y haz clic en **Next**.
5. Haz clic en **Create access key**.
6. Te mostrará:
   - **`AWS_ACCESS_KEY_ID`**
   - **`AWS_SECRET_ACCESS_KEY`**
7. Descarga el archivo `.csv` o copia ambos valores inmediatamente.

---

## 📁 5. Estructura del Archivo `.env` Final

En [`backend/.env`](file:///c:/Users/amado/OneDrive/Escritorio/HXNF/AtlasHacker/backend/.env), el contenido debe verse así:

```env
PORT=3000
NODE_ENV=development

# SUPABASE
SUPABASE_URL=https://tu-id-de-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# CLOUDFLARE R2
R2_ACCOUNT_ID=tu_account_id_de_32_caracteres
R2_ACCESS_KEY_ID=tu_r2_access_key_id
R2_SECRET_ACCESS_KEY=tu_r2_secret_access_key
R2_BUCKET_NAME=atlashacker-media
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🚀 6. Cómo Ejecutar y Probar

### Probar en Local (sin gastar en AWS):
```bash
cd backend
npm run dev
```
La API arrancará en `http://localhost:3000`.

### Desplegar a AWS:
```bash
cd backend
npm run deploy
```
Serverless empaquetará el código en TypeScript, creará la Lambda y el API Gateway en AWS, y al terminar te devolverá la URL pública HTTPS de tu backend (ejemplo: `https://xyz123.execute-api.us-east-1.amazonaws.com`).

---

## 📡 7. Resumen de Endpoints Disponibles en el Backend

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/` y `/health` | Chequeo de estado de la API |
| `POST` | `/api/testimonios` | Crea un testimonio con punto espacial PostGIS (`latitud`, `longitud`, `media_url`, etc.) |
| `GET` | `/api/testimonios` | Lista testimonios. Soporta filtros: `?lat=...&lng=...&radio=5000` (radio en metros) o `?min_lng=...&min_lat=...&max_lng=...&max_lat=...` (bounding box de pantalla) |
| `GET` | `/api/testimonios/:id` | Detalle del testimonio con sus comentarios |
| `POST` | `/api/testimonios/:id/comentarios` | Agrega un comentario al testimonio |
| `GET` | `/api/testimonios/:id/comentarios` | Lista comentarios del testimonio |
| `POST` | `/api/testimonios/:id/reacciones` | Registra una reacción (`like`, `apoyo`, `alerta`) |
| `POST` | `/api/media/presigned-url` | Devuelve una URL firmada de Cloudflare R2 para subir fotos/audios directo desde el front |
