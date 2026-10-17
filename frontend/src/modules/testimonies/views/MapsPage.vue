<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MexicoPreview from '@map/components/MexicoPreview.vue'
import { COVERS } from '@testimonies/data/covers'
import { categoryStyle } from '@testimonies/data/categories'
import { ACCENT_CLASSES, DEFAULT_MAP_CODE, FALLBACK_DOSSIER, mapInfo, type MapInfo } from '@testimonies/data/maps'
import { testimoniesService } from '@testimonies/services/testimonies.service'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { useTestimoniesStore } from '@testimonies/stores/testimonies'
import { track } from '@/core/analytics/analytics'
import type { Collaborator, PublicStats } from '@testimonies/types/testimony'
import { STICKERS } from '@/core/config/brand'
import MapLogo from '@testimonies/components/MapLogo.vue'
import SiteFooter from '@/shared/components/SiteFooter.vue'
import SiteHeader from '@/shared/components/SiteHeader.vue'

// Portada: cuadrícula con los mapas. Hoy hay uno grande (FUTURO/001); cada expediente nuevo
// que se active en el dashboard aparece aquí como otra tarjeta.

const categoriesStore = useCategoriesStore()
const store = useTestimoniesStore()

const configFailed = ref(false)
const stats = ref<PublicStats | null>(null)
const collaborators = ref<Collaborator[]>([])

const maps = computed<MapInfo[]>(() => {
  const dossiers = categoriesStore.config?.dossiers.length ? categoriesStore.config.dossiers : [FALLBACK_DOSSIER]
  // El mapa principal va primero (tarjeta grande)
  const sorted = [...dossiers].sort((a, b) => Number(b.code === DEFAULT_MAP_CODE) - Number(a.code === DEFAULT_MAP_CODE))
  return sorted.map((d, i) => mapInfo(d, i))
})
const featured = computed(() => maps.value[0])
const others = computed(() => maps.value.slice(1))

// Vista previa del mapa principal: sus pines reales (y deja el mapa precargado al entrar)
const previewPoints = computed(() =>
  store.dossier === featured.value.code ? store.items.map((t) => ({ coordinates: t.coordinates, color: categoryStyle(t.category).color })) : [],
)

const nf = new Intl.NumberFormat('es-MX')
const lastPublished = computed(() => {
  const at = stats.value?.lastPublishedAt
  if (!at) return null
  return new Date(at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
})
const statesCount = computed(() => stats.value?.byState.length ?? 0)

const STEPS = [
  { n: '01', title: 'Marca el lugar', text: 'Busca tu comunidad o arrastra la chincheta hasta el punto exacto del territorio.', color: 'bg-neon-green' },
  { n: '02', title: 'Cuenta lo que pasa', text: 'El recibo dice, el territorio dice, la comunidad dice. Sube fotos o documentos si los tienes.', color: 'bg-brand-pink' },
  { n: '03', title: 'El Tribunal pregunta', text: 'Tu testimonio se revisa y se suma al mapa como evidencia colectiva. Tú decides si apareces con nombre.', color: 'bg-brand-orange' },
] as const

onMounted(async () => {
  categoriesStore.load().catch(() => (configFailed.value = true))
  testimoniesService.getStats().then((s) => (stats.value = s), console.error)
  testimoniesService.getCollaborators().then((c) => (collaborators.value = c), console.error)
  // Precarga los pines del mapa principal (la portada los muestra y al entrar ya están)
  if (store.dossier !== DEFAULT_MAP_CODE || store.status === 'idle') store.useDossier(DEFAULT_MAP_CODE)
})
</script>

<template>
  <div class="min-h-dvh overflow-x-clip">
    <SiteHeader />

    <main class="mx-auto max-w-7xl px-4 pt-6 pb-20 md:px-8 md:pt-8">
      <!-- Encabezado compacto: el protagonista es el mapa -->
      <section class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 class="text-2xl leading-tight font-black uppercase md:text-3xl">
          Mapas por <span class="hl-box hl-pink" style="--hl-rot: -1.5deg">Nuestro Futuro</span>
        </h1>
        <ul class="flex flex-wrap gap-2 text-xs font-bold" aria-label="En cifras">
          <li class="chip bg-neon-green px-3 py-1 text-black">
            <span class="font-wide text-sm">{{ stats ? nf.format(stats.testimonies) : '—' }}</span>
            {{ stats?.testimonies === 1 ? 'testimonio publicado' : 'testimonios publicados' }}
          </li>
          <li v-if="statesCount" class="chip bg-brand-blue px-3 py-1 text-white">
            <span class="font-wide text-sm">{{ statesCount }}</span> {{ statesCount === 1 ? 'estado' : 'estados' }}
          </li>
          <li v-if="lastPublished" class="chip bg-card px-3 py-1">Último: {{ lastPublished }}</li>
        </ul>
      </section>
      <p class="mt-2 max-w-3xl text-sm opacity-75">
        Lo que pasa en los territorios también es evidencia. Entra a un mapa para explorar testimonios de personas y comunidades, o para marcar el tuyo.
      </p>
      <p v-if="configFailed" class="mt-2 text-sm opacity-70" role="status">No pudimos cargar la lista de mapas; mostramos el principal.</p>

      <!-- Mapa principal y, a su derecha, cómo funciona (en celular, debajo) -->
      <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <article class="card-brut-lg overflow-hidden" aria-labelledby="featured-title">
          <div class="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div class="order-2 flex flex-col p-6 md:p-8 lg:order-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="chip bg-black text-white dark:bg-white dark:text-black">{{ featured.code }}</span>
                <span class="chip" :class="[ACCENT_CLASSES[featured.accent].bg, ACCENT_CLASSES[featured.accent].text]">{{ featured.kicker }}</span>
              </div>
              <!-- Con logo de campaña: en celular va dentro de la vista previa del mapa (se ve primero); en escritorio, aquí -->
              <h2 v-if="featured.logo" id="featured-title" class="lg:mt-5">
                <span class="sr-only lg:hidden">{{ featured.title }}</span>
                <MapLogo :logo="featured.logo" :alt="featured.title" class="hidden w-full max-w-[25rem] -rotate-1 lg:block" />
              </h2>
              <h2 v-else id="featured-title" class="mt-4 text-3xl leading-[1.15] font-black uppercase md:text-[2.6rem]">
                <span class="hl-box hl-wrap" :class="ACCENT_CLASSES[featured.accent].hl" style="--hl-rot: -1deg; --hl-delay: 0.3s">
                  {{ featured.title }}
                </span>
              </h2>
              <p v-if="featured.matter" class="mt-3 text-xs font-bold tracking-wide uppercase opacity-60">Materia: {{ featured.matter }}</p>
              <p class="mt-3 leading-relaxed opacity-85">{{ featured.description }}</p>

              <!-- Qué hay en el mapa -->
              <ul v-if="stats?.byCategory.length" class="mt-5 space-y-1.5 text-sm" aria-label="Testimonios por categoría">
                <li v-for="c in stats.byCategory" :key="c.slug" class="flex items-center gap-2">
                  <span class="size-3.5 shrink-0 rounded-full border-2 border-black" :style="{ backgroundColor: categoryStyle(c.slug).color }" aria-hidden="true" />
                  <span class="flex-1 font-semibold">{{ c.label }}</span>
                  <span class="font-wide font-black tabular-nums">{{ nf.format(c.total) }}</span>
                </li>
              </ul>

              <div class="mt-auto grid gap-3.5 pt-7">
                <RouterLink
                :to="{ name: 'map', params: { mapa: featured.slug } }"
                class="btn-hxnf btn-ink min-h-15 w-full text-lg md:text-xl"
                @click="track('click_cta', { boton: 'entrar_mapa', ubicacion: 'portada' })"
              >
                  Entrar al mapa
                  <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </RouterLink>
                <RouterLink
                :to="{ name: 'testimony-new', params: { mapa: featured.slug } }"
                class="btn-hxnf btn-lime min-h-15 w-full text-lg md:text-xl"
                @click="track('click_cta', { boton: 'subir_testimonio', ubicacion: 'portada' })"
              >
                  <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Subir testimonio
                </RouterLink>
              </div>
            </div>

            <!-- Vista previa del mapa (también entra al mapa) y, debajo, la nota «Importante» -->
            <div class="order-1 flex flex-col border-b-2 border-ink lg:order-2 lg:border-b-0 lg:border-l-2">
              <RouterLink
                :to="{ name: 'map', params: { mapa: featured.slug } }"
                class="group relative grid min-h-72 flex-1 place-items-center bg-[radial-gradient(circle,color-mix(in_oklab,var(--fg)_14%,transparent)_1.2px,transparent_1.6px)] bg-[length:14px_14px] p-6 md:p-10"
                :class="featured.logo ? 'pt-28 md:pt-36 lg:pt-10' : ''"
                tabindex="-1"
                aria-hidden="true"
                @click="track('click_cta', { boton: 'entrar_mapa', ubicacion: 'portada_mapa' })"
              >
                <div class="w-full transition-transform duration-500 group-hover:scale-[1.03] group-hover:-rotate-1">
                  <MexicoPreview :points="previewPoints" />
                </div>
                <MapLogo v-if="featured.logo" :logo="featured.logo" alt="" class="absolute top-5 left-5 w-44 -rotate-2 md:w-60 lg:hidden" />
                <img :src="COVERS[featured.sticker]" alt="" class="cutout pointer-events-none absolute top-5 right-5 w-20 animate-sticker-float md:w-28 motion-reduce:animate-none" />
                <span class="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border-2 border-black bg-white px-4 py-1.5 text-xs font-black whitespace-nowrap text-black uppercase sm:text-sm shadow-[3px_3px_0_0_#000] transition group-hover:bg-neon-lime">
                  {{ store.dossier === featured.code && store.status === 'ready' ? `${nf.format(store.items.length)} en el mapa · ` : '' }}Entrar →
                </span>
              </RouterLink>
              <p class="on-light border-t-2 border-ink bg-neon-lime px-5 py-3.5 text-sm leading-relaxed text-black md:px-6">
                <span class="font-black uppercase">Importante · </span>Estos mapas no son una declaración jurídica oficial ni sustituyen una denuncia formal. Son una
                herramienta de documentación y participación para el Tribunal Popular por Nuestro Futuro, impulsada por Hackers x Nuestro Futuro.
              </p>
            </div>
          </div>
        </article>

        <!-- Cómo funciona -->
        <section class="card-brut-lg flex flex-col p-6 md:p-8" aria-labelledby="how-title">
          <h2 id="how-title" class="text-2xl leading-[1.25] font-black uppercase md:text-3xl">
            Tu testimonio <span class="hl-box hl-orange" style="--hl-rot: 1deg">es evidencia</span>
          </h2>
          <ol class="mt-6 grid flex-1 gap-6 md:grid-cols-3 xl:grid-cols-1 xl:content-around">
            <li v-for="(s, i) in STEPS" :key="s.n" class="tm-stagger flex gap-4" :style="{ '--i': i }">
              <span class="font-wide inline-grid size-14 shrink-0 place-items-center rounded-full border-2 border-black text-lg font-black text-black shadow-brut-sm" :class="s.color">{{ s.n }}</span>
              <div>
                <h3 class="text-lg font-black uppercase">{{ s.title }}</h3>
                <p class="mt-1.5 leading-relaxed opacity-80">{{ s.text }}</p>
              </div>
            </li>
          </ol>
        </section>
      </div>

      <!-- Otros mapas (expedientes activos) -->
      <section v-if="others.length" class="mt-10" aria-labelledby="others-title">
        <h2 id="others-title" class="mb-5 text-xl font-black uppercase"><span class="hl-box hl-lime">Más mapas</span></h2>
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <article v-for="m in others" :key="m.code" class="card-brut card-lift group relative overflow-hidden">
            <RouterLink :to="{ name: 'map', params: { mapa: m.slug } }" class="flex h-full flex-col p-5 focus-visible:outline-none">
              <div class="flex items-center gap-2">
                <span class="chip bg-black text-white dark:bg-white dark:text-black">{{ m.code }}</span>
                <span class="chip" :class="[ACCENT_CLASSES[m.accent].bg, ACCENT_CLASSES[m.accent].text]">{{ m.kicker }}</span>
              </div>
              <h3 v-if="m.logo" class="mt-4"><MapLogo :logo="m.logo" :alt="m.title" class="w-full max-w-[15rem]" /></h3>
              <h3 v-else class="font-wide mt-4 text-2xl leading-tight font-black uppercase">{{ m.title }}</h3>
              <p class="mt-2 line-clamp-3 text-sm opacity-80">{{ m.description }}</p>
              <span class="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold uppercase">Entrar al mapa →</span>
            </RouterLink>
            <img :src="COVERS[m.sticker]" alt="" class="cutout pointer-events-none absolute -right-2 -bottom-3 w-20 rotate-6" />
          </article>
        </div>
      </section>

      <!-- Colaboradores (perfiles públicos) -->
      <section v-if="collaborators.length" class="mt-16" aria-labelledby="people-title">
        <h2 id="people-title" class="text-2xl font-black uppercase md:text-3xl">
          <span class="hl-box hl-green" style="--hl-rot: -1deg">Voces que firman</span>
        </h2>
        <p class="mt-3 max-w-2xl text-sm opacity-75">Personas que eligieron mostrar su nombre junto a sus testimonios.</p>
        <ul class="mt-6 flex flex-wrap gap-2.5">
          <li v-for="(c, i) in collaborators.slice(0, 60)" :key="c.id" class="chip bg-card px-3.5 py-1.5 text-sm" :class="i % 3 === 0 ? 'rotate-[-1deg]' : i % 3 === 1 ? 'rotate-1' : ''">
            {{ c.name }}
            <span v-if="c.published" class="rounded-full bg-neon-lime px-1.5 text-[11px] text-black" :aria-label="`${c.published} testimonios publicados`">{{ c.published }}</span>
          </li>
        </ul>
      </section>

      <!-- Proponer un mapa (al final) -->
      <section class="relative mt-16 flex flex-wrap items-center justify-between gap-5 rounded-[28px] border-2 border-dashed border-ink/60 p-6 md:p-8" aria-labelledby="propose-title">
        <img :src="STICKERS.futuro.lima" alt="" class="pointer-events-none absolute -top-7 right-5 w-28 rotate-6 animate-sticker-float select-none md:w-36 motion-reduce:animate-none" loading="lazy" aria-hidden="true" />
        <div class="max-w-2xl">
          <h2 id="propose-title" class="font-wide text-2xl font-black uppercase">¿Tu colectivo documenta otra causa?</h2>
          <p class="mt-2 text-sm opacity-75">
            Cada juicio o territorio puede tener su propio mapa. Escríbenos desde el sitio de Hackers x Nuestro Futuro y lo armamos juntxs.
          </p>
        </div>
        <a href="https://hxnf.mx/#contacto" target="_blank" rel="noopener" class="btn-hxnf btn-paper">Proponer un mapa ↗</a>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>
