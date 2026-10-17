<script setup lang="ts">
import { LEGAL, LEGAL_ROUTES } from '@/core/legal/legal'
import LegalLayout from '@/modules/legal/components/LegalLayout.vue'

// Aviso de privacidad integral (Ley Federal de Protección de Datos Personales en Posesión de los Particulares).
// Sigue la estructura del aviso de la Escuela de Liderazgo Climático. No nombra proveedores ni tecnologías.
// El aviso simplificado está en el formulario (paso de consentimiento)
const SECTIONS = [
  { id: 'responsable', title: 'Quién es responsable' },
  { id: 'datos', title: 'Qué información recabamos' },
  { id: 'sensibles', title: 'Datos sensibles' },
  { id: 'finalidades', title: 'Para qué la usamos' },
  { id: 'otros-usos', title: 'Otros usos (puedes negarte)' },
  { id: 'publicacion', title: 'Qué se publica' },
  { id: 'compartir', title: 'Con quién la compartimos' },
  { id: 'arco', title: 'Tus derechos ARCO' },
  { id: 'revocar', title: 'Revocar tu consentimiento' },
  { id: 'cookies', title: 'Cookies y analítica' },
  { id: 'seguridad', title: 'Seguridad' },
  { id: 'conservacion', title: 'Conservación' },
  { id: 'menores', title: 'Niñas, niños y adolescentes' },
  { id: 'aceptacion', title: 'Aceptación' },
  { id: 'cambios', title: 'Cambios a este aviso' },
]
</script>

<template>
  <LegalLayout
    current="privacy"
    kicker="Aviso de privacidad integral"
    title="Aviso de privacidad"
    intro="Tu testimonio es tuyo. Aquí te explicamos qué información recabamos en el Atlas, para qué la usamos, con quién se comparte y cómo puedes acceder a ella, corregirla, borrarla u oponerte a su uso."
    :sections="SECTIONS"
  >
    <section id="responsable">
      <h2>1. Quién es responsable de tus datos</h2>
      <p>
        <strong>{{ LEGAL.responsable }}</strong> (en lo sucesivo, «HxNF») reconoce tu derecho a la protección de datos personales y es responsable del
        uso y protección de los datos que se recaban a través de {{ LEGAL.proyecto }} en <a :href="LEGAL.site">{{ LEGAL.host }}</a>, herramienta de documentación y participación para el Tribunal Popular por
        Nuestro Futuro.
      </p>
      <p>
        Para oír y recibir notificaciones, ejercer tus derechos y resolver dudas, el medio de contacto es el correo electrónico
        <a :href="`mailto:${LEGAL.email}`"><strong>{{ LEGAL.email }}</strong></a
        >.
      </p>
      <p>
        Este aviso se elabora para dar cumplimiento a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y demás
        normativa aplicable, y para que puedas hacer efectivo tu derecho a la protección de tus datos personales.
      </p>
    </section>

    <section id="datos">
      <h2>2. Qué información recabamos</h2>
      <p>Solo pedimos lo necesario. Casi todo es <strong>opcional</strong>: puedes participar de forma anónima.</p>
      <ul>
        <li><strong>Identificación (opcional):</strong> tu nombre o cómo quieres aparecer; puedes elegir «anónimo».</li>
        <li><strong>Contacto (opcional):</strong> correo electrónico y/o teléfono, solo para ayudarte a recuperar tu folio. Nunca se publican.</li>
        <li><strong>Folio de participante:</strong> una clave que te identifica sin revelar quién eres.</li>
        <li><strong>Ubicación del hecho:</strong> el lugar o zona que marcas en el mapa (puedes indicar que es aproximada), entidad y municipio.</li>
        <li><strong>Tu testimonio:</strong> título, relato, fecha, lugar, la pregunta al Tribunal y, en su caso, fuentes.</li>
        <li>
          <strong>Evidencias (opcional):</strong> fotografías, videos, audios y documentos, que pueden contener tu imagen o voz. Puedes activar
          «Proteger mi huella digital» para quitar a tus fotos datos como la ubicación o el modelo del teléfono antes de enviarlas.
        </li>
        <li><strong>Comentarios (opcional):</strong> el texto y el nombre que elijas mostrar.</li>
        <li><strong>Tus decisiones:</strong> tu consentimiento, lo que autorizas publicar y la fecha en que lo hiciste.</li>
        <li>
          <strong>Datos de navegación:</strong> información técnica que tu navegador comparte al usar el sitio (por ejemplo, dirección IP, tipo de
          dispositivo y navegador, idioma, fecha y hora), que usamos para la seguridad del sitio y para prevenir abusos.
        </li>
      </ul>
    </section>

    <section id="sensibles">
      <h2>3. Datos personales sensibles</h2>
      <p>
        Por la naturaleza de los testimonios, tu relato o tus evidencias pueden revelar datos sensibles, como estado de salud, origen étnico o
        pertenencia a un pueblo o comunidad, situación socioeconómica, opiniones políticas o datos de niñas, niños y adolescentes.
      </p>
      <p>
        Solo los tratamos con tu <strong>consentimiento expreso y por escrito</strong>, que otorgas al marcar la casilla de consentimiento antes de
        enviar tu testimonio. En el formulario puedes indicar si tu testimonio contiene información sensible y si prefieres que no se publique. Estos
        datos reciben medidas de protección reforzadas y nunca se publican sin tu autorización.
      </p>
    </section>

    <section id="finalidades">
      <h2>4. Para qué usamos tu información</h2>
      <p>Finalidades primarias y necesarias:</p>
      <ul>
        <li>Recibir y registrar tu testimonio y darte un folio para consultarlo, editarlo o retirarlo.</li>
        <li>Revisar los testimonios antes de publicarlos.</li>
        <li>Publicar en el mapa lo que autorices, con o sin tu nombre, según elijas.</li>
        <li>Documentar la evidencia y elaborar la relatoría del Tribunal Popular por Nuestro Futuro.</li>
        <li>Ayudarte a recuperar tu folio y dar respuesta a tus dudas o solicitudes.</li>
        <li>Mantener la seguridad del sitio y prevenir usos indebidos.</li>
        <li>Generar reportes estadísticos de carácter disociado (sin identificar a nadie).</li>
        <li>Dar cumplimiento a las obligaciones previstas en la normatividad aplicable.</li>
      </ul>
    </section>

    <section id="otros-usos">
      <h2>5. Otros usos (puedes negarte)</h2>
      <p>De manera adicional, si no te opones, podremos:</p>
      <ul>
        <li>Medir de forma agregada cómo se usa el sitio para mejorar tu experiencia, solo si aceptas las cookies de analítica.</li>
        <li>Difundir en los canales oficiales de HxNF testimonios ya publicados, siempre conforme a lo que autorizaste.</li>
        <li>Enviarte información sobre las actividades de HxNF, solo si nos dejaste un medio de contacto.</li>
      </ul>
      <p>
        Si no quieres que usemos tu información para estos fines, escríbenos a <a :href="`mailto:${LEGAL.email}`">{{ LEGAL.email }}</a> o rechaza
        la analítica en <RouterLink :to="{ name: LEGAL_ROUTES.cookies.name }">preferencias de cookies</RouterLink>. Negarte no afecta tu
        participación.
      </p>
    </section>

    <section id="publicacion">
      <h2>6. Qué se publica en el mapa</h2>
      <p>
        Solo lo que autorizas en el paso de consentimiento, y solo después de una revisión. Nunca publicamos tu correo, teléfono, folio ni datos de
        navegación. Si eliges una ubicación aproximada, el mapa muestra la zona y no el punto exacto. Las evidencias con datos personales de terceras
        personas (por ejemplo, recibos) no se publican de forma automática.
      </p>
      <p>Ten en cuenta que lo publicado es visible para cualquier persona y puede ser compartido por ella en otros sitios.</p>
    </section>

    <section id="compartir">
      <h2>7. Con quién compartimos tu información</h2>
      <p><strong>No vendemos ni rentamos tus datos.</strong> Para cumplir las finalidades descritas, podremos compartirlos únicamente:</p>
      <ul>
        <li>
          Con terceros proveedores de servicios que nos ayudan a operar el sitio, que tratan los datos por nuestra cuenta, dentro o fuera del
          territorio nacional, de conformidad con condiciones de confidencialidad y seguridad acordadas por contrato.
        </li>
        <li>Con autoridades competentes, en los casos legalmente previstos y para los cuales no es necesario tu consentimiento.</li>
        <li>Con otros terceros, solo cuando tú des tu consentimiento.</li>
      </ul>
    </section>

    <section id="arco">
      <h2>8. Tus derechos ARCO</h2>
      <p>
        Tienes derecho a conocer qué datos tenemos de ti y para qué los usamos (<strong>Acceso</strong>); a pedir que los corrijamos si son inexactos o
        están incompletos (<strong>Rectificación</strong>); a que los eliminemos (<strong>Cancelación</strong>), y a oponerte a su uso para fines
        específicos (<strong>Oposición</strong>).
      </p>
      <p>
        <strong>La forma más rápida:</strong> desde <RouterLink :to="{ name: 'my-folio' }">Mi folio</RouterLink> puedes consultar, editar y retirar
        tus testimonios.
      </p>
      <p>Para cualquier otra solicitud, escribe a <a :href="`mailto:${LEGAL.email}`">{{ LEGAL.email }}</a> con la siguiente información:</p>
      <ol>
        <li>
          <strong>Datos de quien solicita:</strong> nombre completo y correo donde te responderemos. Si participaste de forma anónima, basta con tu folio
          de participante: es lo que acredita que el testimonio es tuyo.
        </li>
        <li>
          <strong>Identificación:</strong> si solicitas con tu nombre, copia de una identificación oficial (INE, pasaporte, cédula profesional o documento
          migratorio). Si lo haces por medio de una persona representante, el documento que acredite la representación y su identificación.
        </li>
        <li><strong>Derecho que quieres ejercer</strong> y descripción clara de los datos sobre los que lo ejerces.</li>
        <li><strong>Documentos de apoyo</strong>, en su caso (para rectificar: el dato incorrecto, el correcto y, si aplica, el documento que lo acredite).</li>
      </ol>
      <p>
        Si la información es insuficiente, podremos pedirte más datos dentro de los <strong>5 días hábiles</strong> siguientes; tendrás
        <strong>10 días hábiles</strong> para responder o la solicitud se tendrá por no presentada. Te comunicaremos nuestra respuesta en un máximo de
        <strong>20 días hábiles</strong> y, si procede, la haremos efectiva dentro de los <strong>15 días hábiles</strong> siguientes. La respuesta se
        enviará al correo que indiques. El trámite es gratuito.
      </p>
    </section>

    <section id="revocar">
      <h2>9. Revocar tu consentimiento o limitar el uso</h2>
      <p>
        Puedes revocar el consentimiento que nos diste, o pedirnos limitar el uso o divulgación de tus datos, con el mismo procedimiento de la sección
        anterior. Ten en cuenta que no en todos los casos podremos atender tu solicitud de forma inmediata, ya que alguna obligación legal puede
        requerir que sigamos tratando ciertos datos. Los testimonios pueden retirarse hasta el cierre de la relatoría del Tribunal; después, siempre
        podrás pedir que se anonimicen.
      </p>
    </section>

    <section id="cookies">
      <h2>10. Cookies y analítica</h2>
      <p>
        Usamos cookies y tecnologías similares necesarias para que el sitio funcione y, solo si las aceptas, cookies de analítica para mejorar tu
        experiencia. Consulta el detalle y cambia tu elección en la <RouterLink :to="{ name: LEGAL_ROUTES.cookies.name }">política de cookies</RouterLink>.
      </p>
    </section>

    <section id="seguridad">
      <h2>11. Seguridad</h2>
      <p>
        Aplicamos medidas de seguridad administrativas, técnicas y físicas para proteger tus datos contra daño, pérdida, alteración, destrucción o uso,
        acceso o tratamiento no autorizado, entre ellas: conexiones cifradas, protección de la información de contacto, acceso restringido solo al
        personal autorizado y registro de las acciones realizadas sobre los testimonios. Seguimos como referencia buenas prácticas internacionales de
        seguridad de la información y privacidad.
      </p>
      <p>Si ocurriera una vulneración de seguridad que afecte de forma significativa tus derechos, te lo informaremos en cuanto la confirmemos.</p>
    </section>

    <section id="conservacion">
      <h2>12. Conservación</h2>
      <p>
        Conservamos tus testimonios y evidencias mientras dure el proceso del Tribunal Popular por Nuestro Futuro y la elaboración de su relatoría, o
        hasta que los retires. Los datos de navegación se conservan solo el tiempo necesario para la seguridad del sitio. Al terminar, los datos se
        bloquean y después se suprimen, salvo lo que la ley obligue a conservar.
      </p>
    </section>

    <section id="menores">
      <h2>13. Niñas, niños y adolescentes</h2>
      <p>
        El Atlas está dirigido a personas mayores de 18 años. Si eres menor de edad, participa con el acompañamiento y consentimiento de tu madre,
        padre o tutor. Si un testimonio menciona a niñas, niños o adolescentes, puedes indicarlo en el formulario: nunca publicamos datos que permitan
        identificarles.
      </p>
    </section>

    <section id="aceptacion">
      <h2>14. Aceptación</h2>
      <p>
        Al proporcionar tu información y marcar la casilla de consentimiento se entenderá que autorizas el uso de tus datos personales de conformidad
        con este aviso de privacidad.
      </p>
    </section>

    <section id="cambios">
      <h2>15. Cambios a este aviso</h2>
      <p>
        Este aviso puede modificarse por nuevos requerimientos legales, por nuestras propias necesidades o por cambios en nuestras prácticas de
        privacidad. Te notificaremos cualquier cambio en esta página, con su versión y fecha; si el cambio es importante, te lo avisaremos en el sitio y,
        cuando sea necesario, te pediremos de nuevo tu consentimiento.
      </p>
      <p>
        Si consideras que tu derecho a la protección de datos personales ha sido vulnerado, puedes acudir a la autoridad competente en la materia. Te
        pedimos que antes nos escribas: queremos resolverlo contigo.
      </p>
    </section>
  </LegalLayout>
</template>
