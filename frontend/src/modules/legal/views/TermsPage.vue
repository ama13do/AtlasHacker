<script setup lang="ts">
import { LEGAL, LEGAL_ROUTES } from '@/core/legal/legal'
import LegalLayout from '@/modules/legal/components/LegalLayout.vue'

// Términos y condiciones, con base en los de la Escuela de Liderazgo Climático (mismas organizaciones).
// Es el único documento que nombra las herramientas de analítica (sus condiciones piden informarlo)
const [nf, pr] = LEGAL.respaldo

const SECTIONS = [
  { id: 'aceptacion', title: 'Aceptación' },
  { id: 'organizaciones', title: 'Quiénes lo impulsan' },
  { id: 'que-es', title: 'Qué es el Atlas' },
  { id: 'quien', title: 'Quién puede participar' },
  { id: 'reglas', title: 'Reglas de participación' },
  { id: 'moderacion', title: 'Revisión y moderación' },
  { id: 'contenido', title: 'Tu contenido y su uso' },
  { id: 'folio', title: 'Tu folio' },
  { id: 'comentarios', title: 'Comentarios y reacciones' },
  { id: 'propiedad', title: 'Propiedad intelectual' },
  { id: 'politico', title: 'Prohibición de uso político-electoral' },
  { id: 'uso', title: 'Uso técnico aceptable' },
  { id: 'analitica', title: 'Cookies y analítica' },
  { id: 'responsabilidad', title: 'Limitación de responsabilidad' },
  { id: 'cambios', title: 'Cambios e interpretación' },
]
</script>

<template>
  <LegalLayout
    current="terms"
    kicker="Condiciones de uso"
    title="Términos y condiciones"
    intro="Las reglas para usar el Atlas y compartir testimonios de forma segura y respetuosa. Léelas antes de participar."
    :sections="SECTIONS"
  >
    <section id="aceptacion">
      <h2>1. Aceptación</h2>
      <p>
        Estos términos regulan el uso de {{ LEGAL.proyecto }} (<a :href="LEGAL.site">{{ LEGAL.host }}</a>). Al navegar, enviar un testimonio, comentar
        o reaccionar, aceptas sujetarte a estos términos en su totalidad y al
        <RouterLink :to="{ name: LEGAL_ROUTES.privacy.name }">aviso de privacidad</RouterLink>. Cualquier pregunta o comentario, escríbenos a
        <a :href="`mailto:${LEGAL.email}`">{{ LEGAL.email }}</a>.
      </p>
    </section>

    <section id="organizaciones">
      <h2>2. Quiénes lo impulsan</h2>
      <p>
        El Atlas es impulsado y operado por la <strong>Coalición {{ LEGAL.marca }}</strong> («HxNF»), respaldada por {{ nf!.name }}
        ({{ nf!.short }}) y {{ pr!.name }} (con nombre comercial {{ pr!.short }}), en adelante «el equipo organizador».
      </p>
      <p>
        {{ LEGAL.responsable }} es la responsable del tratamiento de los datos personales que se recaban en el sitio, conforme al
        <RouterLink :to="{ name: LEGAL_ROUTES.privacy.name }">aviso de privacidad</RouterLink>.
      </p>
    </section>

    <section id="que-es">
      <h2>3. Qué es el Atlas (y qué no es)</h2>
      <p>
        Es una herramienta de documentación y participación para el Tribunal Popular por Nuestro Futuro: reúne testimonios de personas y comunidades
        sobre cómo les afecta el sistema energético y la crisis climática, y los ubica en el territorio.
      </p>
      <p>
        <strong>No es</strong> una declaración jurídica oficial, no sustituye una denuncia formal ante autoridades y no constituye asesoría legal. Si
        estás en riesgo o necesitas actuar legalmente, acude a las instancias correspondientes.
      </p>
    </section>

    <section id="quien">
      <h2>4. Quién puede participar</h2>
      <p>
        Cualquier persona mayor de 18 años. Las personas menores de edad pueden participar con el acompañamiento y consentimiento de su madre, padre o
        tutor. La participación es voluntaria y gratuita. Si necesitas algún ajuste de accesibilidad para participar, escríbenos con el asunto
        «SOLICITUD DE AJUSTES RAZONABLES».
      </p>
    </section>

    <section id="reglas">
      <h2>5. Reglas de participación</h2>
      <p>Al compartir un testimonio, comentario o evidencia te comprometes a:</p>
      <ul>
        <li>Contar hechos que viviste o conoces de primera mano, de buena fe y lo más apegado a la realidad posible.</li>
        <li>No incluir datos personales de otras personas (nombres, teléfonos, domicilios, rostros) sin su permiso.</li>
        <li>No difamar, amenazar, acosar ni discriminar a nadie por su color de piel, religión, género, origen, edad, discapacidad u orientación sexual.</li>
        <li>No publicar contenido ofensivo o denigrante, que incite al odio, a la violencia o al racismo, ni contenido sexual o ilegal.</li>
        <li>No presentar como propio el trabajo de otras personas ni infringir derechos de propiedad intelectual de terceros.</li>
        <li>No suplantar a otras personas u organizaciones, ni manipular o falsificar información.</li>
        <li>No usar el Atlas para publicidad, spam ni envíos automatizados.</li>
      </ul>
      <p>Cada persona es responsable del contenido que comparte.</p>
    </section>

    <section id="moderacion">
      <h2>6. Revisión y moderación</h2>
      <p>
        Todo testimonio se revisa antes de aparecer en el mapa. El equipo organizador puede no publicar, ocultar o retirar contenido que incumpla estos
        términos, que ponga en riesgo a alguien o que contenga datos sensibles que no deban ser públicos, así como proteger datos de terceras personas
        antes de publicar. La revisión no implica que el equipo organizador valide o certifique los hechos narrados.
      </p>
    </section>

    <section id="contenido">
      <h2>7. Tu contenido y su uso</h2>
      <p>
        <strong>Tu testimonio sigue siendo tuyo:</strong> conservas los derechos morales sobre él. Al enviarlo autorizas al equipo organizador, de forma
        gratuita y no exclusiva, a guardarlo, revisarlo y, solo en la medida que autorices en el paso de consentimiento, publicarlo en el mapa,
        incluirlo en la relatoría del Tribunal Popular por Nuestro Futuro y difundir los testimonios ya publicados en sus canales oficiales.
      </p>
      <p>
        Si autorizas el uso de tu voz o imagen en tus evidencias, lo haces para estos mismos fines. Puedes editar o retirar tu testimonio desde
        <RouterLink :to="{ name: 'my-folio' }">Mi folio</RouterLink> hasta el cierre de la relatoría; al retirarlo dejamos de mostrarlo, pero no podemos
        controlar copias que terceras personas hayan hecho de lo que ya era público.
      </p>
    </section>

    <section id="folio">
      <h2>8. Tu folio de participante</h2>
      <p>
        Al enviar tu primer testimonio recibes un folio: es la llave para consultar, editar o retirar tus testimonios. Guárdalo en un lugar seguro y no
        lo compartas. Por seguridad, el equipo organizador no puede verlo; solo podemos ayudarte a recuperarlo si dejaste un correo o teléfono,
        escribiendo a <a :href="`mailto:${LEGAL.email}`">{{ LEGAL.email }}</a>.
      </p>
    </section>

    <section id="comentarios">
      <h2>9. Comentarios y reacciones</h2>
      <p>Los comentarios se rigen por las mismas reglas de participación y pueden moderarse. Las reacciones son anónimas.</p>
    </section>

    <section id="propiedad">
      <h2>10. Propiedad intelectual</h2>
      <p>
        Los nombres, logotipos e imagen de Hackers x Nuestro Futuro y Juicios x Nuestro Futuro, así como las
        ilustraciones, stickers y el diseño del sitio, pertenecen a sus titulares. Puedes compartir los enlaces y las imágenes para compartir que genera
        el sitio; para cualquier otro uso, escríbenos.
      </p>
    </section>

    <section id="politico">
      <h2>11. Prohibición de uso con fines políticos y/o electorales</h2>
      <p>
        Queda prohibido usar el nombre, logotipos o imagen del Atlas, de Hackers x Nuestro Futuro o de Juicios x Nuestro Futuro, así como los testimonios y materiales del sitio, con fines partidistas, ya sea para autopromoción o para promover a un grupo
        político, partido o candidatura.
      </p>
    </section>

    <section id="uso">
      <h2>12. Uso técnico aceptable</h2>
      <p>
        No intentes vulnerar la seguridad del sitio, acceder a información de otras personas, saturar el servicio ni extraer información de forma
        masiva o automatizada. Si encuentras una falla de seguridad, repórtala de forma responsable y confidencial a
        <a :href="`mailto:${LEGAL.email}`">{{ LEGAL.email }}</a>.
      </p>
    </section>

    <section id="analitica">
      <h2>13. Cookies y analítica</h2>
      <p>
        El sitio usa cookies necesarias para funcionar y, solo con tu consentimiento, <strong>Google Tag Manager</strong> y
        <strong>Google Analytics</strong> para conocer de forma agregada cómo se usa y mejorar tu experiencia. Tag Manager es el gestor que carga la
        analítica: no se activa hasta que la aceptas y por sí mismo no guarda cookies. Con estas herramientas no se comparten tu nombre, correo,
        teléfono, folio ni el contenido de tu testimonio, y sus funciones publicitarias están desactivadas. Google trata esa información conforme a sus
        propias políticas. Puedes aceptar o rechazar la
        analítica, y cambiar tu elección en cualquier momento, en la <RouterLink :to="{ name: LEGAL_ROUTES.cookies.name }">política de cookies</RouterLink>.
      </p>
    </section>

    <section id="responsabilidad">
      <h2>14. Limitación de responsabilidad</h2>
      <p>
        Los testimonios expresan la experiencia de quienes los comparten, no necesariamente la postura del equipo organizador. El equipo organizador,
        y sus integrantes se deslindan de cualquier responsabilidad derivada del contenido publicado por terceras
        personas o de actos u omisiones de quienes usan el sitio. Hacemos lo posible para que el sitio esté disponible y funcione bien, pero puede tener
        interrupciones o errores. Los enlaces a otros sitios se rigen por sus propias condiciones.
      </p>
    </section>

    <section id="cambios">
      <h2>15. Cambios, interpretación y ley aplicable</h2>
      <p>
        Estos términos pueden actualizarse; la versión vigente y su fecha siempre estarán en esta página y seguir usando el sitio implica aceptarla. Su
        interpretación corresponde al equipo organizador, y se rigen por las leyes de los Estados Unidos Mexicanos. Antes de cualquier otra vía, te
        invitamos a escribirnos para resolver cualquier diferencia de forma directa.
      </p>
      <p class="text-right text-sm opacity-70">{{ LEGAL.ciudad }}, {{ LEGAL.updatedAt }} · v{{ LEGAL.version }}</p>
    </section>
  </LegalLayout>
</template>
