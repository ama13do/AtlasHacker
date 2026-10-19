<script setup lang="ts">
import { openCookiePreferences, useConsent } from '@/core/consent/consent'
import { LEGAL_ROUTES } from '@/core/legal/legal'
import LegalLayout from '@/modules/legal/components/LegalLayout.vue'

// Política de cookies: por categoría y finalidad, sin nombres internos ni detalles técnicos del sitio
const { decided, analytics } = useConsent()

const SECTIONS = [
  { id: 'que-son', title: 'Qué son las cookies' },
  { id: 'tu-eleccion', title: 'Tu elección' },
  { id: 'necesarias', title: 'Necesarias' },
  { id: 'analitica', title: 'Analítica' },
  { id: 'gestionar', title: 'Cómo gestionarlas' },
]

const NECESSARY = [
  { what: 'Recordar tu elección sobre cookies.', time: 'Hasta que la cambies' },
  { what: 'Recordar tus preferencias, como el tema claro u oscuro.', time: 'Persistente' },
  { what: 'Guardar el borrador del formulario para que no lo pierdas.', time: 'Hasta enviar o borrar' },
  { what: 'Recordar tu folio en este dispositivo para no escribirlo cada vez.', time: 'Hasta que salgas de Mi folio' },
  { what: 'Contar una reacción por dispositivo, de forma anónima.', time: 'Persistente' },
  { what: 'Seguridad: proteger los formularios contra envíos automatizados y mantener las sesiones del equipo.', time: 'Sesión o días' },
]
</script>

<template>
  <LegalLayout
    current="cookies"
    kicker="Cookies y tecnologías similares"
    title="Política de cookies"
    intro="Qué guardamos en tu navegador, para qué y cómo puedes decidir. Las de analítica solo se activan si las aceptas."
    :sections="SECTIONS"
  >
    <section id="que-son">
      <h2>1. Qué son las cookies</h2>
      <p>
        Son pequeños datos que un sitio guarda en tu navegador para recordar información entre visitas. Además de cookies usamos el almacenamiento
        local del navegador, que funciona de forma parecida y aquí tratamos igual.
      </p>
    </section>

    <section id="tu-eleccion">
      <h2>2. Tu elección actual</h2>
      <div class="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink p-4">
        <span class="chip px-3 py-1 text-xs" :class="analytics ? 'bg-neon-green text-black' : 'bg-fg/10'">
          {{ !decided ? 'Aún no has elegido' : analytics ? 'Analítica aceptada' : 'Solo necesarias' }}
        </span>
        <button type="button" class="btn-hxnf btn-ink btn-sm" @click="openCookiePreferences">Cambiar preferencias</button>
      </div>
    </section>

    <section id="necesarias">
      <h2>3. Cookies necesarias</h2>
      <p>Permiten que el sitio funcione y sea seguro. No requieren tu consentimiento y no se usan para rastrearte ni para publicidad.</p>
      <div class="legal-table">
        <table>
          <thead>
            <tr><th>Para qué</th><th>Duración</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in NECESSARY" :key="c.what">
              <td data-label="Para qué">{{ c.what }}</td><td data-label="Duración">{{ c.time }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="analitica">
      <h2>4. Cookies de analítica (opcionales)</h2>
      <p>
        Si las aceptas, usamos un gestor de etiquetas y una herramienta de analítica web de terceros para saber, de forma agregada, cuántas personas
        nos visitan, qué páginas ven y qué botones usan (por ejemplo, «Subir testimonio» o «Compartir»). Así decidimos qué mejorar para tu
        experiencia. El gestor solo carga la analítica y por sí mismo no guarda cookies.
      </p>
      <ul>
        <li>Nunca enviamos tu nombre, correo, teléfono, folio ni el contenido de tu testimonio.</li>
        <li>No se usan para publicidad.</li>
        <li>Si no las aceptas, no se activan ni se carga ninguna herramienta de terceros.</li>
        <li>Si retiras tu consentimiento, las borramos de tu navegador.</li>
        <li>Duración: hasta 2 años, salvo que las borres antes.</li>
      </ul>
      <p>
        Más detalle en los <RouterLink :to="{ name: LEGAL_ROUTES.terms.name, hash: '#analitica' }">términos y condiciones</RouterLink> y en el
        <RouterLink :to="{ name: LEGAL_ROUTES.privacy.name }">aviso de privacidad</RouterLink>.
      </p>
    </section>

    <section id="gestionar">
      <h2>5. Cómo gestionarlas</h2>
      <p>
        Puedes cambiar tu elección cuando quieras con el botón de arriba o desde «Preferencias de cookies» en el pie de página. También puedes borrar o
        bloquear cookies desde la configuración de tu navegador; si bloqueas las necesarias, partes del sitio (como el borrador del formulario) pueden
        dejar de funcionar.
      </p>
    </section>
  </LegalLayout>
</template>
