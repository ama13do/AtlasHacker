<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { saveConsent, useConsent } from '@/core/consent/consent'
import { LEGAL_ROUTES } from '@/core/legal/legal'

// Aviso de cookies: aparece hasta que la persona elige y se vuelve a abrir desde «Preferencias de cookies».
// Aceptar y rechazar tienen el mismo peso visual (nada viene marcado por defecto)
const { decided, analytics, preferencesOpen } = useConsent()
const route = useRoute()

// El panel del equipo no usa analítica: ahí no se pregunta
const visible = computed(() => preferencesOpen.value || (!decided.value && !route.path.startsWith('/admin')))
const configuring = ref(false)
const analyticsOn = ref(analytics.value)

watch(preferencesOpen, (open) => {
  if (open) {
    configuring.value = true
    analyticsOn.value = analytics.value
  }
})

function close() {
  preferencesOpen.value = false
  configuring.value = false
}
</script>

<template>
  <Transition enter-from-class="translate-y-6 opacity-0" enter-active-class="transition duration-300" leave-to-class="translate-y-6 opacity-0" leave-active-class="transition duration-200">
    <section
      v-if="visible"
      class="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-xl rounded-[24px] border-2 border-ink bg-card p-5 shadow-brut-lg sm:inset-x-auto sm:right-5 sm:bottom-5 sm:left-5 md:left-auto md:mx-0 md:p-6"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookies-title"
      aria-describedby="cookies-text"
    >
      <div class="flex items-start gap-3">
        <span class="hidden size-11 shrink-0 place-items-center rounded-full border-2 border-black bg-neon-lime text-black sm:grid" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.5A9 9 0 1 1 11.5 3a3 3 0 0 0 3.5 3.5 3 3 0 0 0 3 3 3 3 0 0 0 3 3Z" />
            <circle cx="8.5" cy="10.5" r="1" fill="currentColor" /><circle cx="14" cy="15" r="1" fill="currentColor" /><circle cx="9" cy="16" r="1" fill="currentColor" />
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <h2 id="cookies-title" class="text-lg leading-tight font-black uppercase">¿Aceptas el uso de cookies?</h2>
          <p id="cookies-text" class="mt-1.5 text-[13px] leading-snug opacity-80 sm:text-sm sm:leading-relaxed">
            Usamos cookies necesarias para que el sitio funcione y, solo si nos dejas, cookies de analítica para mejorar tu experiencia. Nunca vendemos
            tus datos ni los usamos para publicidad.
            <RouterLink :to="{ name: LEGAL_ROUTES.cookies.name }" class="font-bold underline" @click="close">Política de cookies</RouterLink> ·
            <RouterLink :to="{ name: LEGAL_ROUTES.privacy.name }" class="font-bold underline" @click="close">Aviso de privacidad</RouterLink>
          </p>
        </div>
        <button v-if="decided" type="button" class="icon-btn size-9 shrink-0" aria-label="Cerrar" @click="close">
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <!-- Configurar: una opción por categoría -->
      <div v-if="configuring" class="mt-4 space-y-2.5">
        <div class="flex items-start gap-3 rounded-2xl border-2 border-ink/25 px-4 py-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-black uppercase">Necesarias</p>
            <p class="text-xs leading-relaxed opacity-75">Recuerdan tus preferencias, tu borrador y tu folio, y mantienen la seguridad del sitio. Sin ellas el sitio no funciona.</p>
          </div>
          <span class="chip shrink-0 bg-fg/10 px-2.5 py-1 text-[11px]">Siempre activas</span>
        </div>
        <label class="flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-4 py-3 transition" :class="analyticsOn ? 'border-ink bg-neon-lime/25' : 'border-ink/25'">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-black uppercase">Analítica</p>
            <p class="text-xs leading-relaxed opacity-75">Nos ayudan a entender, de forma agregada, cómo se usa el sitio para mejorar tu experiencia. Sin publicidad ni datos de tu testimonio.</p>
          </div>
          <input v-model="analyticsOn" type="checkbox" role="switch" class="peer sr-only" :aria-checked="analyticsOn" />
          <span
            class="relative mt-0.5 h-7 w-12 shrink-0 rounded-full border-2 border-black transition peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-blue"
            :class="analyticsOn ? 'bg-neon-green' : 'bg-fg/15'"
            aria-hidden="true"
          >
            <span class="absolute top-0.5 size-5 rounded-full border-2 border-black bg-white transition-all" :class="analyticsOn ? 'left-[22px]' : 'left-0.5'" />
          </span>
        </label>
        <div class="grid gap-2 pt-1 sm:grid-cols-2">
          <button type="button" class="btn-hxnf btn-ink w-full" @click="saveConsent(analyticsOn)">Guardar preferencias</button>
          <button type="button" class="btn-hxnf btn-lime w-full" @click="saveConsent(true)">Aceptar todas</button>
        </div>
      </div>

      <div v-else class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <button type="button" class="btn-hxnf btn-lime w-full px-3" @click="saveConsent(true)">Aceptar</button>
        <button type="button" class="btn-hxnf btn-paper w-full px-3 text-sm whitespace-nowrap sm:text-base" @click="saveConsent(false)">Solo necesarias</button>
        <button type="button" class="col-span-2 px-3 py-1 text-sm font-bold underline underline-offset-4 hover:text-accent-ink sm:col-span-1" @click="configuring = true">Configurar</button>
      </div>
    </section>
  </Transition>
</template>
