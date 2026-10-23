<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { track } from '@/core/analytics/analytics'
import { LOGOS, SOCIALS, type SocialId } from '@/core/config/brand'
import { googleCalendarUrl, MARCH_DETAILS, MARCH_EVENT } from '@/core/config/event'
import MapLogo from '@testimonies/components/MapLogo.vue'
import SocialIcon from '@/shared/components/SocialIcon.vue'

// Cierre del envío: confirma que el testimonio quedó guardado, invita a la marcha («Aparta la fecha») y a
// seguir las redes. Se muestra encima de la pantalla del folio, que queda detrás al cerrar
const props = defineProps<{ published: boolean; hasFolio: boolean }>()
const emit = defineEmits<{ close: [] }>()

const EVENT = MARCH_EVENT
const DETAILS = MARCH_DETAILS

// iPhone, iPad y Mac abren el .ics directo en Calendario; los demás van a Google Calendar
const apple = /iPhone|iPad|Macintosh/i.test(navigator.userAgent)
const calendarUrl = apple ? EVENT.ics : googleCalendarUrl()

// Confeti de la marca alrededor de la palomita: ángulo, distancia, color y forma de cada pieza
const COLORS = ['var(--color-neon-lime)', 'var(--color-neon-green)', 'var(--color-brand-pink)', 'var(--color-brand-orange)', 'var(--color-brand-blue)']
// Solo hacia arriba y a los lados (de 160° a 380°): hacia abajo taparía el título
const BURST = Array.from({ length: 16 }, (_, i) => {
  const angle = Math.PI * (0.9 + (i / 15) * 1.2) + (i % 2 ? 0.08 : -0.06)
  const distance = 50 + ((i * 37) % 5) * 7
  return {
    x: `${Math.round(Math.cos(angle) * distance * 1.15)}px`,
    y: `${Math.round(Math.sin(angle) * distance * 0.8)}px`,
    r: `${(i * 67) % 360}deg`,
    c: COLORS[i % COLORS.length],
    shape: i % 3 === 0 ? 'rounded-full size-2.5' : i % 3 === 1 ? 'h-1.5 w-3.5 rounded-[2px]' : 'size-2',
    d: `${(i % 4) * 30}ms`,
  }
})

function clicked(boton: string, extra: Record<string, string> = {}) {
  track('click_cta', { boton, ubicacion: 'exito_testimonio', ...extra })
}
const followed = (red: SocialId) => clicked('red_social', { red })

const closeButton = ref<HTMLButtonElement | null>(null)
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), emit('close'))
onMounted(async () => {
  window.addEventListener('keydown', onKey, true)
  await nextTick()
  closeButton.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport to="body">
    <div class="tm-fade-in fixed inset-0 z-[60] grid place-items-center bg-black/60 p-2 sm:p-4" @click.self="emit('close')">
      <!-- Todo cabe en una pantalla: en celular la tarjeta ocupa el alto disponible y «Continuar» queda siempre abajo -->
      <section
        class="card-brut-lg tm-pop-in relative flex h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden px-4 pt-4 pb-4 text-center sm:h-auto sm:max-h-[94dvh] sm:px-6 sm:pt-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        aria-describedby="celebration-text"
      >
        <button ref="closeButton" type="button" class="icon-btn absolute top-3 right-3 z-10" aria-label="Cerrar" @click="emit('close')">
          <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        <!-- Contenido repartido en el alto; solo en pantallas diminutas se desplaza (el botón sigue a la vista) -->
        <div class="thin-scroll flex min-h-0 flex-1 flex-col justify-evenly gap-3 overflow-x-hidden overflow-y-auto px-1 pb-2 short:gap-2 short:pb-1">
          <div>
            <!-- Palomita con confeti de la marca -->
            <div class="relative mx-auto mt-4 grid size-18 place-items-center short:mt-3 short:size-14 short:scale-80" aria-hidden="true">
              <i
                v-for="(p, i) in BURST"
                :key="i"
                class="tm-burst absolute top-1/2 left-1/2 border border-black/70"
                :class="p.shape"
                :style="{ '--x': p.x, '--y': p.y, '--r': p.r, '--d': p.d, background: p.c }"
              />
              <span class="tm-check-in grid size-16 place-items-center rounded-full border-[2.5px] border-black bg-neon-lime text-black shadow-[4px_4px_0_0_#000] short:size-12 dark:shadow-[4px_4px_0_0_#fff]">
                <svg viewBox="0 0 24 24" class="size-8 short:size-6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
                  <path class="tm-check-draw" d="m5 12.5 4.5 4.5L19 7.5" pathLength="1" />
                </svg>
              </span>
            </div>

            <h2 id="celebration-title" class="mt-4 text-[1.3rem] leading-[1.2] font-black text-balance uppercase short:mt-3 short:text-lg sm:text-2xl">
              Tu testimonio fue <span class="hl-box hl-lime whitespace-nowrap" style="--hl-rot: -1.5deg">enviado</span> y guardado con éxito
            </h2>
            <p id="celebration-text" class="mx-auto mt-2 max-w-xs text-[13px] leading-snug text-fg/75 short:mt-1">
              Gracias por alzar la voz.
              {{ props.published ? 'Ya está en el mapa del Tribunal Popular.' : 'El equipo lo revisará antes de mostrarlo en el mapa.' }}
            </p>
          </div>

          <!-- Boleto: aparta la fecha -->
          <article
            class="on-light tm-stagger relative mt-3 shrink-0 -rotate-1 rounded-[20px] border-[2.5px] border-black bg-neon-lime text-left shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]"
            style="--i: 4"
            aria-labelledby="event-title"
          >
            <span class="absolute -top-3 left-4 rotate-2 rounded-full border-2 border-black bg-black px-2.5 py-0.5 text-[10px] font-black tracking-[0.14em] text-neon-lime uppercase">
              Aparta la fecha
            </span>

            <div class="flex items-center gap-3 px-3.5 pt-5 pb-3 short:pt-4 short:pb-2.5">
              <!-- Fecha en bloque, como hoja de calendario -->
              <div class="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border-[2.5px] border-black bg-white">
                <span class="w-full bg-black text-center text-[10px] font-black tracking-[0.18em] text-neon-lime uppercase">{{ EVENT.weekday }}</span>
                <span class="text-[1.9rem] leading-none font-black tabular-nums">{{ EVENT.day }}</span>
                <span class="pb-1 text-xs font-black tracking-widest uppercase">{{ EVENT.month }}</span>
              </div>
              <div class="min-w-0">
                <h3 id="event-title" class="text-[15px] leading-tight font-black text-balance uppercase">{{ EVENT.headline }}</h3>
                <MapLogo :logo="LOGOS.juicios" tone="ink" alt="Juicios x Nuestro Futuro" class="mt-1.5 h-5 w-auto short:hidden" />
              </div>
            </div>

            <!-- Corte perforado del boleto -->
            <div class="relative mx-3.5 border-t-[2.5px] border-dashed border-black/70" aria-hidden="true">
              <span class="absolute -top-[11px] -left-[25px] size-5 rounded-full border-[2.5px] border-black bg-white [clip-path:inset(0_0_0_50%)] dark:bg-[#111]" />
              <span class="absolute -top-[11px] -right-[25px] size-5 rounded-full border-[2.5px] border-black bg-white [clip-path:inset(0_50%_0_0)] dark:bg-[#111]" />
            </div>

            <dl v-if="DETAILS" class="space-y-1.5 px-3.5 pt-3 text-[13px] leading-snug">
              <div class="flex gap-2">
                <dt class="sr-only">Fecha y hora</dt>
                <svg viewBox="0 0 24 24" class="mt-px size-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <dd><strong class="font-black">{{ EVENT.dateLabel }}</strong><span class="block">De {{ DETAILS.timeLabel }}</span></dd>
              </div>
              <div class="flex gap-2">
                <dt class="sr-only">Lugar</dt>
                <svg viewBox="0 0 24 24" class="mt-px size-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
                <dd>
                  <strong class="font-black">{{ DETAILS.place }}</strong>
                  <span class="block text-xs text-black/75">{{ DETAILS.placeDetail }}<span class="short:hidden">, {{ DETAILS.placeNote }}</span></span>
                </dd>
              </div>
            </dl>
            <!-- Mientras no se anuncian hora y lugar -->
            <div v-else class="flex gap-2 px-3.5 pt-3 text-[13px] leading-snug">
              <svg viewBox="0 0 24 24" class="mt-px size-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              <p><strong class="font-black">{{ EVENT.dateLabel }}</strong><span class="block">La hora y el lugar los anunciamos pronto en nuestras redes.</span></p>
            </div>

            <div class="grid gap-2.5 px-3.5 pt-3 pb-3 short:pt-2.5" :class="DETAILS ? 'grid-cols-2' : 'grid-cols-1'">
              <a
                :href="calendarUrl"
                target="_blank"
                rel="noopener"
                class="btn-hxnf btn-ink btn-sm px-2 whitespace-nowrap dark:border-black dark:bg-black dark:text-white"
                @click="clicked('agregar_calendario', { calendario: apple ? 'ics' : 'google' })"
              >
                <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5" /></svg>
                Agendar
              </a>
              <a v-if="DETAILS" :href="DETAILS.mapsUrl" target="_blank" rel="noopener" class="btn-hxnf btn-paper btn-sm px-2 whitespace-nowrap dark:border-black dark:[--btn-shadow:#000]" @click="clicked('como_llegar')">
                <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8z" /></svg>
                Cómo llegar
              </a>
            </div>
            <p v-if="!apple" class="-mt-1 px-3.5 pb-2.5 text-center text-[11px] text-black/70 short:hidden">
              ¿Otro calendario?
              <a :href="EVENT.ics" download class="font-bold underline underline-offset-2" @click="clicked('agregar_calendario', { calendario: 'ics' })">Descarga el evento</a>
            </p>
          </article>

          <!-- Redes -->
          <section class="tm-stagger" style="--i: 7" aria-labelledby="socials-title">
            <h3 id="socials-title" class="text-xs font-black tracking-wider uppercase">Síguenos y no te pierdas nada</h3>
            <ul class="mt-2.5 flex justify-center gap-4">
              <li v-for="s in SOCIALS" :key="s.id">
                <a
                  :href="s.url"
                  target="_blank"
                  rel="noopener"
                  class="group flex flex-col items-center gap-1 rounded-2xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                  :aria-label="`${s.label} de Hackers x Nuestro Futuro (${s.handle})`"
                  @click="followed(s.id)"
                >
                  <span
                    class="grid size-11 place-items-center rounded-full border-[2.5px] border-ink bg-card text-fg shadow-brut-sm transition-[translate,box-shadow,background-color,color] group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-neon-lime group-hover:text-black group-hover:shadow-brut group-active:translate-0 group-active:shadow-none"
                  >
                    <SocialIcon :id="s.id" class="size-5" />
                  </span>
                  <span class="text-[10px] font-bold short:sr-only">{{ s.label }}</span>
                </a>
              </li>
            </ul>
          </section>
        </div>

        <button type="button" class="btn-hxnf btn-lime tm-stagger mt-2 w-full shrink-0 px-4 whitespace-nowrap short:mt-1 max-[380px]:text-[15px]" style="--i: 9" @click="emit('close')">
          {{ props.hasFolio ? 'Continuar y guardar mi folio' : 'Continuar' }}
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </section>
    </div>
  </Teleport>
</template>
