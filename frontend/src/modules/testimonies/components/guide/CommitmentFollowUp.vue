<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AuthorityAnswer, CommitmentArrived, FindingState, FollowUp, FollowUpChanges } from '@testimonies/types/testimony'
import { ANSWER_LABELS, ARRIVED_LABELS, FINDING } from '@testimonies/utils/followUp'

// Seguimiento de un compromiso (Excel, Mi folio): ¿llegó a tu comunidad?, solicitud de información y respuesta
const props = defineProps<{ commitmentId: string; entry?: FollowUp; saving?: boolean }>()
const emit = defineEmits<{ save: [changes: FollowUpChanges] }>()

const ARRIVED = [
  { value: '', label: 'Sin responder' },
  ...Object.entries(ARRIVED_LABELS).map(([value, label]) => ({ value, label })),
]
const ANSWERS = Object.entries(ANSWER_LABELS).map(([value, label]) => ({ value, label }))

const state = computed<FindingState>(() => props.entry?.state ?? 'E1')
const folio = ref(props.entry?.requestFolio ?? '')
watch(
  () => props.entry?.requestFolio,
  (v) => (folio.value = v ?? ''),
)

const ids = computed(() => `fu-${props.commitmentId.replace(/[^A-Za-z0-9]/g, '')}`)

function saveFolio() {
  const value = folio.value.trim()
  if (value !== (props.entry?.requestFolio ?? '')) emit('save', { folio_solicitud: value || null })
}
</script>

<template>
  <div class="mt-2 space-y-2 rounded-2xl border-2 border-ink/20 p-3">
    <p class="flex flex-wrap items-center gap-2">
      <span class="on-light rounded-full border-2 border-black px-2 py-0.5 text-[11px] font-black text-black" :class="FINDING[state].class" role="status">
        {{ FINDING[state].label }}
      </span>
      <span v-if="entry?.confirmed" class="text-xs font-semibold">Confirmada por el equipo</span>
    </p>

    <label :for="`${ids}-arrived`" class="block text-sm font-semibold">¿Ha llegado a tu comunidad?</label>
    <select
      :id="`${ids}-arrived`"
      class="field-input w-full text-sm"
      :value="entry?.arrived ?? ''"
      :disabled="saving"
      @change="emit('save', { llego: (($event.target as HTMLSelectElement).value || null) as CommitmentArrived | null })"
    >
      <option v-for="o in ARRIVED" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>

    <details class="text-sm" :open="!!entry?.requestFolio || undefined">
      <summary class="cursor-pointer font-semibold">Registrar solicitud de información y respuesta</summary>
      <div class="mt-2 space-y-2">
        <label :for="`${ids}-folio`" class="block text-sm font-semibold">Folio de la solicitud</label>
        <input
          :id="`${ids}-folio`"
          v-model="folio"
          type="text"
          inputmode="numeric"
          maxlength="60"
          autocomplete="off"
          class="field-input w-full text-sm"
          :disabled="saving"
          @blur="saveFolio"
          @keydown.enter.prevent="saveFolio"
        />
        <label :for="`${ids}-answer`" class="block text-sm font-semibold">Respuesta de la autoridad</label>
        <select
          :id="`${ids}-answer`"
          class="field-input w-full text-sm"
          :value="entry?.answer ?? 'pendiente'"
          :disabled="saving"
          @change="emit('save', { respuesta: ($event.target as HTMLSelectElement).value as AuthorityAnswer })"
        >
          <option v-for="o in ANSWERS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <p v-if="!entry?.requestFolio && entry && entry.answer !== 'pendiente'" class="text-xs text-fg/70">
          Escribe el folio de la solicitud para que la respuesta cuente como evidencia (E3).
        </p>
      </div>
    </details>
  </div>
</template>
