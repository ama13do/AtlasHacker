<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import type { Consent, MediaConsent, SensitiveHandling, VoiceImage } from '@testimonies/types/testimony'
import { LEGAL, LEGAL_ROUTES } from '@/core/legal/legal'
import { maskFolio } from '@testimonies/utils/folio'
import ChoiceGroup, { type Choice } from '@testimonies/components/form/ChoiceGroup.vue'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors, publishable, editing, staff } = useTestimonyFormContext()

// Fotos, video o audio adjuntos sin autorizar su uso: se guardan, pero no se publican
const mediaWithoutConsent = computed(
  () => draft.mediaConsent === 'no' && draft.files.some((a) => ['foto', 'video', 'audio'].includes(a.type)),
)

const consentOptions = computed<Choice<Consent>[]>(() => [
  {
    value: 'publico-nombre',
    label: 'Público con nombre',
    description: draft.visibility === 'anonimo' ? 'Elegiste aparecer como anónimo' : undefined,
    disabled: draft.visibility === 'anonimo',
  },
  { value: 'publico-anonimo', label: 'Público anónimo', description: 'Se publica sin tu nombre' },
  { value: 'interno', label: 'Solo documentación interna', description: 'Lo ve solo el equipo; no sale en el mapa' },
  { value: 'no-publicar', label: 'No autorizo su uso', description: 'Se guarda, pero no se usa ni se publica' },
])

// Manual C.4
const voiceOptions: Choice<VoiceImage>[] = [
  { value: 'voz_imagen', label: 'Voz e imagen' },
  { value: 'solo_voz', label: 'Solo voz' },
  { value: 'ninguna', label: 'Ninguna' },
]

// Manual C.10
const mediaOptions: Choice<MediaConsent>[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'na', label: 'No aplica', description: 'No hay personas en las fotos' },
]

const minorsOptions: Choice<boolean>[] = [
  { value: false, label: 'No' },
  { value: true, label: 'Sí', description: 'Se revisa antes de publicar' },
]

const sensitiveOptions: Choice<boolean>[] = [
  { value: false, label: 'No' },
  { value: true, label: 'Sí' },
]

const handlingOptions: Choice<SensitiveHandling>[] = [
  { value: 'anonimizar', label: 'Anonimizar' },
  { value: 'interno', label: 'Uso interno' },
  { value: 'revision', label: 'Revisión antes de publicar' },
]

watch(
  () => draft.sensitive,
  (sensitive) => {
    if (!sensitive) draft.sensitiveHandling = null
  },
)

// Folio: el recordado en este dispositivo o uno que la persona pega
const { remembered, forget } = useParticipantFolio()
const typingFolio = ref(!!draft.folio)

function useOtherFolio() {
  typingFolio.value = true
}

function forgetFolio() {
  forget()
  typingFolio.value = false
}

function toggleTyping(on: boolean) {
  typingFolio.value = on
  if (!on) draft.folio = ''
}
</script>

<template>
  <div class="space-y-8">
    <!-- Aviso clave del Manual (C.1) -->
    <p class="rounded-2xl border-l-8 border-black bg-neon-lime px-4 py-3 text-sm text-black" role="note">
      <span class="block text-xs font-black uppercase">Importante</span>
      Este formato no es una declaración jurídica oficial ni sustituye una denuncia formal. Es una herramienta de documentación y participación
      para el Tribunal Popular por Nuestro Futuro, impulsada por Hackers x Nuestro Futuro.
    </p>

    <div class="space-y-2">
      <label
        class="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition"
        :class="draft.voluntary ? 'border-neon-lime bg-neon-lime/10 light:border-fg light:bg-neon-lime/35' : errors.voluntary ? 'border-brand-orange' : 'border-fg/20'"
      >
        <input
          v-model="draft.voluntary"
          type="checkbox"
          class="mt-0.5 size-5 shrink-0 accent-neon-lime"
          :aria-invalid="!!errors.voluntary"
          :aria-describedby="errors.voluntary ? 'voluntary-error' : undefined"
        />
        <span>
          <span class="block font-bold">Participo de forma voluntaria y entiendo el uso de mi testimonio.</span>
          <span class="block text-xs opacity-75">
            Acepto el
            <RouterLink :to="{ name: LEGAL_ROUTES.privacy.name }" target="_blank" class="font-bold underline">aviso de privacidad</RouterLink>
            (incluido el tratamiento de datos sensibles que comparta) y los
            <RouterLink :to="{ name: LEGAL_ROUTES.terms.name }" target="_blank" class="font-bold underline">términos y condiciones</RouterLink>. Puedes no
            responder cualquier pregunta y retirar tu testimonio hasta el cierre de la relatoría (desde «Mi folio»).
          </span>
        </span>
      </label>
      <p v-if="errors.voluntary" id="voluntary-error" class="text-sm text-danger">{{ errors.voluntary }}</p>
    </div>

    <!-- Aviso de privacidad simplificado (LFPDPPP): en el momento en que se recaban los datos -->
    <details class="rounded-2xl border-2 border-ink/25 px-4 py-3 text-sm">
      <summary class="cursor-pointer font-bold">Aviso de privacidad simplificado</summary>
      <p class="mt-2 leading-relaxed opacity-80">
        {{ LEGAL.responsable }} trata tus datos para registrar tu testimonio y darte un folio, revisarlo, publicarlo en el mapa solo en la medida que
        autorices, documentar la evidencia para el Tribunal Popular por Nuestro Futuro y ayudarte a recuperar tu folio. Tu correo y teléfono son
        opcionales y nunca se publican. Puedes ejercer tus derechos ARCO o revocar tu consentimiento en
        <a :href="`mailto:${LEGAL.email}`" class="font-bold underline">{{ LEGAL.email }}</a>. Consulta el
        <RouterLink :to="{ name: LEGAL_ROUTES.privacy.name }" target="_blank" class="font-bold underline">aviso de privacidad integral</RouterLink>.
      </p>
    </details>

    <section class="space-y-4">
      <h3 class="form-group-title">Uso del testimonio</h3>
      <div class="grid gap-8 @3xl:grid-cols-[3fr_2fr]">
        <ChoiceGroup
          v-model="draft.consent"
          label="¿Autorizas que tu testimonio se use para los Juicios por Nuestro Futuro?"
          required
          :options="consentOptions"
          :error="errors.consent"
          help="Decide si tu testimonio aparece en el mapa público y si con tu nombre. «Solo documentación interna» y «No autorizo» nunca se publican."
        />
        <div class="space-y-6">
          <ChoiceGroup
            v-model="draft.voiceImage"
            label="¿Autorizas transmisión en vivo o grabación de tu voz o imagen?"
            required
            :options="voiceOptions"
            :columns="3"
            :error="errors.voiceImage"
            help="Por ejemplo, si el testimonio se lee o se presenta en una audiencia del Tribunal que se transmite o se graba."
          />
          <ChoiceGroup
            v-model="draft.mediaConsent"
            label="¿Las personas que aparecen en fotos o videos autorizaron el uso de su imagen?"
            required
            :options="mediaOptions"
            :columns="3"
            :error="errors.mediaConsent"
            help="Si no lo autorizaron, las fotos y videos se guardan solo para documentación interna."
          />
        </div>
      </div>
      <p v-if="mediaWithoutConsent" class="rounded-xl bg-fg/5 px-4 py-3 text-sm text-fg/80" role="note">
        Las personas fotografiadas no autorizaron su imagen: los archivos que adjuntaste se guardarán solo para documentación interna.
      </p>
    </section>

    <section class="space-y-4">
      <h3 class="form-group-title">Protección</h3>
      <div class="grid gap-8 @3xl:grid-cols-[2fr_3fr]">
        <ChoiceGroup
          v-model="draft.sensitive"
          label="¿Existe información que pueda poner a alguien en riesgo?"
          required
          help="Por ejemplo: nombres y contactos, domicilios o ubicaciones precisas, conflictos comunitarios, procesos legales, violencia o amenazas, o fotos que identifiquen a personas o lugares vulnerables. La seguridad de la persona está por encima de completar la ficha."
          :options="sensitiveOptions"
          :error="errors.sensitive"
        />
        <ChoiceGroup
          v-if="draft.sensitive"
          v-model="draft.sensitiveHandling"
          label="¿Qué hacemos con esa información?"
          required
          :options="handlingOptions"
          :columns="3"
          :error="errors.sensitiveHandling"
        />
      </div>
      <ChoiceGroup
        v-model="draft.minors"
        label="¿Hay información de niñas, niños o adolescentes?"
        required
        :options="minorsOptions"
        :columns="2"
        :error="errors.minors"
        help="No se recopila información que los identifique sin autorización de sus tutores y salvaguardas. Si marcas «Sí», el testimonio siempre se revisa antes de publicarse."
      />
    </section>

    <!-- Al editar, el folio y el contacto se manejan en Mi folio -->
    <section v-if="!editing" class="space-y-4">
      <!-- Captura en el panel: la persona se elige allí (folio existente o uno nuevo) -->
      <div v-if="!staff" class="space-y-1">
        <h3 class="form-group-title">Tu folio <span class="normal-case">(opcional)</span></h3>
        <p class="text-xs text-fg/50">
          Con tu folio puedes subir más testimonios y editar los tuyos. Si no tienes uno, te daremos uno al enviar.
        </p>
      </div>

      <!-- Folio recordado en este dispositivo -->
      <template v-if="staff" />
      <div
        v-else-if="remembered && !typingFolio"
        class="border-2 border-ink bg-card shadow-brut flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
      >
        <span>
          Enviarás con tu folio <span class="font-semibold tabular-nums">{{ maskFolio(remembered) }}</span>
        </span>
        <span class="flex gap-4">
          <button type="button" class="font-semibold text-accent-ink hover:underline" @click="useOtherFolio">Usar otro</button>
          <button type="button" class="text-fg/60 hover:text-fg hover:underline" @click="forgetFolio">
            Olvidar en este dispositivo
          </button>
        </span>
      </div>

      <template v-else>
        <label class="flex w-fit cursor-pointer items-center gap-3 text-sm text-fg/80">
          <input
            type="checkbox"
            class="size-5 accent-neon-lime"
            :checked="typingFolio"
            @change="toggleTyping(($event.target as HTMLInputElement).checked)"
          />
          Ya tengo folio
        </label>
        <FormField v-if="typingFolio" id="folio" v-slot="field" label="Folio" :error="errors.folio">
          <input
            :id="field.id"
            v-model="draft.folio"
            type="text"
            class="field-input font-mono uppercase @xl:max-w-sm"
            placeholder="P-XXXX-XXXX-XXXX-XXXX"
            autocomplete="off"
            spellcheck="false"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedby"
          />
        </FormField>
      </template>

      <div class="grid gap-5 @xl:grid-cols-2">
        <FormField id="email" v-slot="field" label="Correo" optional :error="errors.email">
          <input
            :id="field.id"
            v-model="draft.email"
            type="email"
            class="field-input"
            autocomplete="email"
            :maxlength="LIMITS.short"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedby"
          />
        </FormField>
        <FormField id="phone" v-slot="field" label="Teléfono" optional :error="errors.phone">
          <input
            :id="field.id"
            v-model="draft.phone"
            type="tel"
            class="field-input"
            autocomplete="tel"
            maxlength="25"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedby"
          />
        </FormField>
      </div>
      <p class="text-xs text-fg/50">
        El correo y el teléfono solo sirven para ayudarte a recuperar tu folio si lo pierdes. Se guardan cifrados y no se publican.
      </p>
    </section>

    <p
      v-if="draft.consent"
      class="rounded-2xl border-2 px-4 py-3 text-sm font-semibold"
      :class="publishable ? 'border-black bg-neon-green text-black' : 'border-dashed border-ink/60'"
    >
      {{
        publishable
          ? 'Tu testimonio se publicará en el mapa después de una revisión.'
          : 'Tu testimonio no se publicará en el mapa; quedará para documentación o revisión.'
      }}
    </p>
  </div>
</template>
