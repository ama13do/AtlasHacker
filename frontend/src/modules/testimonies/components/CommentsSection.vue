<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { ApiError } from '@/core/http/client'
import TurnstileWidget from '@/shared/components/TurnstileWidget.vue'
import { useComments } from '@testimonies/composables/useComments'
import { useParticipantFolio } from '@testimonies/composables/useParticipantFolio'
import { useCategoriesStore } from '@testimonies/stores/categories'
import type { Comment } from '@testimonies/types/testimony'

const MAX_LENGTH = 2000
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

const props = defineProps<{ testimonyId: string; count: number }>()

const categories = useCategoriesStore()
const enabled = computed(() => categories.config?.commentsEnabled ?? true)
const captchaRequired = computed(() => categories.config?.captchaRequired ?? true)

const comments = useComments(props.testimonyId)
const { items, cursor, status, loadingMore } = comments
const { active: folio } = useParticipantFolio()

// Se cargan al abrir la sección, no al abrir la ficha
const open = ref(false)
function toggleOpen() {
  open.value = !open.value
  if (open.value && status.value === 'idle') comments.load()
}

// Formulario
const ids = { text: useId(), author: useId() }
const text = ref('')
const author = ref('')
const sending = ref(false)
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

// El captcha se carga cuando la persona empieza a escribir
const captcha = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const showCaptcha = ref(false)
const captchaToken = ref<string | null>(null)
const captchaUnavailable = ref(!SITE_KEY)
const canSend = computed(
  () => !!text.value.trim() && !sending.value && (!captchaRequired.value || (!!captchaToken.value && !captchaUnavailable.value)),
)

function onCaptchaError() {
  captchaToken.value = null
  captchaUnavailable.value = true
}

async function send() {
  if (!canSend.value) return
  sending.value = true
  notice.value = null
  try {
    const visible = await comments.add(
      { text: text.value, author: author.value },
      { captchaToken: captchaToken.value, folio: folio.value },
    )
    text.value = ''
    notice.value = visible
      ? { kind: 'ok', text: 'Tu comentario se publicó.' }
      : { kind: 'ok', text: 'Gracias. Tu comentario se publicará cuando lo revisemos.' }
  } catch (error) {
    const e = error as Partial<ApiError>
    const message =
      e.code === 'CAPTCHA_INVALIDO'
        ? 'La verificación expiró. Vuelve a verificar e intenta de nuevo.'
        : e.status === 429
          ? 'Has enviado demasiados comentarios. Intenta más tarde.'
          : e.status === 403
            ? 'Los comentarios están desactivados por ahora.'
            : (e.message ?? 'No pudimos publicar tu comentario.')
    notice.value = { kind: 'error', text: message }
  } finally {
    sending.value = false
    captchaToken.value = null
    captcha.value?.reset()
  }
}

const relative = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]
function ago(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'hace un momento'
}

function likeLabel(c: Comment) {
  return `${c.likedByMe ? 'Quitar me gusta' : 'Me gusta'} (${c.likes})`
}
</script>

<template>
  <section v-if="enabled" class="border-t border-fg/10 pt-4" aria-label="Comentarios">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 rounded-xl py-1 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-fg"
      :aria-expanded="open"
      @click="toggleOpen"
    >
      <span>Comentarios <span class="font-normal text-fg/50">({{ count }})</span></span>
      <svg viewBox="0 0 24 24" class="size-4 transition" :class="{ 'rotate-180': open }" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div v-if="open" class="mt-3 space-y-4">
      <!-- Lista -->
      <div v-if="status === 'loading'" class="space-y-3" aria-hidden="true">
        <div v-for="n in 2" :key="n" class="space-y-1.5">
          <span class="block h-3 w-24 animate-pulse rounded-full bg-fg/10" />
          <span class="block h-3 w-full animate-pulse rounded-full bg-fg/10" />
        </div>
      </div>
      <div v-else-if="status === 'error'" class="flex items-center gap-3 text-sm" role="alert">
        <span class="text-fg/70">No pudimos cargar los comentarios.</span>
        <button type="button" class="font-semibold text-accent-ink hover:underline" @click="comments.load">Reintentar</button>
      </div>
      <p v-else-if="!items.length" class="text-sm text-fg/50">Aún no hay comentarios. Sé la primera persona en comentar.</p>
      <ul v-else class="space-y-3">
        <li v-for="c in items" :key="c.id" class="space-y-1 rounded-xl bg-fg/[0.04] px-3 py-2.5">
          <p class="flex items-baseline justify-between gap-3 text-xs">
            <span class="font-semibold">{{ c.author ?? 'Anónimo' }}</span>
            <time :datetime="c.createdAt" class="shrink-0 text-fg/50">{{ ago(c.createdAt) }}</time>
          </p>
          <p class="text-sm whitespace-pre-line text-fg/85">{{ c.text }}</p>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs transition focus-visible:outline-2 focus-visible:outline-fg"
            :class="c.likedByMe ? 'font-semibold text-accent-ink' : 'text-fg/50 hover:text-fg'"
            :aria-pressed="c.likedByMe"
            :aria-label="likeLabel(c)"
            @click="comments.toggleLike(c)"
          >
            <svg viewBox="0 0 24 24" class="size-3.5" :fill="c.likedByMe ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
            </svg>
            <span class="tabular-nums">{{ c.likes }}</span>
          </button>
        </li>
      </ul>
      <button
        v-if="cursor"
        type="button"
        class="text-sm font-semibold text-accent-ink hover:underline disabled:opacity-50"
        :disabled="loadingMore"
        @click="comments.loadMore"
      >
        {{ loadingMore ? 'Cargando…' : 'Ver más comentarios' }}
      </button>

      <!-- Nuevo comentario -->
      <form class="space-y-2" @submit.prevent="send">
        <label :for="ids.text" class="sr-only">Escribe un comentario</label>
        <textarea
          :id="ids.text"
          v-model="text"
          rows="3"
          :maxlength="MAX_LENGTH"
          class="field-input resize-y text-sm"
          placeholder="Escribe un comentario respetuoso…"
          @focus="showCaptcha = true"
        />
        <div class="flex flex-wrap items-center gap-2">
          <label :for="ids.author" class="sr-only">Tu nombre (opcional)</label>
          <input
            :id="ids.author"
            v-model="author"
            type="text"
            maxlength="100"
            class="field-input min-w-0 flex-1 text-sm md:py-2"
            placeholder="Tu nombre (opcional)"
            autocomplete="name"
          />
          <span class="text-xs text-fg/40 tabular-nums">{{ text.length }}/{{ MAX_LENGTH }}</span>
        </div>

        <template v-if="showCaptcha && captchaRequired">
          <p v-if="captchaUnavailable" class="text-xs text-fg/60" role="alert">
            La verificación anti-spam no está disponible en este sitio; por ahora no se puede comentar.
          </p>
          <TurnstileWidget
            v-else
            ref="captcha"
            :site-key="SITE_KEY!"
            @token="captchaToken = $event"
            @expired="captchaToken = null"
            @error="onCaptchaError"
          />
        </template>

        <div class="flex items-center justify-between gap-3">
          <p v-if="notice" role="status" class="text-xs" :class="notice.kind === 'error' ? 'text-danger' : 'text-fg/60'">
            {{ notice.text }}
          </p>
          <button
            type="submit"
            class="ml-auto rounded-full bg-fg px-4 py-2 text-sm font-semibold text-surface transition hover:bg-neon-lime hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-40 disabled:hover:bg-fg disabled:hover:text-surface"
            :disabled="!canSend"
          >
            {{ sending ? 'Publicando…' : 'Publicar' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
