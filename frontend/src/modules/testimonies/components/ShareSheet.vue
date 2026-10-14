<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { coverFor } from '@testimonies/data/covers'
import { useCategoriesStore } from '@testimonies/stores/categories'
import { renderShareImage } from '@testimonies/utils/shareImage'
import type { TestimonyDetail, TestimonySummary } from '@testimonies/types/testimony'

const props = defineProps<{ testimony: TestimonySummary; detail: TestimonyDetail | null; mapSlug: string }>()
const emit = defineEmits<{ close: [] }>()

const categories = useCategoriesStore()
const meta = computed(() => categories.bySlug(props.testimony.category))

const site = window.location.origin
const host = computed(() => new URL(site).host)
const link = computed(() => `${site}/mapas/${props.mapSlug}?t=${props.testimony.id}`)

// Texto CTA mejorado y potente
const title = computed(() => props.detail?.title ?? props.testimony.title)
const place = computed(() => props.detail?.place ?? props.testimony.place)
const dateStr = computed(() =>
  new Date(`${props.testimony.date}T00:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
)

const ctaText = computed(() => {
  return [
    `📢 «${title.value}»`,
    `📍 ${place.value} · ${dateStr.value}`,
    '',
    `Este testimonio salió de sitio web ${host.value} (comparte tu experiencia y alza la voz).`,
    '',
    `👉 Lee el caso completo, reacciona y súmate en el mapa interactivo:`,
    link.value,
  ].join('\n')
})

// Texto específico con formato markdown para WhatsApp
const whatsappText = computed(() => {
  return [
    `🔥 *«${title.value}»*`,
    `📍 _${place.value}_ · ${dateStr.value}`,
    '',
    `*Este testimonio salió de sitio web ${host.value}* (¡comparte tu experiencia!)`,
    '',
    `👉 *Lee el caso completo, reacciona y comenta aquí:*`,
    link.value,
  ].join('\n')
})

const blob = ref<Blob | null>(null)
const preview = ref<string | null>(null)
const failed = ref(false)
const copied = ref(false)
const igNotice = ref(false)

const file = computed(() =>
  blob.value
    ? new File([blob.value], `historia-${props.testimony.folio.replace(/\W+/g, '-')}.png`, { type: 'image/png' })
    : null,
)

// Soporte de compartir nativo con imagen y texto
const canShareFile = computed(() => {
  return (
    !!file.value &&
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file.value] })
  )
})

onMounted(async () => {
  window.addEventListener('keydown', onKey, true)
  await nextTick()
  closeButton.value?.focus()

  try {
    blob.value = await renderShareImage({
      title: title.value,
      place: place.value,
      date: dateStr.value,
      category: meta.value.label,
      color: meta.value.color,
      ink: meta.value.ink,
      excerpt: props.detail?.testimony ?? '',
      question: props.detail?.tribunalQuestion,
      photoUrl: props.detail?.files.find((f) => f.mime.startsWith('image/'))?.url ?? null,
      stickerUrl: new URL(coverFor(props.testimony), site).href,
      siteUrl: host.value,
      folio: props.testimony.folio,
    })
    preview.value = URL.createObjectURL(blob.value)
  } catch (e) {
    console.error('Error al generar la imagen de historia:', e)
    failed.value = true
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  if (preview.value) URL.revokeObjectURL(preview.value)
})

const closeButton = ref<HTMLButtonElement | null>(null)
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}

async function shareNative() {
  if (!file.value) return
  try {
    await navigator.share({
      files: [file.value],
      title: title.value,
      text: ctaText.value,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.name !== 'AbortError') {
      console.warn('Error al compartir nativo:', err)
    }
  }
}

function downloadImage() {
  if (!preview.value || !file.value) return
  const a = document.createElement('a')
  a.href = preview.value
  a.download = file.value.name
  a.click()
}

async function copyText() {
  try {
    await navigator.clipboard.writeText(ctaText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2500)
  } catch {
    // Portapapeles no disponible
  }
}

// Botón directo a Instagram / Instagram Stories
async function openInstagram() {
  // 1. Descarga la imagen si está lista para que el usuario la tenga en su galería
  if (preview.value && file.value) {
    downloadImage()
  }
  // 2. Copia el enlace al portapapeles para añadirlo como sticker de enlace en Instagram
  try {
    await navigator.clipboard.writeText(link.value)
  } catch {
    // Ignorar si no hay permiso
  }
  igNotice.value = true

  // 3. Si en móvil soporta compartir archivo y el usuario prefiere compartir directo:
  if (canShareFile.value) {
    try {
      await navigator.share({
        files: [file.value!],
        title: title.value,
        text: link.value,
      })
      return
    } catch {
      // Si cancela, continuar con el intento de abrir la app de Instagram
    }
  }

  // 4. Intentar abrir Instagram Stories vía deep link en móvil, con fallback a web
  setTimeout(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile) {
      window.location.href = 'instagram://story-camera'
      setTimeout(() => {
        window.open('https://www.instagram.com', '_blank')
      }, 1200)
    } else {
      window.open('https://www.instagram.com', '_blank')
    }
  }, 200)
}

// Compartir en WhatsApp descargando también la imagen si es posible
function shareWhatsApp() {
  if (canShareFile.value) {
    shareNative()
    return
  }
  // Descarga la imagen para que el usuario la pueda arrastrar/adjuntar en web
  downloadImage()
  const encText = encodeURIComponent(whatsappText.value)
  window.open(`https://wa.me/?text=${encText}`, '_blank', 'noopener,noreferrer')
}

// Compartir en Telegram
function shareTelegram() {
  if (canShareFile.value) {
    shareNative()
    return
  }
  downloadImage()
  const encUrl = encodeURIComponent(link.value)
  const encText = encodeURIComponent(ctaText.value)
  window.open(`https://t.me/share/url?url=${encUrl}&text=${encText}`, '_blank', 'noopener,noreferrer')
}

// Compartir en Facebook
function shareFacebook() {
  downloadImage()
  const encUrl = encodeURIComponent(link.value)
  const encQuote = encodeURIComponent(ctaText.value)
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encUrl}&quote=${encQuote}`, '_blank', 'noopener,noreferrer')
}

// Compartir en X / Twitter
function shareX() {
  const encText = encodeURIComponent(`«${title.value}» — Este testimonio salió del sitio web ${host.value} (comparte tu experiencia):`)
  const encUrl = encodeURIComponent(link.value)
  window.open(`https://twitter.com/intent/tweet?text=${encText}&url=${encUrl}&hashtags=AtlasHacker,TribunalPopular`, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-3 backdrop-blur-sm sm:p-4" @click.self="emit('close')">
      <section
        class="card-brut-lg thin-scroll max-h-[94dvh] w-full max-w-lg overflow-y-auto p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <div class="flex items-center justify-between gap-3 border-b-2 border-ink pb-3">
          <div>
            <h2 id="share-title" class="text-lg font-black uppercase sm:text-xl">
              <span class="hl-box hl-lime" style="--hl-rot: -1deg">Compartir en redes</span>
            </h2>
            <p class="mt-0.5 text-xs font-semibold opacity-70">Formato Historias 9:16 con la leyenda oficial</p>
          </div>
          <button ref="closeButton" type="button" class="icon-btn size-9" aria-label="Cerrar" @click="emit('close')">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Vista previa de la tarjeta 9:16 -->
        <div class="mt-4 flex flex-col items-center">
          <div class="relative max-h-[380px] w-auto overflow-hidden rounded-[24px] border-3 border-black shadow-[5px_5px_0_0_#000] aspect-[9/16] bg-black">
            <img v-if="preview" :src="preview" alt="Vista previa de la historia para redes" class="size-full object-contain" />
            <div v-else-if="failed" class="grid size-full place-items-center p-6 text-center text-xs font-bold text-white">
              No se pudo renderizar la imagen 9:16. Aún puedes compartir el enlace y texto.
            </div>
            <div v-else class="grid size-full place-items-center text-xs font-bold text-white animate-pulse" aria-busy="true">
              Diseñando historia 9:16…
            </div>
          </div>
          <p class="mt-2 text-center text-[11px] font-bold opacity-60">
            Formato Instagram Stories 9:16 · Incluye foto, extracto y leyenda
          </p>
        </div>

        <!-- Aviso para Instagram -->
        <Transition enter-from-class="opacity-0 scale-95" enter-active-class="transition duration-150" leave-to-class="opacity-0">
          <div v-if="igNotice" class="mt-3 rounded-2xl border-2 border-black bg-neon-lime p-3 text-xs font-bold text-black shadow-[3px_3px_0_0_#000]">
            <p class="font-black uppercase">¡Imagen descargada y enlace copiado!</p>
            <p class="mt-1 font-semibold">
              1. En Instagram abre Tu Historia.
              <br />
              2. Elige la imagen guardada en tu galería.
              <br />
              3. Toca el ícono de stickers y pega el enlace con la opción «Enlace».
            </p>
          </div>
        </Transition>

        <!-- Texto CTA listo -->
        <div class="mt-3">
          <p class="text-[11px] font-black tracking-wider uppercase opacity-75">Texto y leyenda a compartir:</p>
          <div class="mt-1 max-h-24 overflow-y-auto rounded-xl border-2 border-dashed border-ink/40 bg-fg/5 p-2.5 text-xs leading-relaxed whitespace-pre-line select-all">
            {{ ctaText }}
          </div>
        </div>

        <!-- Botones de acción principales -->
        <div class="mt-4 space-y-2.5">
          <!-- Compartir nativo (con archivo) -->
          <button
            v-if="canShareFile"
            type="button"
            class="btn-hxnf btn-ink w-full py-2.5 text-sm font-black shadow-[3px_3px_0_0_#e0fa49]"
            @click="shareNative"
          >
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
            </svg>
            Compartir imagen y texto (Nativo)
          </button>

          <!-- Botón directo a Instagram Stories -->
          <button
            type="button"
            class="btn-hxnf w-full py-2.5 text-sm font-black text-white shadow-[3px_3px_0_0_#000] transition hover:-translate-y-0.5"
            style="background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);"
            :disabled="!preview"
            @click="openInstagram"
          >
            <svg viewBox="0 0 24 24" class="size-4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
            Publicar en Instagram Stories
          </button>

          <!-- Redes Sociales directas mejoradas con texto y descarga -->
          <div class="grid grid-cols-4 gap-2">
            <button
              type="button"
              class="btn-hxnf btn-sm flex items-center justify-center gap-1 bg-[#25D366] px-1 text-xs font-black text-black hover:-translate-y-0.5"
              title="Compartir en WhatsApp (texto enriquecido e imagen)"
              @click="shareWhatsApp"
            >
              WhatsApp
            </button>
            <button
              type="button"
              class="btn-hxnf btn-sm flex items-center justify-center gap-1 bg-[#0088cc] px-1 text-xs font-black text-white hover:-translate-y-0.5"
              title="Compartir en Telegram"
              @click="shareTelegram"
            >
              Telegram
            </button>
            <button
              type="button"
              class="btn-hxnf btn-sm flex items-center justify-center gap-1 bg-[#1877F2] px-1 text-xs font-black text-white hover:-translate-y-0.5"
              title="Compartir en Facebook"
              @click="shareFacebook"
            >
              Facebook
            </button>
            <button
              type="button"
              class="btn-hxnf btn-sm flex items-center justify-center gap-1 bg-black px-1 text-xs font-black text-white hover:-translate-y-0.5"
              title="Compartir en X"
              @click="shareX"
            >
              X
            </button>
          </div>

          <!-- Utilidades: Descargar imagen 9:16 y Copiar enlace -->
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              class="btn-hxnf btn-lime btn-sm py-2"
              :disabled="!preview"
              @click="downloadImage"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Descargar 9:16
            </button>
            <button
              type="button"
              class="btn-hxnf btn-paper btn-sm py-2 text-black"
              @click="copyText"
            >
              {{ copied ? '¡Copiado! ✓' : 'Copiar texto y link' }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
