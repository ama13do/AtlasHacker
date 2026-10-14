<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { settingsService } from '@admin/services/settings.service'
import { statsService } from '@admin/services/stats.service'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiResumen } from '@admin/types/api'
import SeriesCard from '@admin/components/SeriesCard.vue'
import { testimoniesService } from '@testimonies/services/testimonies.service'
import type { PublicStats } from '@testimonies/types/testimony'
import CategoryBars from '@admin/components/CategoryBars.vue'
import EntityBars from '@admin/components/EntityBars.vue'
import { systemService } from '@admin/services/system.service'
import type { ApiGeografia } from '@admin/types/api'
import KpiTile from '@admin/components/KpiTile.vue'

const ORIGIN_LABELS: Record<string, string> = { web: 'Sitio web', facilitador: 'Facilitación (papel)', importacion: 'Importación' }

const data = ref<ApiResumen | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const error = ref<string | null>(null)

const nf = new Intl.NumberFormat('es-MX')
const fmt = (n: number) => nf.format(n)
const mb = (bytes: number) => `${nf.format(Math.round((bytes / 1024 / 1024) * 10) / 10)} MB`

async function load() {
  status.value = 'loading'
  error.value = null
  try {
    data.value = await statsService.summary()
    status.value = 'ready'
  } catch (e) {
    console.error(e)
    const err = e as Partial<ApiError>
    error.value = err.status === 403 ? 'Tu rol no tiene acceso al resumen.' : 'No pudimos cargar el resumen.'
    status.value = 'error'
  }
}

const t = computed(() => data.value?.testimonios)

// Estado de la API (GET /health) y lo que ve el público (GET /api/estadisticas)
const health = ref<{ online: boolean; ms: number } | null>(null)
const publicStats = ref<PublicStats | null>(null)
async function loadExtras() {
  health.value = await statsService.health()
  try {
    publicStats.value = await testimoniesService.getStats()
  } catch {
    publicStats.value = null
  }
}
onMounted(loadExtras)

function refresh() {
  load()
  loadExtras()
}

// Distribución por entidad (ubicación exacta: solo personal)
const geo = ref<ApiGeografia | null>(null)
onMounted(async () => {
  try {
    geo.value = await systemService.geography()
  } catch {
    // Sin tarjeta
  }
})

// Admin: si todo pasa por revisión, se avisa junto a los pendientes (y cómo cambiarlo)
const auth = useAuthStore()
const reviewAll = ref(false)
onMounted(async () => {
  if (!auth.can('admin')) return
  try {
    reviewAll.value = (await settingsService.get()).modo_publicacion === 'revisar_todo'
  } catch {
    // Sin dato: no se muestra el aviso
  }
})
const empty = computed(() => status.value === 'ready' && !t.value?.total)

onMounted(load)
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-black uppercase"><span class="hl-box hl-green" style="--hl-rot: -1deg">Resumen</span></h1>
        <p class="mt-2 text-sm font-semibold opacity-65">Juicios por Nuestro Futuro · Tribunal Popular</p>
      </div>
      <p
        v-if="health"
        class="chip ml-auto px-3 py-1"
        :class="health.online ? 'bg-neon-green text-black' : 'bg-brand-orange text-black'"
        role="status"
        :title="`Respuesta de /health en ${health.ms} ms`"
      >
        <span class="size-2 rounded-full border border-black" :class="health.online ? 'animate-pulse bg-black' : 'bg-white'" aria-hidden="true" />
        API {{ health.online ? 'en línea' : 'sin respuesta' }} · {{ health.ms }} ms
      </p>
      <button
        v-if="status !== 'loading'"
        type="button"
        class="btn-hxnf btn-paper btn-sm"
        @click="refresh"
      >
        Actualizar
      </button>
    </div>

    <!-- Cargando -->
    <div v-if="status === 'loading'" class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
      <div v-for="n in 8" :key="n" class="h-28 animate-pulse rounded-2xl bg-fg/10" />
    </div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="border-2 border-ink bg-card shadow-brut space-y-3 rounded-[22px] p-6" role="alert">
      <p class="font-semibold">{{ error }}</p>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
    </div>

    <template v-else-if="data && t">
      <p v-if="empty" class="rounded-[20px] border-2 border-dashed border-ink/40 px-4 py-3 text-sm text-fg/70" role="status">
        Aún no hay testimonios en la base. Los conteos aparecerán en cuanto lleguen los primeros.
      </p>

      <p v-if="reviewAll && t.pendientes" class="flex flex-wrap items-center gap-2 rounded-[20px] border-2 border-ink bg-neon-lime/25 px-4 py-3 text-sm">
        Publicación: <span class="font-semibold">revisar todo</span>. Los testimonios nuevos no aparecen en el mapa hasta aprobarlos.
        <RouterLink :to="{ name: 'admin-settings' }" class="font-semibold text-accent-ink hover:underline">Cambiar</RouterLink>
        <RouterLink :to="{ name: 'admin-testimonies', query: { tab: 'pendientes' } }" class="font-semibold text-accent-ink hover:underline">
          Revisar pendientes
        </RouterLink>
      </p>

      <!-- KPIs -->
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores">
        <KpiTile
          :to="{ name: 'admin-testimonies', query: { tab: 'pendientes' } }"
          label="Por revisar"
          :value="fmt(t.pendientes)"
          detail="Pendientes de moderación"
          :alert="t.pendientes_antiguos ? `${fmt(t.pendientes_antiguos)} con más de 7 días` : undefined"
        />
        <KpiTile label="Publicados" :value="fmt(t.publicos)" :detail="`de ${fmt(t.total)} recibidos`" />
        <KpiTile label="Últimos 7 días" :value="fmt(t.ultimos_7_dias)" detail="Testimonios recibidos" />
        <KpiTile
          :to="{ name: 'admin-testimonies', query: { tab: 'todos', sensibles: 'true' } }"
          label="Sensibles"
          :value="fmt(t.sensibles)"
          detail="Con información que puede poner a alguien en riesgo"
        />
        <KpiTile
          :to="{ name: 'admin-comments', query: { tab: data.comentarios.pendientes ? 'pendientes' : 'publicados' } }"
          label="Comentarios"
          :value="fmt(data.comentarios.total)"
          :detail="`${fmt(data.comentarios.ocultos)} ocultos`"
          :alert="data.comentarios.pendientes ? `${fmt(data.comentarios.pendientes)} por revisar` : undefined"
        />
        <KpiTile
          label="Personas"
          :value="fmt(data.participantes.total)"
          :detail="`${fmt(data.participantes.con_perfil_publico)} con perfil público`"
        />
        <KpiTile label="Evidencias" :value="fmt(data.evidencias.total)" :detail="`${mb(data.evidencias.bytes)} · ${fmt(data.evidencias.publicas)} públicas`" />
        <KpiTile label="Reacciones" :value="fmt(t.reacciones)" :detail="`${fmt(t.rechazados)} rechazados · ${fmt(t.inactivos)} dados de baja`" />
      </section>

      <!-- Gráficas -->
      <div class="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section class="border-2 border-ink bg-card shadow-brut min-w-0 rounded-[22px] p-4 md:p-5">
          <SeriesCard :last30="data.ultimos_30_dias" :categories="data.por_categoria" />
        </section>
        <section class="border-2 border-ink bg-card shadow-brut min-w-0 rounded-[22px] p-4 md:p-5">
          <CategoryBars :rows="data.por_categoria" />
        </section>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section v-if="geo" class="border-2 border-ink bg-card shadow-brut min-w-0 rounded-[22px] p-4 md:p-5">
          <EntityBars :rows="geo.por_entidad" />
        </section>
        <section class="border-2 border-ink bg-card shadow-brut min-w-0 rounded-[22px] p-4 md:p-5">
          <h2 class="mb-3 text-sm font-black uppercase">Por origen</h2>
          <p v-if="!data.por_origen.length" class="text-sm text-fg/50">Sin datos.</p>
          <dl v-else class="divide-y divide-fg/10 text-sm">
            <div v-for="o in data.por_origen" :key="o.origen" class="flex justify-between gap-3 py-2">
              <dt class="text-fg/70">{{ ORIGIN_LABELS[o.origen] ?? o.origen }}</dt>
              <dd class="font-semibold tabular-nums">{{ fmt(o.total) }}</dd>
            </div>
          </dl>
        </section>
        <section v-if="publicStats" class="border-2 border-ink bg-card shadow-brut min-w-0 rounded-[22px] p-4 md:p-5">
          <h2 class="mb-3 text-sm font-black uppercase">En el mapa público</h2>
          <p class="font-wide text-3xl font-black tabular-nums">{{ fmt(publicStats.testimonies) }}</p>
          <p class="text-xs opacity-65">
            testimonios visibles<template v-if="publicStats.lastPublishedAt">
              · último {{ new Date(publicStats.lastPublishedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) }}</template
            >
          </p>
          <dl class="mt-3 divide-y divide-fg/10 text-sm">
            <div v-for="c in publicStats.byCategory" :key="c.slug" class="flex justify-between gap-3 py-1.5">
              <dt class="min-w-0 truncate text-fg/70">{{ c.label }}</dt>
              <dd class="font-semibold tabular-nums">{{ fmt(c.total) }}</dd>
            </div>
          </dl>
        </section>
        <section class="border-2 border-ink bg-card shadow-brut min-w-0 rounded-[22px] p-4 md:p-5">
          <h2 class="mb-3 text-sm font-black uppercase">Por expediente</h2>
          <dl class="divide-y divide-fg/10 text-sm">
            <div v-for="e in data.por_expediente" :key="e.id" class="flex justify-between gap-3 py-2">
              <dt class="min-w-0 truncate text-fg/70">{{ e.codigo }}<template v-if="e.materia"> · {{ e.materia }}</template></dt>
              <dd class="shrink-0 font-semibold tabular-nums">{{ fmt(e.total) }} <span class="font-normal text-fg/50">({{ fmt(e.publicos) }} públicos)</span></dd>
            </div>
          </dl>
        </section>
      </div>
    </template>
  </div>
</template>
