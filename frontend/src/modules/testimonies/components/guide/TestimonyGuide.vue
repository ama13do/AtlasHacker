<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { participantService } from '@testimonies/services/participant.service'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { FollowUp, FollowUpChanges } from '@testimonies/types/testimony'
import { buildGuide, GUIDE_TITLE, RISK_REVIEW_NOTICE, type Grade, type GuideInput, type GuideReview } from '@testimonies/utils/guide'
import CategoryBadge from '@testimonies/components/CategoryBadge.vue'
import CommitmentFollowUp from '@testimonies/components/guide/CommitmentFollowUp.vue'
import GuideText from '@testimonies/components/guide/GuideText.vue'
import RegionBars from '@testimonies/components/guide/RegionBars.vue'

// Lo que la persona ve después de enviar (y desde Mi folio): de lo que vive a lo que puede hacer.
// Con el id del testimonio y el folio de la persona, también registra el seguimiento de los compromisos
const props = defineProps<{
  input: GuideInput
  folio?: string
  status?: string
  review?: GuideReview | null
  testimonyId?: string
  participantFolio?: string
}>()

// La categoría se muestra con el nombre y color de la API
useCategoriesStore()
  .load()
  .catch(() => {})

const guide = computed(() => buildGuide(props.input, props.review))

// Seguimiento: E1 identificado → E2 «no ha llegado» → E3 solicitud sin acreditación (la confirma el equipo)
const canTrack = computed(() => !!props.testimonyId && !!props.participantFolio)
const followUps = ref<Record<string, FollowUp>>({})
const savingId = ref<string | null>(null)
const followUpError = ref<string | null>(null)

const byCommitment = (list: FollowUp[]) => Object.fromEntries(list.map((f) => [f.commitmentId, f]))

onMounted(async () => {
  if (!canTrack.value) return
  try {
    followUps.value = byCommitment(await participantService.listFollowUp(props.participantFolio!, props.testimonyId!))
  } catch (e) {
    console.error(e)
  }
})

async function saveFollowUp(commitmentId: string, changes: FollowUpChanges) {
  if (!canTrack.value) return
  savingId.value = commitmentId
  followUpError.value = null
  try {
    followUps.value = byCommitment(await participantService.saveFollowUp(props.participantFolio!, props.testimonyId!, commitmentId, changes))
  } catch (e) {
    console.error(e)
    followUpError.value = 'No pudimos guardar tu respuesta. Intenta de nuevo.'
  } finally {
    savingId.value = null
  }
}

const GRADES: Record<Grade, { label: string; class: string }> = {
  A: { label: 'A', class: 'bg-brand-orange' },
  B: { label: 'B', class: 'bg-brand-pink' },
  C: { label: 'C', class: 'bg-white' },
  M: { label: 'Mandato', class: 'bg-neon-lime' },
}

// Solicitud de información: se copia o se descarga; la persona la presenta
const showRequest = ref(false)
const copied = ref(false)
const requestText = ref<HTMLElement | null>(null)

async function copyRequest() {
  if (!guide.value) return
  try {
    await navigator.clipboard.writeText(guide.value.request)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Sin permiso de portapapeles: se selecciona el texto para copiarlo a mano
    if (requestText.value) window.getSelection()?.selectAllChildren(requestText.value)
  }
}

function downloadRequest() {
  if (!guide.value) return
  const url = URL.createObjectURL(new Blob([guide.value.request + '\n'], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `solicitud-de-informacion${props.folio ? `-${props.folio}` : ''}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

const BLOCK = 'space-y-2 rounded-[22px] border-2 border-ink bg-card p-4 shadow-brut'
const HEADING = 'text-base leading-tight font-black uppercase'
</script>

<template>
  <article v-if="guide" class="space-y-1 text-left" aria-labelledby="guide-title">
    <header class="mb-5 space-y-2">
      <p class="chip w-fit bg-black text-[11px] tracking-wider text-white uppercase dark:bg-white dark:text-black">Tu guía</p>
      <h2 id="guide-title" tabindex="-1" class="font-wide text-xl leading-tight font-black uppercase focus:outline-none @3xl:text-2xl">
        {{ GUIDE_TITLE }}
      </h2>
      <p v-if="folio || status" class="text-xs text-fg/60">
        <template v-if="folio">Folio <span class="font-semibold tabular-nums">{{ folio }}</span></template>
        <template v-if="folio && status"> · </template>{{ status }}
      </p>
    </header>

    <ol class="space-y-1" aria-label="De lo que vives a lo que puedes hacer">
      <!-- 1 · Lo que vives -->
      <li>
        <section :class="BLOCK" aria-labelledby="g-lives">
          <h3 id="g-lives" :class="HEADING">Lo que vives</h3>
          <p class="text-lg leading-snug font-semibold">{{ guide.title }}</p>
          <p class="text-sm text-fg/70">{{ guide.place }}<template v-if="guide.ongoing"> · sigue pasando</template></p>
          <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <CategoryBadge :category="guide.category" />
            <span class="text-fg/75">{{ guide.subcategoryLabel }}</span>
          </p>
        </section>
      </li>

      <li v-if="guide.hydrocarbons">
        <span class="guide-arrow" aria-hidden="true" />
        <section :class="BLOCK">
          <h3 :class="HEADING">Este tipo de caso se registra, pero todavía no se vincula con obligaciones</h3>
          <p class="text-sm text-fg/75">Los hidrocarburos (gasoductos, fracking) están fuera del alcance de esta versión del atlas.</p>
        </section>
      </li>

      <template v-else>
        <!-- 2 · Derechos -->
        <li>
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="BLOCK" aria-labelledby="g-rights">
            <h3 id="g-rights" :class="HEADING">Tus derechos que se afectan</h3>
            <ul class="space-y-3">
              <li v-for="r in guide.rights" :key="r.name" class="flex items-start gap-3">
                <span
                  class="on-light mt-0.5 grid h-7 min-w-7 shrink-0 place-items-center rounded-full border-2 border-black px-1.5 text-[11px] font-black text-black"
                  :class="r.grade ? GRADES[r.grade].class : 'bg-white'"
                  aria-hidden="true"
                >
                  {{ r.grade ? GRADES[r.grade].label : '?' }}
                </span>
                <span class="min-w-0 text-sm">
                  <span class="block font-bold">{{ r.name }} <span class="font-normal text-fg/60">({{ r.article }} de la Constitución)</span></span>
                  <span class="block text-fg/75">{{ r.phrase }}<template v-if="r.review"> · identificado en revisión</template></span>
                </span>
              </li>
            </ul>
          </section>
        </li>

        <!-- 3 · Quién debía evitarlo -->
        <li>
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="BLOCK" aria-labelledby="g-who">
            <h3 id="g-who" :class="HEADING">Quién debía evitarlo y con qué fundamento</h3>
            <p class="font-bold">Responsable: {{ guide.responsible }}</p>
            <p v-if="guide.responsibleExtra" class="text-sm font-semibold">{{ guide.responsibleExtra }}</p>
            <p class="text-sm">
              Qué debía hacer: <GuideText :text="`«${guide.duty.text}»`" /> <span class="text-fg/60">({{ guide.duty.source }})</span>
            </p>
          </section>
        </li>

        <!-- 4 · Salida renovable o climática -->
        <li>
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="BLOCK" aria-labelledby="g-way">
            <h3 id="g-way" :class="HEADING">La salida renovable o climática</h3>
            <p class="text-sm"><GuideText :text="`«${guide.renewable.text}»`" /> <span class="text-fg/60">({{ guide.renewable.source }})</span></p>
          </section>
        </li>

        <!-- 5 · Qué hacer -->
        <li>
          <span class="guide-arrow" aria-hidden="true" />
          <section class="on-light light-box space-y-3 rounded-[22px] border-2 border-black bg-neon-lime p-4 text-black shadow-brut" aria-labelledby="g-do">
            <h3 id="g-do" :class="HEADING">Qué puedes hacer</h3>
            <div class="space-y-1 rounded-2xl border-2 border-black bg-white p-3">
              <p class="chip w-fit bg-black text-[11px] tracking-wider text-white uppercase">
                El Tribunal pregunta<template v-if="guide.questionSuggested"> · sugerida</template>
              </p>
              <p class="text-sm font-semibold">{{ guide.question }}</p>
            </div>
            <button
              type="button"
              class="btn-hxnf btn-ink w-full"
              :aria-expanded="showRequest"
              aria-controls="g-request"
              @click="showRequest = !showRequest"
            >
              Prepara tu solicitud de información a {{ guide.responsible }}
            </button>
            <div v-if="showRequest" id="g-request" class="space-y-3 rounded-2xl border-2 border-black bg-white p-3">
              <p class="text-xs">Para: <span class="font-bold">{{ guide.responsible }}</span></p>
              <p ref="requestText" class="text-sm leading-relaxed whitespace-pre-wrap">{{ guide.request }}</p>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn-hxnf btn-ink btn-sm" @click="copyRequest">{{ copied ? 'Copiada' : 'Copiar' }}</button>
                <button type="button" class="btn-hxnf btn-paper btn-sm" @click="downloadRequest">Descargar (.txt)</button>
              </div>
              <p class="text-xs text-black/70">
                No se envía sola: cópiala o descárgala y preséntala ante {{ guide.responsible }} por sus medios de transparencia
                (solicitud de acceso a la información).
              </p>
              <p class="sr-only" aria-live="polite">{{ copied ? 'Solicitud copiada' : '' }}</p>
            </div>
          </section>
        </li>

        <!-- 6 · Compromiso del gobierno -->
        <li>
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="BLOCK" aria-labelledby="g-commitment">
            <h3 id="g-commitment" :class="HEADING">Lo que el gobierno se comprometió a hacer</h3>
            <template v-if="guide.commitment">
              <p class="text-sm"><GuideText :text="`«${guide.commitment.fragmento}»`" /> <span class="text-fg/60">({{ guide.commitment.fuente }})</span></p>
              <p class="text-xs text-fg/60">Responsable: {{ guide.commitment.responsable }} · {{ guide.commitment.id }}</p>
              <CommitmentFollowUp
                v-if="canTrack"
                :commitment-id="guide.commitment.id"
                :entry="followUps[guide.commitment.id]"
                :saving="savingId === guide.commitment.id"
                @save="saveFollowUp(guide.commitment.id, $event)"
              />
            </template>
            <p v-else class="text-sm text-fg/75">Todavía no identificamos un compromiso específico para tu región en este tipo de caso.</p>
            <details v-if="guide.moreCommitments.length" class="text-sm">
              <summary class="cursor-pointer font-semibold">Ver más ({{ guide.moreCommitments.length }})</summary>
              <ul class="mt-2 space-y-3">
                <li v-for="c in guide.moreCommitments" :key="c.id">
                  <GuideText :text="`«${c.fragmento}»`" /> <span class="text-fg/60">({{ c.fuente }})</span>
                  <span class="block text-xs text-fg/60">Responsable: {{ c.responsable }} · {{ c.id }}</span>
                  <CommitmentFollowUp
                    v-if="canTrack"
                    :commitment-id="c.id"
                    :entry="followUps[c.id]"
                    :saving="savingId === c.id"
                    @save="saveFollowUp(c.id, $event)"
                  />
                </li>
              </ul>
            </details>
            <p v-if="canTrack" class="text-xs text-fg/60">
              E1: compromiso identificado · E2: respondiste que no ha llegado · E3: registraste una solicitud y la autoridad no
              acreditó o no respondió (el equipo la revisa).
            </p>
            <p v-if="followUpError" class="text-sm font-semibold text-danger" role="alert">{{ followUpError }}</p>
          </section>
        </li>

        <!-- 7 · Tu región en datos -->
        <li v-if="guide.regionText">
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="BLOCK" aria-labelledby="g-region">
            <p class="chip w-fit bg-black text-[11px] tracking-wider text-white uppercase dark:bg-white dark:text-black">Capacidad prevista, no generación</p>
            <h3 id="g-region" :class="HEADING">Tu región en datos</h3>
            <RegionBars :region="guide.region" />
            <details class="text-sm">
              <summary class="cursor-pointer font-semibold">Ver el dato completo</summary>
              <p class="mt-2 text-fg/80"><GuideText :text="guide.regionText" /></p>
            </details>
          </section>
        </li>

        <!-- 8 · Reclamo -->
        <li v-if="guide.complaint">
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="BLOCK" aria-labelledby="g-complaint">
            <h3 id="g-complaint" :class="HEADING">{{ guide.complaintTitle }}</h3>
            <p class="text-sm">{{ guide.complaint }}</p>
          </section>
        </li>
      </template>

      <!-- 9 · Avisos -->
      <li>
        <span class="guide-arrow" aria-hidden="true" />
        <section class="space-y-2 rounded-[22px] border-2 border-dashed border-ink p-4" aria-labelledby="g-notices">
          <h3 id="g-notices" :class="HEADING">Avisos</h3>
          <ul class="list-disc space-y-1 pl-5 text-sm text-fg/80">
            <li v-if="guide.riskReview">{{ RISK_REVIEW_NOTICE }}</li>
            <li v-if="guide.protection">Modo protección: apareces como anónimo y en el mapa público solo se muestra el estado.</li>
            <li v-else>En el mapa público: {{ guide.publicMap.toLowerCase() }}.</li>
            <li v-for="n in guide.notices" :key="n">{{ n }}</li>
          </ul>
        </section>
      </li>
    </ol>

    <slot />
  </article>
</template>

<style scoped>
/* Flecha entre bloques: de lo que vives a lo que puedes hacer */
.guide-arrow {
  display: block;
  width: 2px;
  height: 1.25rem;
  margin: 0.25rem auto;
  background: var(--ink);
  position: relative;
}
.guide-arrow::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -2px;
  width: 0.5rem;
  height: 0.5rem;
  border-right: 2px solid var(--ink);
  border-bottom: 2px solid var(--ink);
  transform: translateX(-50%) rotate(45deg);
}

/* Dentro de un recuadro claro, los botones conservan borde y sombra negros también en modo oscuro */
:root[data-theme='dark'] .light-box .btn-hxnf {
  --btn-shadow: #000;
  border-color: #000;
}
:root[data-theme='dark'] .light-box .btn-ink {
  background-color: #000;
  color: #fff;
}
</style>
