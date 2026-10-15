<script setup lang="ts">
import { computed } from 'vue'

// Rosa de los vientos: gira con el mapa, así la aguja verde siempre señala el sur geográfico.
// Tocarla vuelve a poner el sur arriba; el botón de abajo gira el mapa 90°
const props = defineProps<{ bearing: number }>()
const emit = defineEmits<{ southUp: []; rotate: [] }>()

const CARDINALS = [
  { label: 'N', angle: 0 },
  { label: 'E', angle: 90 },
  { label: 'S', angle: 180 },
  { label: 'O', angle: 270 },
] as const
const DIAGONALS = [45, 135, 225, 315]
// Distancia de las letras al centro (en unidades del viewBox de 100)
const LETTER_R = 37

// Las letras no giran con la rosa: se recolocan para leerse siempre derechas
const letters = computed(() =>
  CARDINALS.map((c) => {
    const t = ((c.angle - props.bearing) * Math.PI) / 180
    return { ...c, x: LETTER_R * Math.sin(t), y: -LETTER_R * Math.cos(t) }
  }),
)

const isSouthUp = computed(() => Math.abs((((props.bearing % 360) + 360) % 360) - 180) < 1)
</script>

<template>
  <div class="tm-compass">
    <button
      type="button"
      class="tm-compass-rose"
      :title="isSouthUp ? 'El sur está arriba' : 'Volver a poner el sur arriba'"
      :aria-label="isSouthUp ? 'Rosa de los vientos: el sur está arriba' : 'Volver a poner el sur arriba'"
      @click="emit('southUp')"
    >
      <svg viewBox="-50 -50 100 100" aria-hidden="true">
        <circle r="27" class="tm-compass-ring" />
        <g :transform="`rotate(${-bearing})`">
          <path v-for="a in DIAGONALS" :key="a" :transform="`rotate(${a})`" d="M0 -20 L4 -4 L0 0 L-4 -4Z" class="tm-compass-minor" />
          <g v-for="c in CARDINALS" :key="c.label" :transform="`rotate(${c.angle})`" :class="{ 'is-south': c.label === 'S' }">
            <path d="M0 -28 L0 0 L-6.5 -6.5Z" class="tm-compass-dark" />
            <path d="M0 -28 L6.5 -6.5 L0 0Z" class="tm-compass-light" />
          </g>
          <circle r="2.6" class="tm-compass-hub" />
        </g>
        <g v-for="l in letters" :key="l.label" :class="{ 'is-south': l.label === 'S' }">
          <circle v-if="l.label === 'S'" :cx="l.x" :cy="l.y" r="9.5" class="tm-compass-badge" />
          <text :x="l.x" :y="l.y" text-anchor="middle" dominant-baseline="central">{{ l.label }}</text>
        </g>
      </svg>
    </button>
    <button type="button" class="tm-compass-turn" title="Girar el mapa" aria-label="Girar el mapa 90 grados" @click="emit('rotate')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v5h-5" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.tm-compass {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.tm-compass-rose,
.tm-compass-turn {
  display: grid;
  place-items: center;
  padding: 0;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background-color: var(--card);
  color: var(--fg);
  box-shadow: 3px 3px 0 0 var(--shadow-c);
  cursor: pointer;
  transition:
    translate 0.15s,
    box-shadow 0.15s;
}

.tm-compass-rose:hover,
.tm-compass-turn:hover {
  translate: -1px -1px;
  box-shadow: 4px 4px 0 0 var(--shadow-c);
}

.tm-compass-rose:active,
.tm-compass-turn:active {
  translate: 2px 2px;
  box-shadow: 1px 1px 0 0 var(--shadow-c);
}

.tm-compass-rose:focus-visible,
.tm-compass-turn:focus-visible {
  outline: 3px solid var(--color-neon-lime);
  outline-offset: 2px;
}

.tm-compass-rose {
  width: 68px;
  height: 68px;
}

.tm-compass-rose svg {
  display: block;
  width: 100%;
  height: 100%;
}

.tm-compass-turn {
  width: 38px;
  height: 38px;
}

.tm-compass-turn:hover {
  background-color: var(--color-neon-lime);
  color: #000;
}

.tm-compass-turn svg {
  width: 18px;
  height: 18px;
}

.tm-compass-ring {
  fill: none;
  stroke: currentColor;
  stroke-opacity: 0.3;
  stroke-width: 1.2;
  stroke-dasharray: 2 3;
}

.tm-compass-minor {
  fill: currentColor;
  opacity: 0.4;
}

.tm-compass-dark,
.tm-compass-light {
  stroke: var(--ink);
  stroke-width: 1.3;
  stroke-linejoin: round;
}

.tm-compass-dark {
  fill: var(--ink);
}

.tm-compass-light {
  fill: var(--card);
}

/* La aguja del sur va en los verdes de la marca */
.is-south .tm-compass-dark {
  fill: var(--color-neon-green);
  stroke: #000;
}

.is-south .tm-compass-light {
  fill: var(--color-neon-lime);
  stroke: #000;
}

.tm-compass-hub {
  fill: var(--card);
  stroke: var(--ink);
  stroke-width: 1.3;
}

text {
  fill: currentColor;
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 900;
}

.tm-compass-badge {
  fill: var(--color-neon-green);
  stroke: #000;
  stroke-width: 1.5;
}

.is-south text {
  fill: #000;
}

@media (width < 48rem) {
  .tm-compass-rose {
    width: 60px;
    height: 60px;
  }
}
</style>
