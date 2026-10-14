<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { EVIDENCE_LABELS } from '@testimonies/data/categories'
import { coverFor } from '@testimonies/data/covers'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { LoadStatus } from '@testimonies/stores/testimonies'
import type { TestimonyDetail, TestimonySummary } from '@testimonies/types/testimony'
import CategoryIcon from '@testimonies/components/CategoryIcon.vue'
import CommentsSection from '@testimonies/components/CommentsSection.vue'
import ReactionBar from '@testimonies/components/ReactionBar.vue'
import MediaReel from '@testimonies/components/media/MediaReel.vue'
import ShareSheet from '@testimonies/components/ShareSheet.vue'
import { useRoute } from 'vue-router'
import { DEFAULT_MAP_SLUG } from '@testimonies/data/maps'

// El encabezado sale del resumen (inmediato); el cuerpo, de la ficha completa cuando llega.
// Las secciones siguen el Manual: el testimonio y luego 01 recibo · 02 territorio · 03 comunidad · 04 datos · 05 pregunta
const props = defineProps<{
  testimony: TestimonySummary
  detail: TestimonyDetail | null
  status?: LoadStatus
  openComments?: boolean
}>()
const emit = defineEmits<{ retry: []; 'comments-focused': [] }>()

const DOCUMENT_STATUS = { si: 'Sí hay', no: 'No hay', pendiente: 'Pendiente' } as const

const categories = useCategoriesStore()
const meta = computed(() => categories.bySlug(props.testimony.category))

const route = useRoute()
const mapSlug = computed(() => (typeof route.params.mapa === 'string' ? route.params.mapa : DEFAULT_MAP_SLUG))
const shareOpen = ref(false)

const date = computed(() =>
  new Date(`${props.testimony.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
)
const author = computed(() => {
  if (!props.detail) return null
  return props.detail.author.visibility === 'nombre' && props.detail.author.name ? props.detail.author.name : 'Anónimo'
})
const title = computed(() => props.detail?.title ?? props.testimony.title)
const isLink = (s: string) => /^https?:\/\//i.test(s)

const titleRef = ref<HTMLHeadingElement | null>(null)
const commentsRef = ref<InstanceType<typeof CommentsSection> | null>(null)

watch(
  [() => props.openComments, () => props.detail],
  async ([openNeeded, detailVal]) => {
    if (openNeeded && detailVal) {
      await nextTick()
      commentsRef.value?.focusInput()
      emit('comments-focused')
    }
  },
  { immediate: true },
)

defineExpose({
  focusTitle: () => titleRef.value?.focus(),
  focusComments: () => commentsRef.value?.focusInput(),
})
</script>

<template>
  <article :aria-label="`Testimonio ${testimony.folio}`" :aria-busy="!detail && status !== 'error'" class="space-y-5">
    <!-- Encabezado: color de la categoría, para que se note que este testimonio está abierto -->
    <header class="relative overflow-hidden rounded-[22px] border-2 border-black p-4 text-black shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#e0fa49]" :style="{ backgroundColor: meta.color, color: meta.ink }">
      <div class="flex items-start justify-between gap-3">
        <span class="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-white px-2.5 py-0.5 text-[11px] font-black text-black uppercase">
          <span class="size-2 animate-pulse rounded-full bg-black" aria-hidden="true" />
          Testimonio abierto
        </span>
        <slot name="actions" />
      </div>
      <img :src="coverFor(testimony)" alt="" class="cutout pointer-events-none absolute -right-3 -bottom-4 w-24 rotate-6 opacity-90" />
      <p class="mt-3 inline-flex items-center gap-1.5 text-xs font-bold">
        <CategoryIcon :category="testimony.category" class="size-4" />
        {{ meta.label }}
      </p>
      <h2 ref="titleRef" tabindex="-1" class="font-wide mt-1 pr-16 text-2xl leading-tight font-black focus:outline-none">{{ title }}</h2>
      <p class="mt-2 pr-16 text-sm font-semibold">
        {{ detail?.place ?? testimony.place }}
        <span v-if="testimony.approximate" class="opacity-75">· ubicación aproximada</span>
      </p>
      <p class="mt-1 pr-16 text-xs opacity-80">
        <span class="font-mono">{{ testimony.folio }}</span> · {{ date }}<template v-if="author"> · {{ author }}</template>
      </p>
    </header>

    <!-- Error al cargar la ficha -->
    <div v-if="!detail && status === 'error'" class="card-brut space-y-3 p-4 text-sm" role="alert">
      <p class="text-fg/70">No pudimos cargar el testimonio completo.</p>
      <button type="button" class="btn-hxnf btn-paper btn-sm" @click="$emit('retry')">Reintentar</button>
    </div>

    <!-- Cargando -->
    <div v-else-if="!detail" class="space-y-5" aria-hidden="true">
      <div v-for="n in 3" :key="n" class="space-y-2">
        <span class="block h-3 w-28 animate-pulse rounded-full bg-fg/10" />
        <span class="block h-3 w-full animate-pulse rounded-full bg-fg/10" />
        <span class="block h-3 w-4/5 animate-pulse rounded-full bg-fg/10" />
      </div>
    </div>

    <div v-else class="space-y-5 text-sm leading-relaxed text-fg/90">
      <!-- Evidencias en miniatura -->
      <section v-if="detail.files.length">
        <h3 class="section-title">Evidencias · {{ detail.files.length }}</h3>
        <MediaReel :files="detail.files" :title="title" size="sm" />
      </section>

      <!-- Barra de acciones rápidas (100% responsiva): Comentar y Compartir -->
      <div class="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-2xl border-2 border-black bg-neon-lime py-2.5 px-3 text-xs font-black text-black shadow-[3px_3px_0_0_#000] transition hover:-translate-y-0.5 hover:bg-neon-green active:scale-95"
          title="Escribir un comentario sobre este testimonio"
          @click="commentsRef?.focusInput()"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Comentar</span>
          <span class="rounded-full bg-black px-1.5 py-0.2 text-[10px] font-black text-neon-lime tabular-nums dark:bg-white dark:text-black">
            {{ detail.comments }}
          </span>
        </button>

        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-2xl border-2 border-black bg-brand-pink py-2.5 px-3 text-xs font-black text-black uppercase shadow-[3px_3px_0_0_#000] transition hover:-translate-y-0.5 hover:bg-brand-pink/90 active:scale-95"
          title="Compartir foto y testimonio en Instagram Stories, WhatsApp y más"
          @click="shareOpen = true"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
          </svg>
          <span>Compartir</span>
        </button>
      </div>

      <!-- Reacciones (ancho completo, sin comprimir, 100% responsivo) -->
      <ReactionBar :testimony-id="testimony.id" />

      <section>
        <h3 class="section-title">El testimonio</h3>
        <p class="text-[15px] whitespace-pre-line">{{ detail.testimony }}</p>
      </section>

      <section>
        <h3 class="section-title">01 · El recibo dice</h3>
        <p class="text-fg/70">
          Documentos o evidencia: <span class="font-bold text-fg">{{ DOCUMENT_STATUS[detail.document.status] }}</span>
        </p>
        <ul v-if="detail.evidence.length" class="mt-2 flex flex-wrap gap-1.5">
          <li v-for="item in detail.evidence" :key="item" class="chip bg-card">{{ EVIDENCE_LABELS[item] }}</li>
        </ul>
      </section>

      <section v-if="detail.territory">
        <h3 class="section-title">02 · El territorio dice</h3>
        <p class="whitespace-pre-line">{{ detail.territory }}</p>
      </section>

      <section v-if="detail.community">
        <h3 class="section-title">03 · La comunidad dice</h3>
        <p class="whitespace-pre-line">{{ detail.community }}</p>
      </section>

      <section v-if="detail.data">
        <h3 class="section-title">04 · Los datos dicen</h3>
        <p v-if="detail.data.text" class="whitespace-pre-line">{{ detail.data.text }}</p>
        <ul v-if="detail.data.sources.length" class="mt-2 space-y-1.5">
          <li v-for="(s, i) in detail.data.sources" :key="i" class="rounded-xl border-2 border-ink/20 px-3 py-1.5 text-xs">
            <span class="font-bold">Fuente:</span> {{ s.source }}<template v-if="s.year"> ({{ s.year }})</template>
            <a v-if="s.link && isLink(s.link)" :href="s.link" target="_blank" rel="noopener noreferrer" class="ml-1 break-all underline">{{ s.link }}</a>
            <span v-else-if="s.link" class="ml-1 opacity-75">{{ s.link }}</span>
          </li>
        </ul>
        <p v-if="detail.data.pendingVerification" class="chip mt-2 border-brand-orange bg-brand-orange/15">Fuente pendiente de verificación</p>
      </section>

      <section
        v-if="detail.tribunalQuestion"
        class="rotate-[-0.6deg] rounded-[20px] border-2 border-black bg-neon-lime p-4 text-black shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]"
      >
        <h3 class="text-xs font-black tracking-wide uppercase">05 · La pregunta del Tribunal</h3>
        <p class="font-wide mt-1 text-lg leading-snug font-black">«{{ detail.tribunalQuestion }}»</p>
      </section>

      <section v-if="detail.anythingElse">
        <h3 class="section-title">Algo más que el Tribunal debe conocer</h3>
        <p class="whitespace-pre-line">{{ detail.anythingElse }}</p>
      </section>

      <CommentsSection ref="commentsRef" :key="testimony.id" :testimony-id="testimony.id" :count="detail.comments" />
    </div>

    <!-- Hoja de Compartir testimonio en redes sociales -->
    <Teleport to="body">
      <ShareSheet v-if="shareOpen" :testimony="testimony" :detail="detail" :map-slug="mapSlug" @close="shareOpen = false" />
    </Teleport>
  </article>
</template>

<style scoped>
@reference "@/style.css";

.section-title {
  @apply mb-1.5 inline-block rounded-full border-2 border-ink px-2.5 py-0.5 text-[11px] font-black tracking-wide text-fg uppercase;
}
</style>
