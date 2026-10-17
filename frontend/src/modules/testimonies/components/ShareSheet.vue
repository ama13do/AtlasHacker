<script setup lang="ts">
import { track as trackEvent } from '@/core/analytics/analytics'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { STICKERS, SITE_HOST, SITE_URL, phraseFor } from '@/core/config/brand'
import { coverFor } from '@testimonies/data/covers'
import { logoForSlug } from '@testimonies/data/maps'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { renderShareImage, type ShareDesign, type ShareFormat } from '@testimonies/utils/shareImage'
import type { TestimonyDetail, TestimonySummary } from '@testimonies/types/testimony'

// Compartir un testimonio: imagen lista para publicar, en formato historia (9:16) o publicación (4:5) y en tres
// diseños que se comparan en un carrusel: el de la plataforma (relato con collage de fotos o stickers de la marca),
// «Negativo» (negro con foto recortada) y «Brutalista» (cartel de fotocopia). Todas llevan la leyenda
// «Este testimonio salió de atlashacker.hxnf.mx · Léelo completo y comparte el tuyo» y el enlace al testimonio.
// Los enlaces siempre usan el dominio oficial, no el de Vercel.
const props = defineProps<{ testimony: TestimonySummary; detail: TestimonyDetail | null; mapSlug: string }>()
const emit = defineEmits<{ close: [] }>()

const categories = useCategoriesStore()
const meta = computed(() => categories.bySlug(props.testimony.category))

const title = computed(() => props.detail?.title ?? props.testimony.title)
const place = computed(() => props.detail?.place ?? props.testimony.place)
const date = computed(() => new Date(`${props.testimony.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }))
const link = computed(() => `${SITE_URL}/mapas/${props.mapSlug}?t=${props.testimony.id}`)
const photos = computed(() => props.detail?.files.filter((f) => f.mime.startsWith('image/')).map((f) => f.url) ?? [])
const text = computed(() =>
  [`«${title.value}»`, `${place.value} · ${date.value}`, '', `Este testimonio salió de ${SITE_HOST}. Léelo completo, explora el mapa y comparte el tuyo:`, link.value].join('\n'),
)

const DESIGNS: { id: ShareDesign; label: string; hint: string }[] = [
  { id: 'platform', label: 'Plataforma', hint: 'Colores de la categoría' },
  { id: 'negative', label: 'Negativo', hint: 'Negro y foto recortada' },
  { id: 'brutalist', label: 'Brutalista', hint: 'Cartel de fotocopia' },
]

type Key = `${ShareDesign}:${ShareFormat}`
const keyOf = (d: ShareDesign, f: ShareFormat): Key => `${d}:${f}`

const format = ref<ShareFormat>('story')
const design = ref<ShareDesign>('platform')
const images = ref<Partial<Record<Key, { blob: Blob; url: string }>>>({})
const failed = ref<Partial<Record<Key, true>>>({})
const notice = ref<string | null>(null)

const current = computed(() => images.value[keyOf(design.value, format.value)] ?? null)
const file = computed(() =>
  current.value
    ? new File(
        [current.value.blob],
        `testimonio-${props.testimony.folio.replace(/\W+/g, '-')}-${design.value}-${format.value}.${current.value.blob.type === 'image/jpeg' ? 'jpg' : 'png'}`,
        { type: current.value.blob.type },
      )
    : null,
)
// Compartir nativo con la imagen (celulares): abre la hoja del sistema con Instagram, WhatsApp, etc.
const canShareFile = computed(() => !!file.value && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file.value] }))

// Una imagen a la vez (son pesadas de dibujar): la elegida primero y luego las demás del carrusel
const pending = new Map<Key, Promise<void>>()
let queue: Promise<unknown> = Promise.resolve()
function render(d: ShareDesign, f: ShareFormat): Promise<void> {
  const key = keyOf(d, f)
  if (images.value[key] || failed.value[key]) return Promise.resolve()
  const running = pending.get(key)
  if (running) return running
  const job = queue.then(() => draw(d, f, key))
  queue = job
  pending.set(key, job)
  return job
}

async function draw(d: ShareDesign, f: ShareFormat, key: Key) {
  if (closed) return
  try {
    const blob = await renderShareImage(
      {
        title: title.value,
        place: place.value,
        date: date.value,
        category: meta.value.label,
        color: meta.value.color,
        ink: meta.value.ink,
        excerpt: props.detail?.testimony ?? '',
        question: props.detail?.tribunalQuestion,
        photoUrls: photos.value,
        phraseUrl: phraseFor(props.testimony.category),
        coverUrl: coverFor(props.testimony),
        folio: props.testimony.folio,
        campaignLogo: logoForSlug(props.mapSlug),
      },
      f,
      d,
    )
    if (closed) return
    images.value = { ...images.value, [key]: { blob, url: URL.createObjectURL(blob) } }
  } catch (e) {
    console.error(e)
    failed.value = { ...failed.value, [key]: true }
  } finally {
    pending.delete(key)
  }
}

async function renderAll() {
  const f = format.value
  await render(design.value, f)
  for (const d of DESIGNS) await render(d.id, f)
}
watch(format, async () => {
  await nextTick()
  centerOn(design.value, 'instant')
  renderAll()
})

// Carrusel: deslizar cambia de diseño; tocar un botón o una vista previa la centra
const track = ref<HTMLElement | null>(null)
function centerOn(d: ShareDesign, behavior: ScrollBehavior = 'smooth') {
  const box = track.value
  const item = box?.querySelector<HTMLElement>(`[data-design="${d}"]`)
  if (box && item) box.scrollTo({ left: item.offsetLeft - (box.clientWidth - item.offsetWidth) / 2, behavior })
}
function choose(d: ShareDesign) {
  design.value = d
  centerOn(d)
  render(d, format.value)
}
let scrollTimer: ReturnType<typeof setTimeout> | undefined
function onTrackScroll() {
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    const box = track.value
    if (!box) return
    const middle = box.scrollLeft + box.clientWidth / 2
    let best = design.value
    let distance = Infinity
    box.querySelectorAll<HTMLElement>('[data-design]').forEach((el) => {
      const gap = Math.abs(el.offsetLeft + el.offsetWidth / 2 - middle)
      if (gap < distance) {
        distance = gap
        best = el.dataset.design as ShareDesign
      }
    })
    design.value = best
  }, 90)
}

const closeButton = ref<HTMLButtonElement | null>(null)
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}
onMounted(async () => {
  window.addEventListener('keydown', onKey, true)
  await nextTick()
  closeButton.value?.focus()
  renderAll()
})
let closed = false
onBeforeUnmount(() => {
  closed = true
  clearTimeout(scrollTimer)
  window.removeEventListener('keydown', onKey, true)
  Object.values(images.value).forEach((i) => i && URL.revokeObjectURL(i.url))
})

function flash(message: string) {
  notice.value = message
  setTimeout(() => (notice.value = null), 3200)
}

const shared = (method: string) =>
  trackEvent('share', { method, content_type: 'testimonio', item_id: props.testimony.id, diseno: design.value, formato: format.value })

async function shareNative() {
  if (!file.value) return
  try {
    await navigator.share({ files: [file.value], title: title.value, text: text.value })
    shared('compartir_nativo')
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') console.warn('Compartir:', err)
  }
}

function download() {
  if (!current.value || !file.value) return
  const a = document.createElement('a')
  a.href = current.value.url
  a.download = file.value.name
  a.click()
  shared('descargar')
}

async function copy(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value)
    flash(message)
  } catch {
    flash('No se pudo copiar: selecciona el texto a mano.')
  }
}

// Instagram no recibe imágenes desde una página web: se descarga la imagen, se copia el enlace
// (para el sticker «Enlace») y se abre la cámara de historias en el celular
async function toInstagram() {
  if (format.value !== 'story') format.value = 'story'
  await render(design.value, 'story')
  shared('historia_instagram')
  if (canShareFile.value) return shareNative()
  download()
  await copy(link.value, 'Imagen descargada y enlace copiado: súbela a tu historia y agrega el sticker «Enlace».')
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) window.location.href = 'instagram://story-camera'
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" @click.self="emit('close')">
      <section
        class="tm-sheet-in thin-scroll relative max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-2 border-ink bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-brut-lg sm:rounded-[28px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <img :src="STICKERS.hxnf.rosa" alt="" class="pointer-events-none absolute top-4 right-20 w-20 rotate-6" aria-hidden="true" />
        <div class="flex items-center justify-between gap-3">
          <h2 id="share-title" class="text-xl font-black uppercase"><span class="hl-box hl-lime" style="--hl-rot: -1deg">Compartir</span></h2>
          <button ref="closeButton" type="button" class="icon-btn" aria-label="Cerrar" @click="emit('close')">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Formato -->
        <div class="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Formato de la imagen">
          <button type="button" class="chip-toggle justify-center py-2 text-xs" :aria-pressed="format === 'story'" @click="format = 'story'">Historia · 9:16</button>
          <button type="button" class="chip-toggle justify-center py-2 text-xs" :aria-pressed="format === 'post'" @click="format = 'post'">Publicación · 4:5</button>
        </div>

        <!-- Diseño -->
        <div class="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Diseño de la imagen">
          <button
            v-for="d in DESIGNS"
            :key="d.id"
            type="button"
            role="radio"
            class="chip-toggle justify-center py-2 text-xs"
            :aria-checked="design === d.id"
            :aria-pressed="design === d.id"
            @click="choose(d.id)"
          >
            {{ d.label }}
          </button>
        </div>

        <!-- Vistas previas: se desliza para comparar los tres diseños -->
        <div
          ref="track"
          class="no-scrollbar -mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
          :style="{ paddingInline: `calc(50% - ${format === 'story' ? 6.75 : 8.5}rem)` }"
          @scroll.passive="onTrackScroll"
        >
          <button
            v-for="d in DESIGNS"
            :key="d.id"
            type="button"
            :data-design="d.id"
            class="shrink-0 snap-center transition-[opacity,scale] duration-200"
            :class="[format === 'story' ? 'w-[13.5rem]' : 'w-[17rem]', design === d.id ? 'opacity-100' : 'scale-[0.94] opacity-55']"
            :aria-label="`Diseño ${d.label}`"
            @click="choose(d.id)"
          >
            <span
              class="block overflow-hidden rounded-2xl border-2 border-ink bg-fg/5"
              :class="[format === 'story' ? 'aspect-9/16' : 'aspect-4/5', design === d.id ? 'shadow-brut' : '']"
            >
              <img v-if="images[keyOf(d.id, format)]" :src="images[keyOf(d.id, format)]!.url" :alt="`Vista previa: diseño ${d.label}`" class="tm-pop-in size-full object-cover" />
              <span v-else-if="failed[keyOf(d.id, format)]" class="grid size-full place-items-center p-4 text-center text-xs">No pudimos crear esta imagen.</span>
              <span v-else class="grid size-full place-content-center place-items-center gap-2 text-xs font-bold opacity-70" aria-busy="true">
                <span class="size-8 animate-spin rounded-full border-4 border-fg/20 border-t-fg" aria-hidden="true" />
                Armando…
              </span>
            </span>
            <span class="mt-2 block text-center text-xs font-black uppercase">{{ d.label }}</span>
            <span class="block text-center text-[11px] opacity-60">{{ d.hint }}</span>
          </button>
        </div>
        <p class="mt-1 text-center text-[11px] opacity-60">
          {{ photos.length > 1 ? `Con ${Math.min(photos.length, 4)} fotos del testimonio` : photos.length ? 'Con la foto del testimonio' : 'Sin fotos: los diseños en blanco y negro usan una torre eléctrica' }}
        </p>

        <div class="mt-4 grid gap-2">
          <button type="button" class="btn-hxnf btn-pink w-full" :disabled="!current" @click="toInstagram">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
            </svg>
            Historia de Instagram
          </button>
          <button v-if="canShareFile" type="button" class="btn-hxnf btn-ink w-full" @click="shareNative">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
            </svg>
            Compartir imagen y texto
          </button>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="btn-hxnf btn-lime btn-sm" :disabled="!current" @click="download">Descargar</button>
            <button type="button" class="btn-hxnf btn-paper btn-sm" @click="copy(text, 'Texto y enlace copiados.').then(() => shared('copiar_texto'))">Copiar texto</button>
          </div>
          <p v-if="notice" class="rounded-xl border-2 border-black bg-neon-lime px-3 py-2 text-xs font-bold text-black" role="status">{{ notice }}</p>
          <p class="text-[11px] leading-relaxed opacity-60">El enlace lleva a este testimonio en <span class="font-bold">{{ SITE_HOST }}</span>.</p>
        </div>
      </section>
    </div>
  </Teleport>
</template>
