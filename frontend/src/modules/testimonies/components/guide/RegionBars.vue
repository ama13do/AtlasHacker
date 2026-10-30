<script setup lang="ts">
import { computed } from 'vue'
import { allRegionFigures, REGION_NAMES, regionFigures } from '@testimonies/utils/guide'

// «Tu región en datos»: dos gráficas de barras horizontales (SVG, sin librerías)
const props = defineProps<{ region: string }>()

const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 })
const nameOf = (r: string) => REGION_NAMES[r] ?? r

const mine = computed(() => regionFigures(props.region))

interface Row {
  label: string
  value: number
  fill: string // Clase de Tailwind
  strong?: boolean
}

// Renovables azul y fósiles naranja: se distinguen con daltonismo, en claro y en oscuro
const plan = computed<Row[]>(() =>
  mine.value
    ? [
        { label: 'Renovables', value: mine.value.renewables, fill: 'fill-chart-1' },
        { label: 'Fósiles', value: mine.value.fossils, fill: 'fill-[#d9480f] dark:fill-[#e8590c]' },
      ]
    : [],
)
// Solo se resalta tu región; las demás quedan en gris
const installed = computed<Row[]>(() =>
  allRegionFigures()
    .sort((a, b) => b.installed2024 - a.installed2024)
    .map((r) => ({
      label: nameOf(r.region),
      value: r.installed2024,
      fill: r.region === props.region ? 'fill-chart-1' : 'fill-fg/20',
      strong: r.region === props.region,
    })),
)

const charts = computed(() =>
  mine.value
    ? [
        {
          title: `Lo que el plan prevé agregar en tu región (${nameOf(props.region)}), 2025–2039${mine.value.shared ? ' · cifra de toda la región Baja California' : ''}`,
          rows: plan.value,
        },
        { title: 'Paneles en techos y similares instalados en 2024, por región', rows: installed.value },
      ]
    : [],
)

const ROW = 26
const LABEL_W = 128
const WIDTH = 340
const BAR_W = WIDTH - LABEL_W - 64

function width(rows: Row[], value: number) {
  return Math.max(2, (value / Math.max(...rows.map((r) => r.value), 1)) * BAR_W)
}
</script>

<template>
  <div v-if="mine" class="space-y-4">
    <figure v-for="chart in charts" :key="chart.title" class="space-y-1.5">
      <figcaption class="text-xs font-semibold text-fg/80">{{ chart.title }}</figcaption>
      <svg
        :viewBox="`0 0 ${WIDTH} ${chart.rows.length * ROW + 4}`"
        class="w-full max-w-md"
        role="img"
        :aria-label="`${chart.title}: ${chart.rows.map((r) => `${r.label} ${fmt(r.value)} MW`).join('; ')}`"
      >
        <g v-for="(row, i) in chart.rows" :key="row.label">
          <title>{{ row.label }}: {{ fmt(row.value) }} MW</title>
          <text :x="LABEL_W - 6" :y="i * ROW + 18" text-anchor="end" font-size="11" class="fill-fg" :font-weight="row.strong ? 800 : 400">
            {{ row.label }}
          </text>
          <rect :x="LABEL_W" :y="i * ROW + 5" :width="width(chart.rows, row.value)" :height="ROW - 10" rx="4" :class="row.fill" />
          <text
            :x="LABEL_W + width(chart.rows, row.value) + 5"
            :y="i * ROW + 18"
            font-size="11"
            class="fill-fg"
            :font-weight="row.strong ? 800 : 400"
          >
            {{ fmt(row.value) }} MW
          </text>
        </g>
      </svg>
    </figure>
    <p class="text-xs text-fg/60">
      Fuente: Anexo PLADESE (Fig. 2.10 y Tablas 4.1–4.8). Las barras de 2025–2039 son capacidad prevista, no generación.
    </p>
  </div>
</template>
