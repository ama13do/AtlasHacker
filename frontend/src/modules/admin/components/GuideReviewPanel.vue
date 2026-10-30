<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref, watch } from 'vue'
import type { ApiError } from '@/core/http/client'
import { adminTestimoniesService } from '@admin/services/testimonies.service'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiRevisionTestimonio, ApiTestimonioStaff } from '@admin/types/api'
import { classifyFacts, SUBCATEGORY_LABELS } from '@testimonies/data/facts'
import { GOVERNMENT_LABELS, PUBLIC_PRECISION_LABELS, REVIEW_RIGHTS } from '@testimonies/data/review'
import { fromFollowUp } from '@testimonies/services/mappers'
import { ANSWER_LABELS, ARRIVED_LABELS, FINDING } from '@testimonies/utils/followUp'
import { needsRiskReview, RISK_REVIEW_NOTICE, type GuideInput } from '@testimonies/utils/guideInput'
import { fmtDate } from '@admin/data/labels'
import commitments from '@testimonies/data/guide/commitments.json'

// Ajustes del revisor (Excel, panel de revisión) y seguimiento de compromisos: moderación y administración
const props = defineProps<{ testimony: ApiTestimonioStaff }>()
const emit = defineEmits<{ updated: [t: ApiTestimonioStaff, message: string] }>()

const TestimonyGuide = defineAsyncComponent(() => import('@testimonies/components/guide/TestimonyGuide.vue'))

const auth = useAuthStore()
const canReview = computed(() => auth.perms.approve)

const t = computed(() => props.testimony)
const auto = computed(() => classifyFacts(t.value.hechos ?? [])?.subcategory ?? t.value.subcategoria)
const SUBCATEGORIES = Object.entries(SUBCATEGORY_LABELS)
const COMMITMENTS = Object.entries(commitments as Record<string, { fragmento: string; responsable: string }>)

type Form = Required<{ [K in keyof ApiRevisionTestimonio]: NonNullable<ApiRevisionTestimonio[K]> | '' }>
const fromTestimony = (v: ApiTestimonioStaff): Form => ({
  revision_subcategoria: v.revision_subcategoria ?? '',
  revision_derecho: v.revision_derecho ?? '',
  revision_gobierno: v.revision_gobierno ?? '',
  revision_compromiso: v.revision_compromiso ?? '',
  aviso_hxnf: v.aviso_hxnf,
  aviso_cifras: v.aviso_cifras,
})
const form = reactive<Form>(fromTestimony(t.value))
watch(t, (v) => Object.assign(form, fromTestimony(v)))

// Solo lo que cambió; '' = vuelve a lo automático (null)
const changes = computed<ApiRevisionTestimonio>(() => {
  const before = fromTestimony(t.value)
  return Object.fromEntries(
    (Object.keys(form) as (keyof Form)[]).filter((k) => form[k] !== before[k]).map((k) => [k, form[k] === '' ? null : form[k]]),
  ) as ApiRevisionTestimonio
})

const saving = ref(false)
const error = ref<string | null>(null)
async function save() {
  saving.value = true
  error.value = null
  try {
    emit('updated', await adminTestimoniesService.review(t.value.id, changes.value), 'Ajustes de revisión guardados.')
  } catch (e) {
    error.value = (e as Partial<ApiError>).message ?? 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}

const riskReview = computed(() => needsRiskReview({ facts: t.value.hechos ?? [], threats: t.value.amenazas }, t.value.revision_subcategoria))

// Vista previa de la guía tal como la ve la persona (con los ajustes ya guardados)
const showGuide = ref(false)
const guideInput = computed<GuideInput>(() => ({
  facts: t.value.hechos ?? [],
  state: t.value.entidad ?? '',
  municipality: t.value.municipio ?? '',
  place: t.value.lugar_territorio ?? '',
  since: t.value.desde_cuando,
  ongoing: t.value.sigue_pasando,
  title: t.value.titulo ?? '',
  testimony: t.value.relato,
  tribunalQuestion: t.value.pregunta_tribunal ?? '',
  complaint: t.value.reclamo_previo,
  threats: t.value.amenazas,
  visibility: t.value.aparecer_como === 'nombre' ? 'nombre' : 'anonimo',
}))
const review = computed(() => ({
  subcategory: t.value.revision_subcategoria,
  right: t.value.revision_derecho,
  government: t.value.revision_gobierno,
  commitment: t.value.revision_compromiso,
  hxnf: t.value.aviso_hxnf,
  figures: t.value.aviso_cifras,
}))

// Seguimiento: la persona responde en su guía; aquí se confirma la omisión documentada (E3)
const followUps = computed(() => (t.value.seguimiento ?? []).map(fromFollowUp))
const confirming = ref<string | null>(null)
async function confirm(commitmentId: string, confirmed: boolean) {
  confirming.value = commitmentId
  error.value = null
  try {
    const seguimiento = await adminTestimoniesService.confirmOmission(t.value.id, commitmentId, confirmed)
    emit('updated', { ...t.value, seguimiento }, confirmed ? 'Omisión confirmada.' : 'Confirmación retirada.')
  } catch (e) {
    error.value = (e as Partial<ApiError>).message ?? 'No se pudo guardar.'
  } finally {
    confirming.value = null
  }
}

const LABEL = 'block text-xs font-semibold text-fg/60'
</script>

<template>
  <section class="space-y-4 rounded-[22px] border-2 border-ink bg-card p-5 shadow-brut" aria-labelledby="review-title">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 id="review-title" class="text-sm font-semibold">Revisión de la guía</h2>
      <span v-if="riskReview" class="rounded-full bg-brand-orange px-2.5 py-0.5 text-xs font-semibold text-black">Revisión de riesgo · 7 a 14 días</span>
    </div>
    <p v-if="riskReview" class="text-xs text-fg/70">{{ RISK_REVIEW_NOTICE }} Al aprobarlo se publica de inmediato.</p>
    <p class="text-sm text-fg/70">
      En el mapa público:
      <span class="font-semibold">{{
        t.precision_publica ? PUBLIC_PRECISION_LABELS[t.precision_publica] : t.ubicacion_aproximada ? 'cuadrícula de ~1 km' : 'ubicación exacta'
      }}</span>
    </p>

    <fieldset class="grid gap-3 sm:grid-cols-2" :disabled="!canReview || saving">
      <legend class="sr-only">Ajustes del revisor</legend>
      <label class="space-y-1 sm:col-span-2">
        <span :class="LABEL">Subcategoría</span>
        <select v-model="form.revision_subcategoria" class="field-input w-full text-sm">
          <option value="">Automática{{ auto ? ` · ${SUBCATEGORY_LABELS[auto] ?? auto}` : '' }}</option>
          <option v-for="[key, label] in SUBCATEGORIES" :key="key" :value="key">{{ key }} · {{ label }}</option>
        </select>
      </label>
      <label class="space-y-1">
        <span :class="LABEL">Derecho adicional</span>
        <select v-model="form.revision_derecho" class="field-input w-full text-sm">
          <option value="">Ninguno</option>
          <option v-for="r in REVIEW_RIGHTS" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>
      <label class="space-y-1">
        <span :class="LABEL">También debe responder</span>
        <select v-model="form.revision_gobierno" class="field-input w-full text-sm">
          <option value="">No</option>
          <option v-for="(label, key) in GOVERNMENT_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
      <label class="space-y-1 sm:col-span-2">
        <span :class="LABEL">Compromiso destacado</span>
        <select v-model="form.revision_compromiso" class="field-input w-full text-sm">
          <option value="">Automático</option>
          <option v-for="[id, c] in COMMITMENTS" :key="id" :value="id">{{ id }} · {{ c.responsable }}</option>
        </select>
      </label>
      <label class="flex cursor-pointer items-start gap-2 text-sm sm:col-span-2">
        <input v-model="form.aviso_hxnf" type="checkbox" class="mt-0.5 size-4 accent-neon-lime" />
        <span>Aviso: Hackers x Nuestro Futuro participa en una solución de este caso</span>
      </label>
      <label class="flex cursor-pointer items-start gap-2 text-sm sm:col-span-2">
        <input v-model="form.aviso_cifras" type="checkbox" class="mt-0.5 size-4 accent-neon-lime" />
        <span>Aviso: contiene cifras que no han sido verificadas</span>
      </label>
    </fieldset>
    <div class="flex flex-wrap items-center gap-3">
      <button v-if="canReview" type="button" class="btn-hxnf btn-ink btn-sm" :disabled="saving || !Object.keys(changes).length" @click="save">
        {{ saving ? 'Guardando…' : 'Guardar ajustes' }}
      </button>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" :aria-expanded="showGuide" @click="showGuide = !showGuide">
        {{ showGuide ? 'Ocultar la guía' : 'Ver la guía como la ve la persona' }}
      </button>
    </div>
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>

    <div v-if="showGuide" class="rounded-2xl border-2 border-dashed border-ink/40 p-3">
      <TestimonyGuide :input="guideInput" :review="review" :folio="t.folio" />
    </div>

    <!-- Seguimiento de compromisos -->
    <div class="space-y-2 border-t border-fg/10 pt-4">
      <h3 class="text-xs font-semibold tracking-wide text-fg/50 uppercase">Seguimiento de compromisos</h3>
      <p v-if="!followUps.length" class="text-sm text-fg/60">La persona todavía no responde el seguimiento en su guía.</p>
      <ul v-else class="space-y-3">
        <li v-for="f in followUps" :key="f.commitmentId" class="space-y-1.5 rounded-2xl bg-fg/5 p-3 text-sm">
          <p class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-xs font-semibold">{{ f.commitmentId }}</span>
            <span class="on-light rounded-full border-2 border-black px-2 py-0.5 text-[11px] font-black text-black" :class="FINDING[f.state].class">
              {{ FINDING[f.state].label }}
            </span>
          </p>
          <p class="text-fg/75">
            ¿Ha llegado?: <span class="font-semibold">{{ f.arrived ? ARRIVED_LABELS[f.arrived] : 'Sin responder' }}</span> · Solicitud:
            <span class="font-semibold">{{ f.requestFolio || 'no' }}</span> · Respuesta: <span class="font-semibold">{{ ANSWER_LABELS[f.answer] }}</span>
          </p>
          <p v-if="f.confirmed" class="text-xs text-fg/60">
            Omisión confirmada<template v-if="f.confirmedBy"> por {{ f.confirmedBy }}</template><template v-if="f.confirmedAt"> · {{ fmtDate(f.confirmedAt, true) }}</template>
          </p>
          <div v-if="canReview && (f.state === 'E3' || f.confirmed)">
            <button
              type="button"
              class="btn-hxnf btn-sm"
              :class="f.confirmed ? 'btn-paper' : 'btn-ink'"
              :disabled="confirming === f.commitmentId"
              @click="confirm(f.commitmentId, !f.confirmed)"
            >
              {{ f.confirmed ? 'Retirar confirmación' : 'Confirmar omisión documentada (E3)' }}
            </button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
