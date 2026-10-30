<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { track } from '@/core/analytics/analytics'
import { SINCE_LABELS } from '@testimonies/data/facts'
import { participantService } from '@testimonies/services/participant.service'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { FollowUp, FollowUpChanges } from '@testimonies/types/testimony'
import {
  AUTHORITIES_DUTY,
  buildGuide,
  FOLLOW_UP_BCC,
  GUIDE_TITLE,
  RISK_REVIEW_NOTICE,
  type Grade,
  type GuideInput,
  type GuideReview,
} from '@testimonies/utils/guide'
import CategoryBadge from '@testimonies/components/CategoryBadge.vue'
import CategoryIcon from '@testimonies/components/CategoryIcon.vue'
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
const categories = useCategoriesStore()
categories.load().catch(() => {})

const guide = computed(() => buildGuide(props.input, props.review))
const categoryMeta = computed(() => (guide.value ? categories.bySlug(guide.value.category) : null))

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

// Solicitud de información: se copia, se descarga o se envía desde el correo de la persona
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

// Correo listo para enviar desde la cuenta de la persona, con copia oculta a HxNF para el seguimiento.
// Los espacios van como %20 (no «+»): así los respetan todas las apps de correo
const enc = encodeURIComponent
const email = computed(() => {
  const e = guide.value?.email
  if (!e) return null
  const to = e.to.map((r) => r.email).join(',')
  const body = `${e.body}\n\nSolicito que la respuesta se envíe a este correo electrónico.\n\nNombre o seudónimo: `
  return {
    mailto: `mailto:${to}?bcc=${enc(FOLLOW_UP_BCC)}&subject=${enc(e.subject)}&body=${enc(body)}`,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&bcc=${enc(FOLLOW_UP_BCC)}&su=${enc(e.subject)}&body=${enc(body)}`,
  }
})
const emailOpened = (cliente: 'correo' | 'gmail') => track('click_cta', { boton: 'enviar_solicitud_correo', ubicacion: 'guia', cliente })

const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 })
const excerpt = (s: string, n = 240) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s)

// Tarjetas de color: siempre con tinta negra (también en oscuro) y sombra lima en oscuro
const CARD = 'on-light space-y-2 rounded-[22px] border-2 border-black p-4 text-black shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_var(--color-neon-lime)]'
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
        <section :class="[CARD, 'bg-tint-pink']" aria-labelledby="g-lives">
          <p class="chip w-fit border-black bg-white text-[11px] tracking-wider uppercase">Afirmación del testimonio</p>
          <h3 id="g-lives" :class="HEADING">Lo que vives</h3>
          <p class="text-lg leading-snug font-semibold">{{ guide.title }}</p>
          <p class="text-sm text-black/70">{{ guide.place }}<template v-if="guide.ongoing"> · sigue pasando</template></p>
          <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <CategoryBadge :category="guide.category" class="border-2 border-black" />
            <span class="text-black/75">{{ guide.subcategoryLabel }}</span>
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
          <section :class="[CARD, 'bg-tint-blue']" aria-labelledby="g-rights">
            <h3 id="g-rights" :class="HEADING">Tus derechos que se afectan</h3>
            <ul class="space-y-3">
              <li v-for="r in guide.rights" :key="r.name" class="flex items-start gap-3">
                <span
                  class="mt-0.5 grid h-7 min-w-7 shrink-0 place-items-center rounded-full border-2 border-black px-1.5 text-[11px] font-black text-black"
                  :class="r.grade ? GRADES[r.grade].class : 'bg-white'"
                  aria-hidden="true"
                >
                  {{ r.grade ? GRADES[r.grade].label : '?' }}
                </span>
                <span class="min-w-0 text-sm">
                  <span class="block font-bold">{{ r.name }} <span class="font-normal text-black/60">({{ r.article }} de la Constitución)</span></span>
                  <span class="block text-black/75">{{ r.phrase }}<template v-if="r.review"> · identificado en revisión</template></span>
                </span>
              </li>
            </ul>
            <p class="border-t-2 border-black/15 pt-2 text-xs text-black/75">{{ AUTHORITIES_DUTY }}</p>
          </section>
        </li>

        <!-- 3 · Quién debía evitarlo -->
        <li>
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="[CARD, 'bg-tint-orange']" aria-labelledby="g-who">
            <h3 id="g-who" :class="HEADING">Quién debía evitarlo y con qué fundamento</h3>
            <p class="font-bold">Responsable: {{ guide.responsible }}</p>
            <p v-if="guide.responsibleExtra" class="text-sm font-semibold">{{ guide.responsibleExtra }}</p>
            <p class="text-sm">
              Qué debía hacer: <GuideText :text="`«${guide.duty.text}»`" /> <span class="text-black/60">({{ guide.duty.source }})</span>
            </p>
          </section>
        </li>

        <!-- 4 · Salida renovable o climática -->
        <li>
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="[CARD, 'bg-tint-green']" aria-labelledby="g-way">
            <h3 id="g-way" :class="HEADING">La salida renovable o climática</h3>
            <p class="text-sm"><GuideText :text="`«${guide.renewable.text}»`" /> <span class="text-black/60">({{ guide.renewable.source }})</span></p>
          </section>
        </li>

        <!-- 5 · Qué hacer: la pregunta del Tribunal se vuelve una solicitud de información -->
        <li>
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="[CARD, 'light-box space-y-3 bg-neon-lime']" aria-labelledby="g-do">
            <h3 id="g-do" :class="HEADING">Qué puedes hacer</h3>
            <div class="space-y-1.5 rounded-2xl border-2 border-black bg-brand-orange p-3 shadow-[3px_3px_0_0_#000]">
              <p class="chip w-fit border-black bg-black text-[11px] tracking-wider text-white uppercase">
                El Tribunal pregunta<template v-if="guide.questionSuggested"> · sugerida</template>
              </p>
              <p class="text-base leading-snug font-bold">{{ guide.question }}</p>
            </div>

            <!-- Enviar por correo desde la cuenta de la persona -->
            <div v-if="email" class="space-y-2.5 rounded-2xl border-2 border-black bg-white p-3">
              <h4 class="text-sm font-black uppercase">Envía tu pregunta como solicitud de información</h4>
              <p class="text-sm">Se abre tu correo con la solicitud lista. Revísala, agrega tu nombre o un seudónimo y envíala.</p>
              <dl class="space-y-1 text-xs">
                <div>
                  <dt class="inline font-bold">Para: </dt>
                  <dd class="inline">
                    <template v-for="(r, i) in guide.email.to" :key="r.email"
                      ><template v-if="i">, </template>{{ r.label }} (<span class="break-all">{{ r.email }}</span>)</template
                    >
                  </dd>
                </div>
                <div>
                  <dt class="inline font-bold">Copia oculta: </dt>
                  <dd class="inline">Hackers x Nuestro Futuro (<span class="break-all">{{ FOLLOW_UP_BCC }}</span>), para dar seguimiento a tu caso.</dd>
                </div>
              </dl>
              <div class="grid gap-2 @md:grid-cols-2">
                <a :href="email.mailto" class="btn-hxnf btn-ink btn-sm" @click="emailOpened('correo')">
                  <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
                  </svg>
                  Abrir mi correo
                </a>
                <a :href="email.gmail" target="_blank" rel="noopener noreferrer" class="btn-hxnf btn-paper btn-sm" @click="emailOpened('gmail')">
                  Abrir en Gmail
                </a>
              </div>
              <p class="text-xs text-black/70">
                Cuando te respondan, guarda el folio y regístralo abajo en «Lo que el gobierno se comprometió a hacer». También puedes presentarla en la
                <a href="https://www.plataformadetransparencia.org.mx/" target="_blank" rel="noopener noreferrer" class="font-semibold underline">Plataforma Nacional de Transparencia</a>.
              </p>
            </div>

            <button type="button" class="btn-hxnf btn-paper btn-sm w-full" :aria-expanded="showRequest" aria-controls="g-request" @click="showRequest = !showRequest">
              {{ showRequest ? 'Ocultar el texto' : 'Ver, copiar o descargar el texto' }}
            </button>
            <div v-if="showRequest" id="g-request" class="space-y-3 rounded-2xl border-2 border-black bg-white p-3">
              <p class="text-xs">Responsable según el atlas: <span class="font-bold">{{ guide.responsible }}</span></p>
              <p ref="requestText" class="text-sm leading-relaxed whitespace-pre-wrap">{{ guide.request }}</p>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn-hxnf btn-ink btn-sm" @click="copyRequest">{{ copied ? 'Copiada' : 'Copiar' }}</button>
                <button type="button" class="btn-hxnf btn-paper btn-sm" @click="downloadRequest">Descargar (.txt)</button>
              </div>
              <p class="sr-only" aria-live="polite">{{ copied ? 'Solicitud copiada' : '' }}</p>
            </div>
          </section>
        </li>

        <!-- 6 · Compromiso del gobierno -->
        <li>
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="[CARD, 'bg-tint-pink']" aria-labelledby="g-commitment">
            <p class="chip w-fit border-black bg-white text-[11px] tracking-wider uppercase">Hallazgo por verificar</p>
            <h3 id="g-commitment" :class="HEADING">Lo que el gobierno se comprometió a hacer</h3>
            <template v-if="guide.commitment">
              <p class="text-sm"><GuideText :text="`«${guide.commitment.fragmento}»`" /> <span class="text-black/60">({{ guide.commitment.fuente }})</span></p>
              <p class="text-xs text-black/60">Responsable: {{ guide.commitment.responsable }} · {{ guide.commitment.id }}</p>
              <CommitmentFollowUp
                v-if="canTrack"
                :commitment-id="guide.commitment.id"
                :entry="followUps[guide.commitment.id]"
                :saving="savingId === guide.commitment.id"
                @save="saveFollowUp(guide.commitment.id, $event)"
              />
            </template>
            <p v-else class="text-sm text-black/75">Todavía no identificamos un compromiso específico para tu región en este tipo de caso.</p>
            <details v-if="guide.moreCommitments.length" class="text-sm">
              <summary class="cursor-pointer font-semibold">Ver más ({{ guide.moreCommitments.length }})</summary>
              <ul class="mt-2 space-y-3">
                <li v-for="c in guide.moreCommitments" :key="c.id">
                  <GuideText :text="`«${c.fragmento}»`" /> <span class="text-black/60">({{ c.fuente }})</span>
                  <span class="block text-xs text-black/60">Responsable: {{ c.responsable }} · {{ c.id }}</span>
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
            <p v-if="canTrack" class="text-xs text-black/60">
              E1: compromiso identificado · E2: respondiste que no ha llegado · E3: registraste una solicitud y la autoridad no
              acreditó o no respondió (el equipo la revisa).
            </p>
            <p v-if="followUpError" class="text-sm font-semibold text-danger" role="alert">{{ followUpError }}</p>
          </section>
        </li>

        <!-- 7 · Tu región en datos -->
        <li v-if="guide.regionDetail">
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="BLOCK" class="space-y-3" aria-labelledby="g-region">
            <p class="chip w-fit bg-black text-[11px] tracking-wider text-white uppercase dark:bg-white dark:text-black">Capacidad prevista, no generación</p>
            <h3 id="g-region" :class="HEADING">Tu región en datos</h3>
            <p class="text-sm text-fg/80">
              {{ input.state }} está en la región de control <span class="font-bold">{{ guide.regionDetail.name }}</span> del sistema eléctrico.
            </p>

            <!-- Lo que no se ve en las barras: proporción, lugar entre regiones e inversión -->
            <dl class="grid grid-cols-2 gap-2 @xl:grid-cols-3">
              <div class="rounded-2xl border-2 border-ink/15 p-3">
                <dt class="text-xs text-fg/70">De lo que se planea agregar, es renovable</dt>
                <dd class="text-2xl font-black tabular-nums">{{ guide.regionDetail.renewableShare }}%</dd>
              </div>
              <div class="rounded-2xl border-2 border-ink/15 p-3">
                <dt class="text-xs text-fg/70">Paneles en techos instalados en 2024</dt>
                <dd class="text-2xl font-black tabular-nums">{{ guide.regionDetail.rank }}º <span class="text-sm font-semibold">de {{ guide.regionDetail.regions }}</span></dd>
              </div>
              <div v-if="guide.regionDetail.investment" class="col-span-2 rounded-2xl border-2 border-ink/15 p-3 @xl:col-span-1">
                <dt class="text-xs text-fg/70">Inversión preliminar de la CFE en proyectos de tu región</dt>
                <dd class="text-2xl font-black tabular-nums">${{ guide.regionDetail.investment.amount }} <span class="text-sm font-semibold">millones</span></dd>
              </div>
            </dl>

            <RegionBars :region="guide.region" />

            <details class="rounded-2xl border-2 border-ink/15 p-3 text-sm">
              <summary class="cursor-pointer font-semibold">Ver el dato completo</summary>
              <dl class="mt-3 space-y-3 text-fg/85">
                <div>
                  <dt class="font-bold">Lo que dice el plan</dt>
                  <dd><GuideText :text="guide.regionText" /></dd>
                </div>
                <div>
                  <dt class="font-bold">Lo que se planea agregar de 2025 a 2039</dt>
                  <dd>
                    {{ fmt(guide.regionDetail.renewables) }} MW renovables y {{ fmt(guide.regionDetail.fossils) }} MW fósiles<template
                      v-if="guide.regionDetail.shared"
                    >
                      (cifra de toda la región Baja California, que incluye Baja California Sur)</template
                    >.
                  </dd>
                </div>
                <div>
                  <dt class="font-bold">Paneles en techos y sistemas pequeños (generación distribuida)</dt>
                  <dd>
                    {{ fmt(guide.regionDetail.installed2024) }} MW instalados en 2024: lugar {{ guide.regionDetail.rank }} de {{ guide.regionDetail.regions }} regiones.
                  </dd>
                </div>
                <div v-if="guide.regionDetail.investment">
                  <dt class="font-bold">Inversión preliminar de la CFE</dt>
                  <dd>
                    ${{ guide.regionDetail.investment.amount }} millones de pesos para sus proyectos estratégicos en la región
                    ({{ guide.regionDetail.investment.source }}).
                  </dd>
                </div>
                <div>
                  <dt class="font-bold">Estados de la región</dt>
                  <dd>{{ guide.regionDetail.states.join(', ') }}</dd>
                </div>
                <div>
                  <dt class="font-bold">Cómo leerlo</dt>
                  <dd class="space-y-1">
                    <span class="block">
                      La capacidad es lo máximo que podrían producir las plantas que se planea construir; no es la energía que de verdad generan.
                    </span>
                    <span class="block">
                      La región de cada estado es una interpretación del equipo con base en el PLADESE. La proporción renovable es un cálculo propio con
                      esas cifras.
                    </span>
                  </dd>
                </div>
              </dl>
            </details>
          </section>
        </li>

        <!-- 8 · Reclamo -->
        <li v-if="guide.complaint">
          <span class="guide-arrow" aria-hidden="true" />
          <section :class="[CARD, 'bg-tint-blue']" aria-labelledby="g-complaint">
            <h3 id="g-complaint" :class="HEADING">{{ guide.complaintTitle }}</h3>
            <p class="text-sm">{{ guide.complaint }}</p>
          </section>
        </li>
      </template>

      <!-- 9 · Vista previa: así se verá en el mapa cuando el equipo lo publique -->
      <li>
        <span class="guide-arrow" aria-hidden="true" />
        <section class="space-y-3 rounded-[22px] border-2 border-dashed border-ink p-4" aria-labelledby="g-preview">
          <p class="chip w-fit bg-black text-[11px] tracking-wider text-white uppercase dark:bg-white dark:text-black">Vista previa</p>
          <h3 id="g-preview" :class="HEADING">Así se verá en el mapa</h3>
          <p class="text-xs text-fg/70">Cuando el equipo lo revise y lo publique. Lo que no aparece aquí (tu contacto, el punto exacto) no se publica.</p>

          <article class="overflow-hidden rounded-[22px] border-2 border-black shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_var(--color-neon-lime)]" aria-label="Vista previa del testimonio publicado">
            <header class="space-y-1.5 p-4 text-black" :style="{ backgroundColor: categoryMeta?.color, color: categoryMeta?.ink }">
              <p class="inline-flex items-center gap-1.5 text-xs font-bold">
                <CategoryIcon :category="guide.category" class="size-4" />
                {{ categoryMeta?.label }}
              </p>
              <p class="w-fit rounded-full border-2 border-black bg-white px-2 py-0.5 text-[10px] font-black tracking-wider text-black uppercase">
                Afirmación del testimonio
              </p>
              <h4 class="font-wide text-xl leading-tight font-black">{{ guide.title }}</h4>
              <p class="text-sm font-semibold">{{ guide.publicPlace }}</p>
              <p class="text-xs opacity-80">
                <template v-if="input.since">Desde: {{ SINCE_LABELS[input.since].toLowerCase() }}</template
                ><template v-if="guide.ongoing"> · sigue pasando</template> · Publicado por {{ guide.author }}
              </p>
            </header>
            <div class="on-light space-y-3 bg-white p-4 text-sm text-black">
              <p class="whitespace-pre-line">{{ excerpt(input.testimony.trim()) }}</p>
              <div class="space-y-1 rounded-2xl border-2 border-black bg-brand-orange p-3">
                <p class="text-[11px] font-black tracking-wider uppercase">El Tribunal pregunta</p>
                <p class="font-semibold">{{ guide.question }}</p>
              </div>
              <ul v-if="!guide.hydrocarbons" class="list-disc space-y-1 pl-5">
                <li>Responsable: <span class="font-bold">{{ guide.responsible }}</span> ({{ guide.duty.source }})</li>
                <li v-if="guide.rights[0]">
                  {{ guide.rights[0].name }} ({{ guide.rights[0].article }})<template v-if="guide.rights.length > 1"> y {{ guide.rights.length - 1 }} derechos más</template>
                </li>
                <li v-if="guide.commitment">Compromiso: {{ guide.commitment.fuente }}</li>
              </ul>
              <p class="text-xs text-black/70">Fotos: el equipo las revisa antes de publicarlas.</p>
            </div>
          </article>
        </section>
      </li>

      <!-- 10 · Avisos -->
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
:root[data-theme='dark'] .light-box .btn-paper {
  background-color: #fff;
  color: #000;
}
</style>
