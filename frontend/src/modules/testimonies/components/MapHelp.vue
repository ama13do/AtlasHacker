<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

// «¿Cómo funciona este mapa?»: qué es cada cosa, para quien llega por primera vez
const emit = defineEmits<{ close: [] }>()

const ITEMS = [
  {
    title: 'Pines de colores',
    text: 'Cada pin es un testimonio en el lugar donde ocurre. El color y el ícono dicen su categoría: naranja (rayo) inseguridad energética, azul (nube) cambio climático, rosa (fábrica) megaproyectos.',
    icon: 'pin',
  },
  {
    title: 'Círculos con número',
    text: 'Agrupan testimonios cercanos. Tócalos (o acerca el mapa) para verlos uno por uno.',
    icon: 'group',
  },
  {
    title: 'Historias',
    text: 'Arriba del mapa: los testimonios con más reacciones, para leerlos rápido uno tras otro, como historias.',
    icon: 'story',
  },
  {
    title: 'Abrir un testimonio',
    text: 'Toca un pin o un elemento de la lista. Se abre su ficha completa, sus evidencias (fotos, videos, documentos) en el carrete de abajo y los comentarios.',
    icon: 'open',
  },
  {
    title: 'Reacciones',
    text: 'Me importa, Apoyo, Alerta (también pasa donde vivo) y Urgente. Puedes dar varias y quitarlas tocando otra vez; se cuenta una de cada tipo por dispositivo.',
    icon: 'react',
  },
  {
    title: 'Comentarios',
    text: 'Para acompañar, agregar contexto o contar si te pasa algo parecido. Pueden revisarse antes de publicarse.',
    icon: 'comment',
  },
  {
    title: 'Filtros y estados',
    text: 'Filtra por categoría o busca por título, lugar o folio. Toca un estado en el mapa para ver solo sus testimonios.',
    icon: 'filter',
  },
  {
    title: 'Mi folio',
    text: 'Al enviar un testimonio recibes un folio: es tu llave para subir más, editar o retirar los tuyos.',
    icon: 'folio',
  },
] as const

const closeButton = ref<HTMLButtonElement | null>(null)
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), emit('close'))
onMounted(async () => {
  window.addEventListener('keydown', onKey, true)
  await nextTick()
  closeButton.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[55] grid place-items-center bg-black/50 p-4" @click.self="emit('close')">
      <section class="card-brut-lg thin-scroll max-h-[88dvh] w-full max-w-2xl overflow-y-auto p-5 md:p-7" role="dialog" aria-modal="true" aria-labelledby="map-help-title">
        <div class="flex items-start justify-between gap-3">
          <h2 id="map-help-title" class="text-2xl font-black uppercase">
            <span class="hl-box hl-lime" style="--hl-rot: -1deg">¿Cómo funciona?</span>
          </h2>
          <button ref="closeButton" type="button" class="icon-btn" aria-label="Cerrar ayuda" @click="emit('close')">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <p class="mt-3 text-sm opacity-80">
          Este mapa reúne testimonios y evidencias para el Tribunal Popular por Nuestro Futuro. No es una declaración jurídica ni sustituye una
          denuncia formal: es una herramienta de documentación colectiva.
        </p>
        <ul class="mt-5 grid gap-3 sm:grid-cols-2">
          <li v-for="item in ITEMS" :key="item.title" class="flex gap-3 rounded-2xl border-2 border-ink/25 p-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-full border-2 border-black bg-neon-lime text-black" aria-hidden="true">
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path v-if="item.icon === 'pin'" d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
                <template v-else-if="item.icon === 'group'"><circle cx="12" cy="12" r="8" /><path d="M10 9.5 12 8v8" /></template>
                <template v-else-if="item.icon === 'story'"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></template>
                <path v-else-if="item.icon === 'open'" d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <path v-else-if="item.icon === 'react'" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
                <path v-else-if="item.icon === 'comment'" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path v-else-if="item.icon === 'filter'" d="M3 5h18l-7 8v6l-4 2v-8z" />
                <template v-else><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></template>
              </svg>
            </span>
            <span>
              <span class="block text-sm font-black uppercase">{{ item.title }}</span>
              <span class="mt-0.5 block text-xs leading-relaxed opacity-80">{{ item.text }}</span>
            </span>
          </li>
        </ul>
        <button type="button" class="btn-hxnf btn-ink mt-6 w-full" @click="emit('close')">Entendido, ver el mapa</button>
      </section>
    </div>
  </Teleport>
</template>
