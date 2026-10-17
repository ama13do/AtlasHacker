<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'

// Visor de PDF propio (pdf.js): se ve igual en cualquier navegador. Dentro de la página, Android no muestra PDF
// (lo descarga o queda en blanco) y el iPhone solo enseña la primera hoja. Las páginas se dibujan al acercarse a
// la vista y la librería solo se descarga cuando alguien abre un PDF (build «legacy»: funciona en celulares viejos)
const props = defineProps<{ url: string; name: string }>()

const ZOOMS = [1, 1.5, 2, 3]
// Tope de píxeles por página: iOS no dibuja lienzos más grandes (~16 M) y la memoria del celular se agota
const MAX_PIXELS = 12_000_000

const status = ref<'loading' | 'ready' | 'error'>('loading')
const ratios = ref<number[]>([]) // alto/ancho de cada página (reserva su espacio antes de dibujarla)
const current = ref(1)
const zoom = ref(1)
const scroller = ref<HTMLElement | null>(null)

let task: PDFDocumentLoadingTask | null = null
let doc: PDFDocumentProxy | null = null
let observer: IntersectionObserver | null = null
const canvases = new Map<number, HTMLCanvasElement>()
const visible = new Set<number>()
const drawn = new Map<number, number>() // página → ancho (px) con que se dibujó
const rendering = new Map<number, RenderTask>()

async function loadLibrary() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  }
  return pdfjs
}

async function open() {
  status.value = 'loading'
  try {
    const pdfjs = await loadLibrary()
    // Descarga simple (sin pedir por rangos): el CORS de R2 solo permite GET con Content-Type
    task = pdfjs.getDocument({ url: props.url, disableRange: true, disableStream: true })
    doc = await task.promise
    const sizes: number[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const vp = (await doc.getPage(i)).getViewport({ scale: 1 })
      sizes.push(vp.height / vp.width)
    }
    ratios.value = sizes
    status.value = 'ready'
    await nextTick()
    observe()
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortException') return
    console.error('PDF: no se pudo abrir', e)
    status.value = 'error'
  }
}

function setCanvas(el: unknown, page: number) {
  if (el instanceof HTMLCanvasElement) canvases.set(page, el)
  else canvases.delete(page)
}

function observe() {
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const page = Number((entry.target as HTMLElement).dataset.page)
        if (entry.isIntersecting) visible.add(page)
        else visible.delete(page)
      }
      drawVisible()
    },
    { root: scroller.value, rootMargin: '600px 0px' },
  )
  scroller.value?.querySelectorAll('[data-page]').forEach((el) => observer!.observe(el))
}

function drawVisible() {
  for (const page of visible) draw(page)
}

async function draw(page: number) {
  const canvas = canvases.get(page)
  if (!doc || !canvas) return
  const cssWidth = canvas.clientWidth
  if (!cssWidth || drawn.get(page) === cssWidth) return
  drawn.set(page, cssWidth)
  rendering.get(page)?.cancel()
  try {
    const pdfPage = await doc.getPage(page)
    const base = pdfPage.getViewport({ scale: 1 })
    let scale = (cssWidth / base.width) * (window.devicePixelRatio || 1)
    scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (base.width * base.height)))
    const viewport = pdfPage.getViewport({ scale })
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const job = pdfPage.render({ canvas, viewport })
    rendering.set(page, job)
    await job.promise
  } catch (e) {
    if ((e as { name?: string }).name !== 'RenderingCancelledException') {
      console.error('PDF: no se pudo dibujar la página', page, e)
      drawn.delete(page)
    }
  } finally {
    rendering.delete(page)
  }
}

// Página actual: la que ocupa el tercio superior de la vista
function onScroll() {
  const box = scroller.value
  if (!box) return
  const line = box.getBoundingClientRect().top + box.clientHeight / 3
  for (const el of box.querySelectorAll<HTMLElement>('[data-page]')) {
    if (el.getBoundingClientRect().bottom > line) {
      current.value = Number(el.dataset.page)
      break
    }
  }
}

// Al cambiar el zoom o el tamaño de la ventana, las páginas a la vista se vuelven a dibujar nítidas
async function redraw() {
  await nextTick()
  drawVisible()
}
watch(zoom, async (next, before) => {
  const box = scroller.value
  const keep = box ? box.scrollTop / Math.max(1, box.scrollHeight) : 0
  await nextTick()
  if (box) box.scrollTop = keep * box.scrollHeight
  if (next !== before) redraw()
})

function step(delta: number) {
  const i = ZOOMS.indexOf(zoom.value) + delta
  if (i >= 0 && i < ZOOMS.length) zoom.value = ZOOMS[i]!
}

let resizeTimer: ReturnType<typeof setTimeout> | undefined
function onResize() {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(redraw, 200)
}

watch(
  () => props.url,
  () => {
    close()
    open()
  },
)

function close() {
  observer?.disconnect()
  for (const job of rendering.values()) job.cancel()
  rendering.clear()
  drawn.clear()
  visible.clear()
  task?.destroy()
  task = null
  doc = null
  ratios.value = []
  current.value = 1
}

onMounted(() => {
  open()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  close()
  window.removeEventListener('resize', onResize)
  clearTimeout(resizeTimer)
})
</script>

<template>
  <div class="flex size-full max-w-4xl flex-col overflow-hidden rounded-xl border-2 border-white bg-neutral-300">
    <div ref="scroller" class="min-h-0 flex-1 overflow-auto overscroll-contain p-2 sm:p-4" @scroll.passive="onScroll">
      <p v-if="status === 'loading'" class="grid h-full place-items-center text-sm font-bold text-black" role="status">Abriendo PDF…</p>
      <div v-else-if="status === 'error'" class="grid h-full place-items-center p-4 text-center text-black" role="alert">
        <div class="space-y-3">
          <p class="font-bold">No pudimos mostrar este PDF aquí.</p>
          <a :href="url" target="_blank" rel="noopener noreferrer" class="btn-hxnf btn-ink btn-sm">Abrir o descargar</a>
        </div>
      </div>
      <div v-else class="mx-auto space-y-3" :style="{ width: `${zoom * 100}%` }">
        <div
          v-for="(ratio, i) in ratios"
          :key="i"
          :data-page="i + 1"
          class="bg-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
          :style="{ aspectRatio: `1 / ${ratio}` }"
        >
          <canvas :ref="(el) => setCanvas(el, i + 1)" class="block size-full" :aria-label="`Página ${i + 1} de ${ratios.length}`" role="img" />
        </div>
      </div>
    </div>
    <div class="flex items-center gap-2 bg-black px-3 py-2 text-xs text-white">
      <span v-if="status === 'ready'" class="font-bold tabular-nums" aria-live="polite">Página {{ current }} de {{ ratios.length }}</span>
      <span class="ml-auto flex items-center gap-1" role="group" aria-label="Tamaño">
        <button type="button" class="grid size-8 place-items-center rounded-full border border-white/60 text-base font-black disabled:opacity-30" :disabled="zoom === ZOOMS[0]" aria-label="Alejar" @click="step(-1)">−</button>
        <span class="w-11 text-center tabular-nums">{{ Math.round(zoom * 100) }}%</span>
        <button type="button" class="grid size-8 place-items-center rounded-full border border-white/60 text-base font-black disabled:opacity-30" :disabled="zoom === ZOOMS[ZOOMS.length - 1]" aria-label="Acercar" @click="step(1)">+</button>
      </span>
      <a :href="url" target="_blank" rel="noopener noreferrer" class="ml-2 font-bold underline" :download="name">Descargar</a>
    </div>
  </div>
</template>
