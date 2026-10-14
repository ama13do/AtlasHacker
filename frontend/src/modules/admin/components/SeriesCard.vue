<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { statsService } from '@admin/services/stats.service'
import type { ApiResumen } from '@admin/types/api'
import BarChart30d from '@admin/components/BarChart30d.vue'

// Evolución de testimonios: últimos 30 días (del resumen, sin otra petición) o, al cambiar el periodo
// o filtrar por categoría, la serie de GET /api/admin/estadisticas/serie
const props = defineProps<{ last30: ApiResumen['ultimos_30_dias']; categories: { slug: string; nombre: string }[] }>()

type Range = '30d' | '12s' | '12m'
const RANGES: { value: Range; label: string; unit: 'dia' | 'semana' | 'mes'; title: string }[] = [
  { value: '30d', label: '30 días', unit: 'dia', title: 'Últimos 30 días' },
  { value: '12s', label: '12 semanas', unit: 'semana', title: 'Últimas 12 semanas' },
  { value: '12m', label: '12 meses', unit: 'mes', title: 'Últimos 12 meses' },
]

const range = ref<Range>('30d')
const category = ref('')
const rows = ref<{ fecha: string; recibidos: number; aprobados: number }[] | null>(null)
const loading = ref(false)
const failed = ref(false)

const current = computed(() => RANGES.find((r) => r.value === range.value)!)
const iso = (d: Date) => d.toLocaleDateString('en-CA')

// Periodos consecutivos (la API solo devuelve los que tienen datos): se rellenan con ceros
function periods(unit: 'dia' | 'semana' | 'mes', count: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now)
    if (unit === 'dia') d.setDate(now.getDate() - i)
    else if (unit === 'semana') {
      // Postgres date_trunc('week') empieza en lunes
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      d.setTime(monday.getTime())
      d.setDate(monday.getDate() - i * 7)
    } else {
      d.setDate(1)
      d.setMonth(now.getMonth() - i)
    }
    out.push(iso(d))
  }
  return out
}

async function load() {
  if (range.value === '30d' && !category.value) {
    rows.value = null
    return
  }
  const unit = current.value.unit
  const keys = periods(unit, unit === 'dia' ? 30 : 12)
  loading.value = true
  failed.value = false
  try {
    const data = await statsService.series(keys[0], iso(new Date()), unit, category.value || undefined)
    const byPeriod = new Map(data.map((d) => [d.periodo, d]))
    rows.value = keys.map((k) => ({ fecha: k, recibidos: byPeriod.get(k)?.recibidos ?? 0, aprobados: byPeriod.get(k)?.aprobados ?? 0 }))
  } catch (e) {
    console.error(e)
    failed.value = true
  } finally {
    loading.value = false
  }
}

watch([range, category], load)

const days = computed(() => rows.value ?? props.last30)
const title = computed(() => {
  const name = props.categories.find((c) => c.slug === category.value)?.nombre
  return name ? `${current.value.title} · ${name}` : current.value.title
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex gap-1.5" role="group" aria-label="Periodo">
        <button v-for="r in RANGES" :key="r.value" type="button" class="chip-toggle" :aria-pressed="range === r.value" @click="range = r.value">
          {{ r.label }}
        </button>
      </div>
      <select v-model="category" class="field-input ml-auto w-auto py-1.5 text-sm" aria-label="Categoría">
        <option value="">Todas las categorías</option>
        <option v-for="c in categories" :key="c.slug" :value="c.slug">{{ c.nombre }}</option>
      </select>
    </div>
    <p v-if="failed" class="text-sm text-danger" role="alert">No se pudo cargar la serie.</p>
    <div :class="{ 'opacity-50 transition-opacity': loading }" :aria-busy="loading">
      <BarChart30d :days="days" :title="title" :unit="current.unit" />
    </div>
  </div>
</template>
