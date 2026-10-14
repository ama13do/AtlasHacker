<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { STICKERS, SITE_HOST, SITE_URL, mascotFor } from '@/core/config/brand'
import { coverFor } from '@testimonies/data/covers'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { renderShareImage, type ShareFormat } from '@testimonies/utils/shareImage'
import type { TestimonyDetail, TestimonySummary } from '@testimonies/types/testimony'

// Compartir un testimonio: imagen lista para publicar (collage con sus fotos o la mascota de la categoría),
// en formato historia (9:16, Instagram/WhatsApp) o publicación (4:5), con la leyenda
// «Este testimonio salió del sitio web atlashacker.hxnf.mx (comparte tu experiencia)» y el enlace al testimonio.
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
  [`«${title.value}»`, `${place.value} · ${date.value}`, '', `Este testimonio salió del sitio web ${SITE_HOST} (comparte tu experiencia):`, link.value].join('\n'),
)

const format = ref<ShareFormat>('story')
const images = ref<Partial<Record<ShareFormat, { blob: Blob; url: string }>>>({})
const loading = ref(false)
const failed = ref(false)
const notice = ref<string | null>(null)

const current = computed(() => images.value[format.value] ?? null)
const file = computed(() =>
  current.value ? new File([current.value.blob], `testimonio-${props.testimony.folio.replace(/\W+/g, '-')}-${format.value}.png`, { type: 'image/png' }) : null,
)
// Compartir nativo con la imagen (celulares): abre la hoja del sistema con Instagram, WhatsApp, etc.
const canShareFile = computed(() => !!file.value && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file.value] }))

async function render(f: ShareFormat) {
  if (images.value[f]) return
  loading.value = true
  failed.value = false
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
        mascotUrl: mascotFor(props.testimony.category),
        coverUrl: coverFor(props.testimony),
        folio: props.testimony.folio,
      },
      f,
    )
    images.value = { ...images.value, [f]: { blob, url: URL.createObjectURL(blob) } }
  } catch (e) {
    console.error(e)
    failed.value = true
  } finally {
    loading.value = false
  }
}
watch(format, render)

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
  render(format.value)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  Object.values(images.value).forEach((i) => i && URL.revokeObjectURL(i.url))
})

function flash(message: string) {
  notice.value = message
  setTimeout(() => (notice.value = null), 3200)
}

async function shareNative() {
  if (!file.value) return
  try {
    await navigator.share({ files: [file.value], title: title.value, text: text.value })
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
  await render('story')
  if (canShareFile.value) return shareNative()
  download()
  await copy(link.value, 'Imagen descargada y enlace copiado: súbela a tu historia y agrega el sticker «Enlace».')
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) window.location.href = 'instagram://story-camera'
}

const enc = encodeURIComponent
const NETWORKS = computed(() => [
  { name: 'WhatsApp', href: `https://wa.me/?text=${enc(text.value)}`, cls: 'bg-neon-green text-black' },
  { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link.value)}`, cls: 'bg-brand-blue text-white' },
  { name: 'X', href: `https://twitter.com/intent/tweet?text=${enc(text.value)}`, cls: 'bg-black text-white' },
  { name: 'Telegram', href: `https://t.me/share/url?url=${enc(link.value)}&text=${enc(text.value)}`, cls: 'bg-brand-pink text-black' },
])
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

        <!-- Vista previa -->
        <div class="mx-auto mt-4 w-full overflow-hidden rounded-2xl border-2 border-ink bg-fg/5" :class="format === 'story' ? 'max-w-[15rem]' : 'max-w-[19rem]'">
          <img v-if="current" :key="current.url" :src="current.url" alt="Vista previa de la imagen para compartir" class="tm-pop-in w-full" />
          <div v-else-if="failed" class="p-6 text-center text-sm">No pudimos crear la imagen. Aún puedes compartir el enlace.</div>
          <div v-else class="grid place-items-center gap-2 text-xs font-bold opacity-70" :class="format === 'story' ? 'aspect-9/16' : 'aspect-4/5'" aria-busy="true">
            <span class="size-8 animate-spin rounded-full border-4 border-fg/20 border-t-fg" aria-hidden="true" />
            Armando tu imagen…
          </div>
        </div>
        <p class="mt-2 text-center text-[11px] opacity-60">
          {{ photos.length > 1 ? `Collage con ${Math.min(photos.length, 4)} fotos del testimonio` : photos.length ? 'Con la foto del testimonio' : 'Sin fotos: va la mascota de la categoría' }}
        </p>

        <div class="mt-4 grid gap-2">
          <button type="button" class="btn-hxnf btn-pink w-full" :disabled="loading || !current" @click="toInstagram">
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
            <button type="button" class="btn-hxnf btn-paper btn-sm" @click="copy(text, 'Texto y enlace copiados.')">Copiar texto</button>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <a v-for="n in NETWORKS" :key="n.name" :href="n.href" target="_blank" rel="noopener noreferrer" class="btn-hxnf btn-sm px-1 text-[11px]" :class="n.cls">{{ n.name }}</a>
          </div>
          <p v-if="notice" class="rounded-xl border-2 border-black bg-neon-lime px-3 py-2 text-xs font-bold text-black" role="status">{{ notice }}</p>
          <p class="text-[11px] leading-relaxed opacity-60">El enlace lleva a este testimonio en <span class="font-bold">{{ SITE_HOST }}</span>.</p>
        </div>
      </section>
    </div>
  </Teleport>
</template>
