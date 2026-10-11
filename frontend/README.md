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
        ├── components/    # StoriesBar, StoryViewer, TestimonyCard, TopicBadge…
        │   └── form/      # pasos del wizard y campos (FormField, ChoiceGroup, LocationPicker…)
        ├── composables/   # useTestimonyForm: estado, validación por paso y borrador
        ├── stores/  services/  types/  utils/
        └── data/          # mock (temporal) y metadatos de temas
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

### Logotipo

- Solo en blanco o negro; nunca a color.
- Blanco sobre fondos negros/oscuros y sobre fondos de color de acento.
- Negro sobre fondos blancos o claros.
- Tamaño mínimo digital: 200px.
