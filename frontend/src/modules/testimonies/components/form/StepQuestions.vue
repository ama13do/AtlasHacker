<script setup lang="ts">
import { computed, ref } from 'vue'
import { LIMITS, useTestimonyFormContext } from '@testimonies/composables/useTestimonyForm'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import { asksThreats, classifyFacts, COMPLAINT_LABELS, THREATS_LABELS, type Complaint, type Threats } from '@testimonies/data/facts'
import type { Visibility } from '@testimonies/types/testimony'
import { LEGAL, LEGAL_ROUTES } from '@/core/legal/legal'
import { maskFolio } from '@testimonies/utils/folio'
import ChoiceGroup, { type Choice } from '@testimonies/components/form/ChoiceGroup.vue'
import FormField from '@testimonies/components/form/FormField.vue'

const { draft, errors, protection, editing, staff } = useTestimonyFormContext()

const complaintOptions = (Object.keys(COMPLAINT_LABELS) as Complaint[]).map((value) => ({ value, label: COMPLAINT_LABELS[value] }))
const threatsOptions = (Object.keys(THREATS_LABELS) as Threats[]).map((value) => ({ value, label: THREATS_LABELS[value] }))

// Qué sigue según la respuesta (textos del prototipo, Reglamento de la LSE)
const complaintNote = computed(() => {
  if (draft.complaint === 'si_sin_respuesta')
    return 'Si tu queja fue ante CFE desde el 4 de octubre de 2025 y pasaron 10 días hábiles sin respuesta, lo que dijiste se presume cierto (Reglamento LSE, arts. 110 y 111). Si tienes el folio de la queja, cuéntalo en tu relato o súbelo como foto.'
  if (draft.complaint === 'no' && classifyFacts(draft.facts)?.subcategory.startsWith('IE.'))
    return 'Puedes presentar una queja ante CFE dentro del año siguiente al hecho; debe responderte en 10 días hábiles (Reglamento LSE, arts. 109 a 111).'
  return ''
})

// Anónimo por defecto; «con mi nombre» no se puede en modo protección
const visibilityOptions = computed<Choice<Visibility>[]>(() => [
  { value: 'anonimo', label: 'No, anónimo', description: 'Tu nombre no se mostrará' },
  {
    value: 'nombre',
    label: 'Sí, con mi nombre',
    description: protection.value ? 'No disponible en modo protección, para cuidarte' : undefined,
    disabled: protection.value,
  },
])

// Folio: el recordado en este dispositivo o uno que la persona pega
const { remembered, forget } = useParticipantFolio()
const typingFolio = ref(!!draft.folio)

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
    <div class="grid gap-8 @3xl:grid-cols-2 @3xl:gap-10">
      <section class="space-y-6">
        <div class="space-y-2">
          <ChoiceGroup
            v-model="draft.complaint"
            label="¿Ya reclamaste?"
            required
            hint="Una queja o solicitud ante CFE u otra autoridad."
            :options="complaintOptions"
            :columns="1"
            :error="errors.complaint"
            help="Una queja sin respuesta es de la evidencia más fuerte para el Tribunal."
          />
          <p v-if="complaintNote" class="rounded-xl bg-fg/5 px-4 py-3 text-sm text-fg/80" role="note">{{ complaintNote }}</p>
        </div>

        <ChoiceGroup
          v-if="asksThreats(draft.facts)"
          v-model="draft.threats"
          label="¿Te han amenazado o presionado por denunciar o defender tu territorio?"
          required
          :options="threatsOptions"
          :columns="3"
          :error="errors.threats"
          help="Si respondes «Sí» o «Prefiero no decir» se activa el modo protección para cuidarte."
        />
      </section>

      <section class="space-y-6">
        <div v-if="protection" class="on-light rounded-2xl border-l-8 border-black bg-neon-lime px-4 py-3 text-sm text-black" role="status">
          <span class="block text-xs font-black uppercase">Modo protección activado</span>
          <ul class="mt-1 list-disc space-y-0.5 pl-5">
            <li>Apareces como anónimo (obligatorio).</li>
            <li>En el mapa público solo se muestra una ubicación aproximada.</li>
            <li>Se publica solo después de una revisión de riesgo.</li>
          </ul>
        </div>

        <ChoiceGroup
          v-model="draft.visibility"
          label="¿Aparecer con tu nombre?"
          :options="visibilityOptions"
          :columns="2"
          help="Anónimo: tu nombre no aparece en ningún lado público. Con tu nombre, se muestra en el mapa junto a tu testimonio."
        />
        <FormField
          v-if="draft.visibility === 'nombre' && !protection"
          id="name"
          v-slot="field"
          label="Nombre con el que quieres aparecer"
          required
          :error="errors.name"
        >
          <input
            :id="field.id"
            v-model="draft.name"
            type="text"
            class="field-input"
            :maxlength="LIMITS.short"
            autocomplete="name"
            :aria-invalid="field.invalid"
            :aria-describedby="field.describedby"
          />
        </FormField>

        <!-- Captura desde el panel: quién llenó la ficha -->
        <FormField v-if="staff" id="facilitator" v-slot="field" label="Facilitador/a" optional>
          <input :id="field.id" v-model="draft.facilitator" type="text" class="field-input" :maxlength="LIMITS.short" :aria-describedby="field.describedby" />
        </FormField>
      </section>
    </div>

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
            <RouterLink :to="{ name: LEGAL_ROUTES.terms.name }" target="_blank" class="font-bold underline">términos y condiciones</RouterLink>. Este testimonio no es
            una queja formal ni una declaración jurídica. Puedes retirarlo desde «Mi folio».
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
        elijas, documentar la evidencia para el Tribunal Popular por Nuestro Futuro y ayudarte a recuperar tu folio. Tu correo y teléfono son
        opcionales y nunca se publican. Puedes ejercer tus derechos ARCO o revocar tu consentimiento en
        <a :href="`mailto:${LEGAL.email}`" class="font-bold underline">{{ LEGAL.email }}</a>. Consulta el
        <RouterLink :to="{ name: LEGAL_ROUTES.privacy.name }" target="_blank" class="font-bold underline">aviso de privacidad integral</RouterLink>.
      </p>
    </details>

    <!-- Al editar, el folio y el contacto se manejan en Mi folio; en el panel, la persona se elige allí -->
    <details v-if="!editing && !staff" class="rounded-2xl border-2 border-ink/25 px-4 py-3 text-sm" :open="!!(errors.folio || errors.email || errors.phone)">
      <summary class="cursor-pointer font-bold">Tu folio y contacto <span class="font-normal text-fg/60">(opcional)</span></summary>
      <div class="mt-3 space-y-4">
        <p class="text-xs text-fg/60">Con tu folio puedes subir más testimonios y editar los tuyos. Si no tienes uno, te daremos uno al enviar.</p>

        <div v-if="remembered && !typingFolio" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink bg-card px-4 py-3 shadow-brut">
          <span>
            Enviarás con tu folio <span class="font-semibold tabular-nums">{{ maskFolio(remembered) }}</span>
          </span>
          <span class="flex gap-4">
            <button type="button" class="font-semibold text-accent-ink hover:underline" @click="typingFolio = true">Usar otro</button>
            <button type="button" class="text-fg/60 hover:text-fg hover:underline" @click="forgetFolio">Olvidar en este dispositivo</button>
          </span>
        </div>
        <template v-else>
          <label class="flex w-fit cursor-pointer items-center gap-3 text-fg/80">
            <input type="checkbox" class="size-5 accent-neon-lime" :checked="typingFolio" @change="toggleTyping(($event.target as HTMLInputElement).checked)" />
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
        <p class="text-xs text-fg/50">El correo y el teléfono solo sirven para ayudarte a recuperar tu folio si lo pierdes. Se guardan cifrados y no se publican.</p>
      </div>
    </details>
  </div>
</template>
