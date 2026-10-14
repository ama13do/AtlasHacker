# AtlasHacker · Frontend

Vue 3 + TypeScript + Vite, Tailwind v4, Pinia, Vue Router, Axios y MapLibre GL JS.

```bash
cp .env.example .env
npm install
npm run dev
```

## Estructura

Organizada por módulos de dominio: cada feature vive con su UI, estado, servicios, tipos y rutas.

```
src/
├── main.ts / App.vue / style.css
├── core/              # infraestructura transversal
│   ├── http/client.ts     # instancia axios + ApiError
│   ├── router/index.ts    # compone las rutas de los módulos
│   └── config/theme.ts    # paleta BRAND para código
├── shared/            # reutilizable entre módulos
│   ├── components/  composables/  stores/  types/  utils/
└── modules/
    ├── map/               # mapa genérico (MapView con puntos), sin rutas propias
    │   ├── index.ts       # API pública: MapView, MapPoint
    │   ├── components/  types/  utils/  assets/
    │   └── config.ts
    └── testimonies/       # testimonios (ficha FUTURO/001): rutas '/' y '/testimonios/nuevo'
        ├── index.ts       # API pública: testimoniesRoutes
        ├── routes.ts
        ├── views/         # HomePage, CreateTestimonyPage (wizard)
        ├── components/    # StoriesBar, StoryViewer, TestimonySidebar, CategoryBadge…
        │   └── form/      # pasos del wizard y campos (FormField, ChoiceGroup, LocationPicker…)
        ├── composables/   # useTestimonyForm: estado, validación por paso y borrador
        ├── services/      # testimonies.service (llamadas a la API) y mappers (API → modelo)
        ├── stores/        # testimonies (resúmenes + fichas en caché) y categories (/api/config)
        ├── types/         # api.ts (contratos crudos) y testimony.ts (modelo del front)
        ├── utils/
        └── data/          # estilo de marca por categoría y portadas
    └── admin/             # dashboard del equipo: rutas /admin/*
        ├── index.ts       # API pública: adminRoutes, adminGuard
        ├── routes.ts      # rutas + guard de sesión y roles
        ├── views/         # LoginPage, AdminLayout, DashboardPage, TestimoniesPage, TestimonyPage, AccountPage
        ├── components/    # AdminNav, KpiTile, gráficas, ModerationActions, StaffEvidencePanel, AuditPanel…
        ├── stores/auth.ts # sesión (access token solo en memoria)
        └── services/      # adminHttp (Bearer + refresh), auth, estadísticas, moderación de testimonios
```

### Reglas de dependencias

- `modules/*` puede importar de `core/` y `shared/`.
- `shared/` solo importa de `core/`.
- `core/` no importa de `modules/`, salvo `core/router` para registrar sus rutas.
- Un módulo no importa los internos de otro; solo lo que exporta su `index.ts`.

### Crear un módulo nuevo

1. Crear `src/modules/<nombre>/` con las carpetas que necesite (`views/`, `components/`, `stores/`, `services/`, `types/`).
2. `routes.ts`: exportar `<nombre>Routes: RouteRecordRaw[]` con vistas en carga diferida (`() => import('./views/...')`).
3. `index.ts`: exportar las rutas y lo que otros módulos puedan usar.
4. Registrar las rutas en `src/core/router/index.ts`.
5. Alias `@<nombre>` → `src/modules/<nombre>` en `vite.config.ts` (`resolve.alias`) y `tsconfig.app.json` (`paths`); dentro del módulo importar con ese alias (p. ej. `@map/config`).
6. Servicios: usar `http` de `@/core/http/client`; stores de Pinia con `defineStore('<nombre>/...', ...)`.

## API

Backend en `../backend` (Hono; **no se modifica desde aquí**). Guía: `../docs/INTEGRACION_FRONTEND.md`; referencia completa en Swagger (`<API>/docs`).

- `VITE_API_URL` es la URL base **sin** `/api`: la API de pruebas en AWS o `http://localhost:3000` para el back local (ver `.env.example`).
- **Dev:** las llamadas van a `/api/...` en el mismo origen y el proxy de Vite las reenvía a `VITE_API_URL`. Así se evita el CORS de AWS, que solo permite el dominio de Vercel. Tras cambiar `.env`, reinicia `npm run dev`.
- **Build:** se llama directo a `VITE_API_URL`.
- Respuestas: éxito `{ success: true, data, … }` y error `{ success: false, error: { codigo, mensaje, detalles? } }`. El cliente (`src/core/http/client.ts`) convierte los errores en `ApiError { status, code, message, details }`.
- La forma de la API (español, snake_case) solo la conocen `types/api.ts` y `services/mappers.ts`; el resto usa el modelo de `types/testimony.ts`.
- Las categorías vienen de `/api/config`; su color se asigna con los acentos de la marca por slug (`data/categories.ts`), no con el color de la API.

| Etapa | Alcance | Estado |
| --- | --- | --- |
| 1 · Lectura | Pines (`/api/mapa`), historias, lista y ficha (`/api/testimonios/{id}`), estados de carga, vacío y error | Lista |
| 2 · Crear | `POST /api/testimonios` con Turnstile (`X-Captcha-Token`) y folio de participante (`X-Folio`) | Lista |
| 3 · Evidencias | Reservar → `PUT` a R2 → confirmar, con progreso y reintento por archivo | Lista |
| 4a · Social | Reacciones, comentarios (con captcha) y pines en tiempo real (Supabase) | Lista |
| 4b · Mi folio | Mis testimonios, editar, dar de baja, perfil y evidencias | Lista |

### Reacciones, comentarios y tiempo real

- **`X-Device-Id`:** UUID aleatorio por dispositivo (`localStorage` `atlashacker:device-id`, en `src/core/http/deviceId.ts`), que el cliente http manda en todas las peticiones. La API lo usa para «una reacción o like por dispositivo»; no identifica a la persona.
- **Reacciones** (Me importa, Apoyo, Alerta, Urgente): son optimistas y se revierten si la API falla (`stores/testimonies.toggleReaction`). En el visor de historias van fuera de la zona táctil.
- **Comentarios:** se cargan al abrir la sección y se paginan con cursor. Publicar pide captcha (el widget aparece al empezar a escribir) y manda el folio recordado si existe. Si el comentario queda en moderación, se avisa.
- **Interruptores de `/api/config`:** si `comentarios_habilitados`, `reacciones_habilitadas` o `mapa_tiempo_real` están en false, esa parte no se muestra.
- **Tiempo real:** el canal privado `mapa` de Supabase Realtime (`composables/useMapRealtime.ts`) recibe `testimonio.publicado`, `actualizado` y `retirado`, y actualiza los pines sin recargar. Requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (la anon key es pública; nunca la `service_role`). Sin ellas, todo funciona igual sin tiempo real. `supabase-js` se carga con `import()` dinámico, en un chunk aparte. La barra lateral muestra «En vivo» cuando el canal está conectado.

### Mi folio (`/mi-folio`)

- **Acceso:** la persona entra con su folio de participante, que se valida contra `GET /api/mi-perfil`. Puede quedar **de sesión** (solo en memoria) o **recordado** en el dispositivo (`composables/useParticipantFolio.ts`). «Salir» olvida ambos.
- **Mis testimonios:** cada uno muestra su estado (en revisión, publicado, no publicado con su motivo, dado de baja). Desde ahí se puede ver en el mapa, editar, gestionar evidencias y dar de baja (con confirmación en línea).
- **Editar:** la ruta `/mi-folio/testimonios/:id/editar` reutiliza el wizard (`CreateTestimonyPage` con `edit`). El borrador se precarga con `draftFromMine` y **no** se guarda en localStorage, así no se pisa el borrador de un testimonio nuevo. No pide captcha ni folio y, al guardar, el testimonio vuelve a revisión. «Los datos dicen» se edita como un solo texto, igual que lo guarda la API.
- **Evidencias:** listar, eliminar y agregar (con `useEvidenceUpload`).
- **Perfil:** muestra solo **qué** datos dejó la persona. «Ver mis datos» los descifra (`?datos=true`) y la API deja registro de la consulta. Se pueden editar o borrar (envía `null`) y activar el perfil público con un nombre a mostrar.
- Los permisos `participantes_pueden_editar` y `participantes_pueden_eliminar` de `/api/config` ocultan esas acciones.

### Dashboard (`/admin`)

- **Sesión:**
  - `POST /api/auth/login` devuelve un access token de 15 min, que se guarda **solo en memoria**, y deja una cookie `httpOnly` de refresh (`path=/api/auth`);
  - `stores/auth.ts` lo renueva un minuto antes de que expire y, al recargar, intenta recuperar la sesión con la cookie;
  - `services/adminHttp.ts` agrega `Authorization: Bearer`; ante un 401 renueva una vez y reintenta. Si no puede, la sesión se cierra y vuelve al login con «Tu sesión expiró».
- **Roles:** admin, moderador, facilitador y lector. La navegación se filtra por rol y el guard (`adminGuard`) redirige si falta permiso. Con una contraseña temporal (`debe_cambiar_password`; la tienen las cuentas creadas o restablecidas, también desde Swagger), el guard lleva a `/admin/cuenta`, que se muestra como «Crea tu contraseña», sin navegación. Al guardarla, la API cierra todas las sesiones y el front vuelve a entrar solo con la nueva (`changePasswordAndRelogin`) y abre el panel.
- **Login en local:** el back solo acepta login desde los orígenes de `CORS_ORIGINS` (protege la cookie). Hay que agregar `http://localhost:5173` en el stage de pruebas; si no, el login responde 403 y la pantalla lo explica.
- **Safari:** en producción, con front y API en dominios distintos, puede bloquear la cookie de refresh. Entonces la sesión dura 15 min y luego pide volver a entrar.
- **Testimonios (`/admin/testimonios`):** cola de moderación con pestañas (por revisar, aprobados, rechazados, dados de baja, todos), filtros (texto o folio exacto, categoría, origen, sensibles, fechas) que viven en la URL y paginación.
  - **Por lote** (admin y moderador): seleccionar y aprobar, rechazar (con motivo), regresar a revisión, dar de baja o reactivar. Se informa cuántos fallaron.
  - **Detalle (`/admin/testimonios/:id`):**
    - la ficha completa con la ubicación exacta en el mapa, el consentimiento y la información sensible;
    - **acciones según el estado:** aprobar (eligiendo si se publica la multimedia autorizada), rechazar (con motivo, que la persona ve en «Mi folio»), regresar a revisión, dar de baja o reactivar;
    - **edición de la ficha** (queda en la bitácora con el antes y el después), notas internas y ubicación aproximada en el mapa público;
    - **evidencias:** ver con una URL de 5 min (queda registrado), pública o privada, ocultar o eliminar.
  - **Solo admin:** la auditoría del envío (IP descifrada, a demanda) y la eliminación definitiva, que exige escribir el folio.
  - **Lector:** solo lectura. **Facilitador:** ve únicamente lo que capturó; capturar fichas en papel llega en una siguiente etapa.
- **Comentarios (`/admin/comentarios`):** pestañas por revisar, publicados, ocultos, rechazados y todos; filtro por testimonio (`?testimonio=<id>`, enlazado desde el detalle).
  - Admin y moderador pueden aprobar, rechazar, ocultar o mostrar y editar el texto (queda en la bitácora). Solo admin elimina para siempre.
  - El lector solo ve.
- **Personas (`/admin/personas`, admin y moderador):**
  - **Búsqueda** por índice ciego (correo o teléfono exactos, o los últimos 4 del folio). No muestra datos personales; correo y teléfono no van en la URL.
  - **Detalle:**
    - «Ver y rectificar datos personales» los descifra y queda registrado en la bitácora;
    - rectificar (un campo vacío lo borra) y perfil público;
    - emitir un folio nuevo (el anterior deja de funcionar; el nuevo se muestra una sola vez) y desactivar o reactivar el folio;
    - **solo admin:** cancelar datos personales (ARCO), con confirmación escribiendo «CANCELAR».
  - **Nueva persona:** también el facilitador puede crearla para emitirle un folio antes de capturar su ficha.
- **Configuración (`/admin/configuracion`, solo admin):** modo de publicación, participación (comentarios, reacciones, edición), seguridad (captcha, auditoría), límites de evidencias y versión del consentimiento. Envía solo lo que cambió y pide confirmación si se toca la publicación o el captcha. El back tarda hasta 15 s en aplicarlo.
  - **Modos de publicación:**
    - **Revisar todo** (el de fábrica): nada sale al mapa sin aprobación;
    - **Automática salvo sensibles:** se publica al instante si la persona autorizó y no marcó información sensible;
    - **Automática:** se publica al instante todo lo que tenga autorización pública.
  - En cualquier modo, «solo documentación interna», «no autorizo» y lo sensible con revisión o uso interno nunca se publican solos.
  - Al publicarse, el back avisa por Supabase Realtime y el mapa lo agrega sin recargar.
- **Usuarios (`/admin/usuarios`, solo admin):** crear cuentas con su rol. La contraseña temporal la genera el back, se muestra una sola vez y se pide cambiarla al entrar. También editar nombre, correo y rol, desactivar, restablecer contraseña y cerrar sesiones. Tu propia cuenta no se puede desactivar ni cambiar de rol, y el back exige que siempre quede un admin activo.
- **Catálogos (`/admin/catalogos`):** categorías y expedientes; todo el equipo los ve y solo admin los edita. El mapa usa los colores de marca por identificador (slug); una categoría nueva recibe uno automático. Al guardar se recargan las categorías del sitio público.
- **Bitácora (`/admin/bitacora`, solo admin):** quién hizo qué, con filtros por tipo de acción, usuario y fechas. «Ver cambios» muestra antes y después, IP y navegador. Desde un testimonio o una persona, «Historial» filtra sus eventos.
- **Exportar:** en Testimonios, «Exportar GeoJSON» (admin y moderador) descarga los testimonios de los filtros actuales con ubicación exacta y sin datos personales. El máximo es 10 000 y la exportación queda en la bitácora.
- **Mantenimiento:** en Configuración, «Purgar datos vencidos» borra la auditoría vencida y las sesiones y límites expirados.
- **Resumen:** incluye «Por entidad», con la ubicación exacta, solo para el equipo.
- **Gráficas:** SVG propias, sin dependencias. Los colores `--chart-1` y `--chart-2` en `style.css` están validados para daltonismo y contraste en ambos temas. Cada gráfica trae tooltip y una tabla oculta para lectores de pantalla.

### Subir testimonios

- **Dónde se abre:** `/testimonios/nuevo` es ruta hija del inicio (`HomePage` la pinta con `<RouterView>`).
  - **Escritorio:** el formulario ocupa la barra lateral, en el lugar de la lista, y el mapa sigue a la vista. La ubicación se marca **en el mapa grande**: mientras el paso está a la vista, el mapa entra en modo «marcar», con cursor en cruz y solo el pin elegido. El puente es `composables/useMainMapPicker.ts`.
  - **Móvil:** pantalla completa, con el mini-mapa dentro del formulario.
  - **Editar desde Mi folio:** sigue siendo página completa (`variant="page"`).
  - Los pasos usan *container queries* (`@xl:`, `@3xl:`) y no breakpoints de viewport, para quedar en una columna dentro de la barra.
- **Captcha:** `VITE_TURNSTILE_SITE_KEY` (site key pública de Cloudflare Turnstile). El widget solo funciona en los dominios dados de alta en Cloudflare (Turnstile → widget → Hostnames). Si `localhost` no está, el paso de Revisión avisa que no se puede enviar (error `110200`) y el borrador se conserva.
  - Para probar en local se puede usar la site key de prueba de Cloudflare (`1x00000000000000000000AA`, acepta cualquier dominio y siempre pasa) **solo si** el back usa el secreto de prueba `1x0000000000000000000000000000000AA`; si no, la API responde `CAPTCHA_INVALIDO`. Volver a la site key real antes de desplegar.
- **Folio de participante:** la API lo devuelve **una sola vez**, en el primer envío. Se muestra con botón de copiar y la persona decide si recordarlo en el dispositivo (`localStorage` `atlashacker:folio`, se manda en `X-Folio`). El folio, el correo y el teléfono no se guardan en el borrador.
- **Errores:** los de validación de la API (`DATOS_INVALIDOS`) se llevan al paso y campo del wizard (`utils/apiErrors.ts`).
- **Evidencias:** se suben después de crear el testimonio, desde la pantalla de éxito (`composables/useEvidenceUpload.ts`):
  1. reservar (`POST /api/mis-testimonios/{id}/evidencias` con `X-Folio`);
  2. `PUT` directo a R2 con la URL firmada;
  3. confirmar (el servidor verifica tamaño y tipo reales).
  - Los límites (archivos, MB en total y formatos) vienen de `/api/config`.
  - Fotos, video y audio se clasifican solos; los PDF tienen un selector de tipo.
  - El bucket de R2 necesita CORS para el origen del front (`npm run r2:cors -- <origen>` en el back); si falta, el `PUT` falla y el archivo queda con «Reintentar».

## Despliegue (Vercel)

- El proyecto de Vercel usa `frontend/` como *Root Directory*.
- El router usa history mode (URLs sin `#`), así que `vercel.json` reescribe a `index.html` toda ruta que no sea un archivo. Sin eso, abrir o recargar `/admin`, `/mi-folio` o `/testimonios/nuevo` da 404.

## Back en local

Para probar de punta a punta sin AWS ni tocar el back:

1. `npm run api:local` levanta la API en http://localhost:3000 con una base Postgres + PostGIS embebida (PGlite) guardada en `.local-db/`. Aplica las migraciones de `../backend/drizzle` y no lee `backend/.env`. Con `-- --reset` se empieza de cero.
2. Crear un admin (con la API detenida): `npm run api:local:admin -- --email tu@correo.org --nombre "Tu nombre"`. La contraseña temporal aparece en tu terminal.
3. `npm run dev:local` abre el front contra la API local (`.env.localapi`).

En local se omite el captcha. No funcionan la subida real de evidencias a R2 ni el tiempo real.

Ya existe una cuenta admin de prueba en la base local: sus credenciales están en `.local-db/dev-admin.json` (ignorado por git y bloqueado en el dev server).

## Tema

Los tokens viven en `src/style.css` (`@theme`) y se usan como utilidades de Tailwind. Para código que no lee CSS (capas de MapLibre) usar `BRAND` de `src/core/config/theme.ts`; mantener ambos alineados.

### Claro / oscuro

La app arranca en **oscuro** (identidad de marca). El botón sol/luna (`src/shared/components/ThemeToggle.vue`) cambia a claro y la elección se guarda (`useTheme` en `src/core/theme/`). Un script inline en `index.html` aplica el tema antes de pintar.

Para que los componentes respondan al tema, no usar `white`/`black` para fondo y texto, sino los tokens semánticos:

| Token | Oscuro | Claro | Uso |
| --- | --- | --- | --- |
| `surface` | negro | blanco | fondos (`bg-surface`) |
| `fg` | blanco | negro | texto y bordes, con opacidad (`text-fg/60`, `border-fg/15`) |
| `accent-ink` | lima | negro | texto de acento (asterisco de requerido, "Editar"…) |
| `danger` | naranja | negro | texto de error; el borde del campo sigue en naranja |

- En claro, los acentos (lima, verde, naranja, azul) se usan como **fondo o resalte**, no como texto sobre blanco.
- La variante `light:` permite ajustes puntuales, p. ej. `bg-neon-lime/10 light:bg-neon-lime/35`.
- `text-black` sobre fondos de acento (botones lima, badges) se mantiene en ambos temas.
- El mapa usa el estilo `dark` u OpenFreeMap `positron` según el tema (`MAP_STYLES` en `src/modules/map/config.ts`).
- El mapa base está **simplificado**: del estilo solo quedan el fondo, el agua, el contorno de cada estado y los nombres de los estados (en español si existe `name:es`). Todo lo demás (calles, edificios, ciudades, etc.) se oculta en `MapView` (`simplifyBaseStyle`). Las capas que se conservan, por tema, están en `BASE_LAYERS` (`src/modules/map/config.ts`).
- Con `detail="states+cities"` (lo usa el selector de ubicación del formulario), las ciudades y pueblos aparecen a partir de zoom 7 (`CITY_LABELS_MIN_ZOOM`).
- **Clic en un estado** (mapa principal, `selectable-states`): el mapa se acerca al estado, oscurece el resto y la lista muestra solo sus testimonios, con el chip «Estado ×» y `?estado=MX-JAL` en la URL. Se vuelve a todo México con el chip, con `Esc` o con un clic fuera del estado. Un clic sobre un pin sigue abriendo el testimonio.
  - Las líneas municipales salen de las teselas de OpenFreeMap (`boundary`, `admin_level = 6`), que **solo las traen desde zoom 9**. En estados grandes se ven al acercarse; en los pequeños (CDMX, Tlaxcala, Morelos…) se ven desde el encuadre.
  - Los polígonos de los 32 estados (para el clic, el resalte, el encuadre y el filtro) están en `src/modules/map/assets/mexico-states.json`. Vienen de Natural Earth 10m admin-1 (dominio público), simplificados. Se regeneran con `npm run map:states`.

### Tipografía

Parkinsans (`@fontsource-variable/parkinsans`, self-hosted), aplicada por defecto con `font-sans`.

- Cuerpo: Regular (400)
- Títulos (`h1`–`h6`): Semibold (600)

### Colores

| Uso | Token | Hex |
| --- | --- | --- |
| Primario | `white` | `#FFFFFF` |
| Primario | `black` | `#000000` |
| Acento | `neon-green` | `#0BE340` |
| Acento | `neon-lime` | `#E0FA49` |
| Acento | `brand-orange` | `#FF8636` |
| Acento | `brand-blue` | `#2E7DFC` |
| Acento | `brand-pink` | `#FD8CBB` |

Ejemplos: `bg-neon-green`, `text-brand-pink`, `border-neon-lime`.

- Blanco y negro son la estructura y los fondos.
- Los acentos se usan con moderación (~30%): resaltes, botones, etiquetas, stickers.
- El beige de la marca (`#FAF5E1`) **no** se usa en esta plataforma.

### Íconos (stickers de marca)

- Originales en `src/assets/icons/originals/*.png` (no entran al build); versiones web en `src/assets/icons/*.webp`.
- Para regenerar los `.webp` tras agregar o cambiar un original: `npm run icons:optimize` (usa `sharp`, máx. 192px).
- Se usan como portada de las historias (`src/modules/testimonies/data/covers.ts`): cada testimonio puede traer `cover`; si no, se elige uno fijo del grupo de su categoría.

### Logotipo

- Solo en blanco o negro; nunca a color.
- Blanco sobre fondos negros/oscuros y sobre fondos de color de acento.
- Negro sobre fondos blancos o claros.
- Tamaño mínimo digital: 200px.
