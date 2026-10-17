# AtlasHacker · Backend

API del mapa de testimonios del **Tribunal Popular por Nuestro Futuro** (expediente `FUTURO/001` · *Sistema Energético Nacional*) y de su dashboard de moderación.

**Stack:** Hono + Zod/OpenAPI · Drizzle ORM · Postgres/PostGIS (Supabase) · Cloudflare R2 · Cloudflare Turnstile · Supabase Realtime · AWS Lambda (Serverless).
Configuración paso a paso: [`../instrucciones.md`](../instrucciones.md) · Guía para el frontend: [`../docs/INTEGRACION_FRONTEND.md`](../docs/INTEGRACION_FRONTEND.md).
Referencia interactiva de todos los endpoints: **Swagger en `/docs`** (protegido).

## Estructura

```
src/
  db/schema.ts        ← EL esquema (Drizzle): tablas, enums, tipos PostGIS. Fuente de verdad.
  app.ts              ← middlewares globales, Swagger protegido, manejo de errores
  routes/             ← publico · participante (mi folio) · auth · admin/* (dashboard)
  services/           ← reglas de negocio (testimonios, evidencias, moderación, social, estadísticas…)
  middleware/         ← auth JWT + roles, folio, captcha, rate limit
  lib/                ← cifrado AES-GCM, folios, argon2id, R2, realtime, captcha
drizzle/              ← migraciones SQL versionadas (0000 tablas · 0001 triggers, vistas, índices, RLS, semillas)
scripts/              ← migrar · crear-admin · generar-secretos · subir-secretos-ssm · verificar-entorno
tests/                ← 78 pruebas (unitarias + integración con Postgres/PostGIS embebido)
```

Cambiar el modelo: edita `src/db/schema.ts` → `npm run db:generate` → revisa el SQL → `npm run db:migrate`.
(Triggers, vistas, índices GiST/parciales y RLS viven en `drizzle/0001_postgis_extras.sql`.)

## Modelo de datos (basado en la ficha PDF)

| Tabla | Para qué |
|---|---|
| `expedientes` | Apartado con su número (`FUTURO/001`) y su materia. Los folios usan su código. |
| `categorias` | Inseguridad energética · Afectaciones por cambio climático · Megaproyectos (editables). |
| `participantes` | **Folio/token** de cada persona (solo su HMAC) + datos opcionales **cifrados** (nombre, correo, teléfono) y perfil público opcional. |
| `testimonios` | La ficha completa: las 6 secciones, evidencias que acompañan, consentimiento, información sensible, geometría PostGIS, moderación, `activo` (1/0), contadores. |
| `testimonios_auditoria` | Auditoría **opcional** del envío: IP (cifrada), user-agent, huella, captcha, precisión GPS, origen de la ubicación, versión del consentimiento; con fecha de purga. |
| `evidencias` | Hasta N archivos por testimonio (R2, bucket privado) con folio `FUTURO/001-E…`. |
| `comentarios` · `comentarios_likes` · `reacciones` | Social. Un like/reacción por dispositivo; contadores atómicos por trigger. |
| `usuarios` · `sesiones` | Dashboard: roles, argon2id, refresh tokens rotativos. |
| `configuracion` | Ajustes editables desde el dashboard (modo de publicación, límites, captcha, auditoría…). |
| `bitacora` | Quién hizo qué, con antes/después. **Solo se agrega** (un trigger impide UPDATE/DELETE). |

- **Todo es aleatorio**: UUID v4 como llave; folios `FUTURO/001-T7K3MQ9X`, `…-E4XA9ZP2` (40 bits) y de persona `P-XXXX-XXXX-XXXX-XXXX` (80 bits). Nada secuencial.
- **Geometrías**: `Point`, `LineString`, `Polygon` y sus `Multi*`, exactas, SRID 4326 (GeoJSON `[lng, lat]`). Se valida con PostGIS (se reparan autointersecciones; se rechazan geometrías degeneradas). Cada testimonio tiene además un `centroide` (pin del mapa).
- **Vista pública `v_testimonios_publicos`**: es la **única** fuente de lo que ve el público (y el rol QGIS). Aplica: aprobado + activo + autorizó publicar + no es «solo uso interno»; oculta el nombre si es anónimo o «anonimizar»; entrega la geometría pública (exacta o generalizada ~1 km).

## Reglas de publicación (configurables)

`modo_publicacion` (dashboard → configuración):

| Modo | Efecto |
|---|---|
| `revisar_todo` (default) | Todo queda pendiente hasta que un moderador lo aprueba. |
| `auto_si_no_sensible` | Se publica solo si **no** hay información sensible. |
| `auto_todo` | Se publica todo sin revisión. |

**Reglas fijas** (ningún modo las salta, y la base de datos las vuelve a garantizar): «solo documentación interna» / «no autorizo publicación» **nunca** se publican · «revisión antes de publicar» y «uso interno» siempre pasan a revisión · «anonimizar» oculta el nombre y generaliza la ubicación · recibos y documentos oficiales **nunca** se publican solos.

## Folios y anonimato

1. Quien sube su primer testimonio recibe un **folio** (aunque sea anónimo). Se muestra **una sola vez**; en la base solo queda su HMAC.
2. Con `X-Folio` la persona sube más, ve y edita **solo los suyos** (`/api/mis-testimonios`) y el equipo sabe cuántos aporta. Puede dejar nombre/correo/teléfono (opcionales, cifrados) o hacer público su perfil.
3. **Recuperación**: la persona escribe al equipo → se busca por correo/teléfono (índice ciego) o por los últimos 4 caracteres del folio → `POST /api/admin/participantes/{id}/rotar-folio` emite uno nuevo. (Envío automático con SES: pendiente.)

## Roles del dashboard

| | superadmin | admin | moderador | facilitador | lector |
|---|:-:|:-:|:-:|:-:|:-:|
| Resumen y estadísticas | ✓ | ✓ | | | ✓ |
| Ver testimonios y comentarios | ✓ | ✓ | sin sensibles | | sin sensibles |
| Ver testimonios con información sensible o de menores | ✓ | ✓ | | | |
| Capturar fichas (y subir evidencias a lo que capturó) | ✓ | ✓ | ✓ | ✓ | |
| Aprobar / rechazar testimonios y comentarios | ✓ | ✓ | ✓ | | |
| Editar, regresar a revisión, dar de baja / reactivar, ocultar comentarios, publicar evidencias | ✓ | ✓ | | | |
| Personas y datos personales, rotar folios, auditoría de envío (IP), configuración, catálogos | ✓ | ✓ | | | |
| Usuarios: moderación, facilitación y lectura | ✓ | ✓ | | | |
| Usuarios: dar el rol admin y modificar cuentas admin | ✓ | | | | |
| **Borrar** (testimonio con `confirmar=<folio>`, comentario, evidencia, cuenta, datos personales ARCO, purga) | ✓ | | | | |
| **Descargar** (exportar GeoJSON) y **bitácora** | ✓ | | | | |

El superadmin es uno solo y se da de alta por script (`npm run admin:crear -- --email … --rol superadmin`); el panel no asigna ese rol ni deja que nadie más modifique su cuenta.
La bitácora guarda de cada acción quién la hizo (correo, nombre y rol de ese momento), el folio del testimonio, la hora, la IP (cifrada) y el navegador, y el antes/después; también los inicios de sesión fallidos sobre cuentas existentes y los cierres de sesión. Es de solo agregar.

## Seguridad

- **Cero secretos expuestos**: la API nunca devuelve claves ni hashes. En AWS los secretos están en SSM (SecureString) y se leen en runtime. La `anon` key solo sirve en el frontend para *escuchar* el canal `mapa`.
- **Datos personales cifrados** (AES-256-GCM con el contexto de la columna como AAD) y búsqueda por **índice ciego** (HMAC con pepper). Las consultas a datos personales dejan rastro en la bitácora.
- **RLS activo en todas las tablas, sin políticas**: la clave `anon`/`authenticated` de Supabase no puede leer ni escribir nada. La API se conecta como dueño de las tablas. Permisos revocados a `anon`/`authenticated`.
- **Login**: argon2id (WASM), JWT de 15 min + refresh rotativo en cookie `httpOnly` con detección de reutilización, límite por IP y por cuenta, bloqueo tras 5 fallos, tiempo constante y mensaje genérico. El rol y la baja se leen de la base en cada petición; cambiar rol/desactivar/cambiar contraseña cierra sesiones al instante.
- **Anti-abuso**: Turnstile, rate limit por IP en Postgres (sirve entre instancias de Lambda), límite de 1 MB de JSON, CORS con lista blanca, cabeceras de seguridad, IP real tomada de API Gateway (no de `X-Forwarded-For`).
- **Evidencias**: bucket privado, subida directa con URL firmada, **verificación en R2 del tamaño y tipo reales**, límites configurables (por defecto **5 archivos / 20 MB** en total), lectura solo con URL temporal.
- **Errores**: nunca se filtra SQL ni parámetros (los errores de Drizzle incluyen los valores; se registran solo la causa).
- **LFPDPPP**: consentimiento versionado por testimonio, minimización (todo lo personal es opcional), cancelación de datos (`DELETE /api/admin/participantes/{id}/datos-personales`), rectificación (PATCH), retención configurable de la auditoría y purga automática diaria.

## Rendimiento

- Índices **GiST parciales** sobre solo lo público (bbox con `&&`, radio en metros con `geography`), índice parcial para el listado público y para la cola de moderación, GIN de texto completo en español.
- **Paginación por cursor** (keyset) en listados públicos; mapa en GeoJSON con tope y bandera `truncado`; el pin (`centroide`) evita enviar polígonos completos.
- Conexión reutilizada entre invocaciones y por el **pooler** de Supabase; contadores de likes/comentarios por trigger (sin leer-sumar-escribir).

## Pendiente / decisiones abiertas

- Envío del folio recuperado por correo con **SES** (por ahora la recuperación es manual).
- Quitar **EXIF/GPS** de las fotos subidas (requiere procesamiento de imágenes).
- Dominio definitivo (CORS, Turnstile, R2 CORS) y versión final del **aviso de privacidad** (`consentimiento_version_actual`).
- Si el volumen del mapa supera unos miles de puntos: teselas vectoriales (`ST_AsMVT`) o clustering en servidor.
