<script setup lang="ts">
import { computed, ref } from 'vue'

// Barras agrupadas por día: recibidos vs. aprobados (un solo eje). Colores validados (dataviz):
// --chart-1 recibidos, --chart-2 aprobados. Hover con tooltip y tabla accesible.
// `labels` y `subject` renombran las dos series (p. ej. escaneos y personas del enlace /ir)
const props = withDefaults(
  defineProps<{
    days: { fecha: string; recibidos: number; aprobados: number }[]
    title?: string
    unit?: 'dia' | 'semana' | 'mes'
    labels?: [string, string]
    subject?: string
  }>(),
  { title: 'Últimos 30 días', unit: 'dia', labels: () => ['Recibidos', 'Aprobados'], subject: 'Testimonios' },
)

const SERIES = computed(() => [
  { key: 'recibidos' as const, label: props.labels[0], color: 'var(--chart-1)' },
  { key: 'aprobados' as const, label: props.labels[1], color: 'var(--chart-2)' },
])

const WIDTH = 720
const HEIGHT = 200
const PAD = { top: 12, right: 8, bottom: 24, left: 28 }
const plotW = WIDTH - PAD.left - PAD.right
const plotH = HEIGHT - PAD.top - PAD.bottom
const GAP = 2 // separación entre barras del mismo día

// Escala "redonda" para que las marcas del eje sean enteros legibles
const max = computed(() => {
  const top = Math.max(1, ...props.days.flatMap((d) => [d.recibidos, d.aprobados]))
  const step = Math.max(1, Math.ceil(top / 4))
  return step * 4
})
const ticks = computed(() => [0, 1, 2, 3, 4].map((i) => (max.value / 4) * i))

const slot = computed(() => plotW / Math.max(1, props.days.length))
const barW = computed(() => Math.max(2, (slot.value * 0.7 - GAP) / 2))

const y = (v: number) => PAD.top + plotH - (v / max.value) * plotH
const x = (i: number) => PAD.left + i * slot.value + slot.value * 0.15

// Barra con esquinas superiores redondeadas (4px) y base recta en el eje
function barPath(x0: number, value: number, w: number) {
  if (value <= 0) return ''
  const top = y(value)
  const h = PAD.top + plotH - top
  const r = Math.min(4, w / 2, h)
  return `M${x0},${top + h}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + w - r}Q${x0 + w},${top} ${x0 + w},${top + r}V${top + h}Z`
}

const asDate = (iso: string) => new Date(`${iso}T00:00:00`)
const fmtShort = (iso: string) =>
  props.unit === 'mes'
    ? asDate(iso).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
    : asDate(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
const fmtLong = (iso: string) =>
  props.unit === 'mes'
    ? asDate(iso).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    : props.unit === 'semana'
      ? `Semana del ${asDate(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`
      : asDate(iso).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'long' })

const hover = ref<number | null>(null)
const hovered = computed(() => (hover.value !== null ? props.days[hover.value] : null))
const tooltipLeft = computed(() => (hover.value === null ? 0 : ((x(hover.value) + slot.value * 0.35) / WIDTH) * 100))
// Etiquetas del eje: unas 5 en total
const labelStep = computed(() => Math.max(1, Math.round(props.days.length / 5)))
const total = computed(() => props.days.reduce((s, d) => s + d.recibidos, 0))
</script>

<template>
  <figure class="space-y-3">
    <figcaption class="flex flex-wrap items-baseline justify-between gap-3">
      <span class="text-sm font-black uppercase">{{ title }}</span>
      <span class="flex items-center gap-4 text-xs text-fg/70" aria-hidden="true">
        <span v-for="s in SERIES" :key="s.key" class="inline-flex items-center gap-1.5">
          <span class="size-2.5 rounded-sm" :style="{ background: s.color }" />
          {{ s.label }}
        </span>
      </span>
    </figcaption>

    <!-- En pantallas angostas la gráfica conserva un ancho legible y se desplaza dentro de la tarjeta -->
    <div class="relative overflow-x-auto [scrollbar-width:thin]">
      <svg
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        class="h-auto w-full min-w-[540px] overflow-visible"
        role="img"
        :aria-label="`${subject}: ${labels[0].toLowerCase()} y ${labels[1].toLowerCase()} por día (${title.toLowerCase()}); ${total} ${labels[0].toLowerCase()} en total`"
        @mouseleave="hover = null"
      >
        <!-- Rejilla y eje (recesivos) -->
        <g class="text-fg" aria-hidden="true">
          <g v-for="t in ticks" :key="t">
            <line :x1="PAD.left" :x2="WIDTH - PAD.right" :y1="y(t)" :y2="y(t)" stroke="currentColor" stroke-opacity="0.1" />
            <text :x="PAD.left - 6" :y="y(t)" text-anchor="end" dominant-baseline="middle" class="fill-current text-[10px] opacity-50">
              {{ t }}
            </text>
          </g>
          <template v-for="(d, i) in days" :key="d.fecha">
            <text
              v-if="(i % labelStep === 0 && days.length - 1 - i >= labelStep / 2) || i === days.length - 1"
              :x="x(i) + slot * 0.35"
              :y="HEIGHT - 6"
              text-anchor="middle"
              class="fill-current text-[10px] opacity-50"
            >
              {{ fmtShort(d.fecha) }}
            </text>
          </template>
        </g>

        <!-- Barras -->
        <g v-for="(d, i) in days" :key="d.fecha" aria-hidden="true">
          <rect
            v-if="hover === i"
            :x="PAD.left + i * slot"
            :y="PAD.top"
            :width="slot"
            :height="plotH"
            class="fill-current text-fg"
            fill-opacity="0.06"
          />
          <path :d="barPath(x(i), d.recibidos, barW)" fill="var(--chart-1)" />
          <path :d="barPath(x(i) + barW + GAP, d.aprobados, barW)" fill="var(--chart-2)" />
          <!-- Zona de hover más grande que la marca -->
          <rect
            :x="PAD.left + i * slot"
            :y="PAD.top"
            :width="slot"
            :height="plotH + PAD.bottom"
            fill="transparent"
            @mouseenter="hover = i"
          />
        </g>
      </svg>

      <!-- Tooltip -->
      <div
        v-if="hovered"
        class="border-2 border-ink bg-card shadow-brut pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl px-3 py-2 text-xs shadow-lg"
        :style="{ left: `${Math.min(88, Math.max(12, tooltipLeft))}%` }"
      >
        <p class="mb-1 font-semibold">{{ fmtLong(hovered.fecha) }}</p>
        <p v-for="s in SERIES" :key="s.key" class="flex items-center gap-2">
          <span class="size-2.5 rounded-sm" :style="{ background: s.color }" />
          <span class="text-fg/70">{{ s.label }}</span>
          <span class="ml-auto pl-3 font-semibold tabular-nums">{{ hovered[s.key] }}</span>
        </p>
      </div>
    </div>

    <!-- Vista de tabla para lectores de pantalla -->
    <!-- Envuelta en un div: las tablas ignoran el ancho de 1px de sr-only -->
    <div class="sr-only">
      <table>
        <caption>{{ subject }} por día, {{ title.toLowerCase() }}</caption>
        <thead>
          <tr><th scope="col">Fecha</th><th scope="col">{{ labels[0] }}</th><th scope="col">{{ labels[1] }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="d in days" :key="d.fecha">
            <th scope="row">{{ fmtLong(d.fecha) }}</th>
            <td>{{ d.recibidos }}</td>
            <td>{{ d.aprobados }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>
