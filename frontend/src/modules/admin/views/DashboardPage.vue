<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { statsService } from '@admin/services/stats.service'
import type { ApiResumen } from '@admin/types/api'
import BarChart30d from '@admin/components/BarChart30d.vue'
import CategoryBars from '@admin/components/CategoryBars.vue'
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
const empty = computed(() => status.value === 'ready' && !t.value?.total)

onMounted(load)
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Resumen</h1>
        <p class="text-sm text-fg/60">Expediente FUTURO/001 · Sistema Energético Nacional</p>
      </div>
      <button
        v-if="status !== 'loading'"
        type="button"
        class="rounded-full border border-fg/25 px-4 py-1.5 text-sm font-semibold hover:border-fg focus-visible:outline-2 focus-visible:outline-fg"
        @click="load"
      >
        Actualizar
      </button>
    </div>

    <!-- Cargando -->
    <div v-if="status === 'loading'" class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
      <div v-for="n in 8" :key="n" class="h-28 animate-pulse rounded-2xl bg-fg/10" />
    </div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="space-y-3 rounded-2xl border border-fg/15 p-6" role="alert">
      <p class="font-semibold">{{ error }}</p>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
    </div>

    <template v-else-if="data && t">
      <p v-if="empty" class="rounded-2xl border border-dashed border-fg/20 px-4 py-3 text-sm text-fg/70" role="status">
        Aún no hay testimonios en la base. Los conteos aparecerán en cuanto lleguen los primeros.
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
        <section class="min-w-0 rounded-2xl border border-fg/15 p-4 md:p-5">
          <BarChart30d :days="data.ultimos_30_dias" />
        </section>
        <section class="min-w-0 rounded-2xl border border-fg/15 p-4 md:p-5">
          <CategoryBars :rows="data.por_categoria" />
        </section>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <section class="min-w-0 rounded-2xl border border-fg/15 p-4 md:p-5">
          <h2 class="mb-3 text-sm font-semibold">Por origen</h2>
          <p v-if="!data.por_origen.length" class="text-sm text-fg/50">Sin datos.</p>
          <dl v-else class="divide-y divide-fg/10 text-sm">
            <div v-for="o in data.por_origen" :key="o.origen" class="flex justify-between gap-3 py-2">
              <dt class="text-fg/70">{{ ORIGIN_LABELS[o.origen] ?? o.origen }}</dt>
              <dd class="font-semibold tabular-nums">{{ fmt(o.total) }}</dd>
            </div>
          </dl>
        </section>
        <section class="min-w-0 rounded-2xl border border-fg/15 p-4 md:p-5">
          <h2 class="mb-3 text-sm font-semibold">Por expediente</h2>
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
