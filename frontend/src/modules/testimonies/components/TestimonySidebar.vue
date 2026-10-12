<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { LoadStatus } from '@testimonies/stores/testimonies'
import type { TestimonyDetail as Detail, TestimonySummary } from '@testimonies/types/testimony'
import FeedNotice from '@testimonies/components/FeedNotice.vue'
import TestimonyDetail from '@testimonies/components/TestimonyDetail.vue'
import TestimonyListItem from '@testimonies/components/TestimonyListItem.vue'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'

const props = defineProps<{
  testimonies: TestimonySummary[]
  status: LoadStatus
  selected: TestimonySummary | null
  detail: Detail | null
  detailStatus?: LoadStatus
}>()
const emit = defineEmits<{ select: [id: string | null]; retry: []; retryDetail: [] }>()

const scroller = ref<HTMLElement | null>(null)
const detailView = ref<InstanceType<typeof TestimonyDetail> | null>(null)
const list = ref<HTMLElement | null>(null)

// Al abrir un testimonio: arriba y foco en su título; al volver: foco en su fila de la lista
watch(
  () => props.selected?.id,
  async (id, previousId) => {
    scroller.value?.scrollTo({ top: 0 })
    await nextTick()
    if (id) detailView.value?.focusTitle()
    else if (previousId) list.value?.querySelector<HTMLElement>(`[data-id="${previousId}"] button`)?.focus()
  },
)
</script>

<template>
  <aside class="flex h-full flex-col bg-surface" aria-label="Testimonios">
    <header class="flex items-center justify-between gap-3 border-b border-fg/10 px-5 py-4">
      <div>
        <h1 class="text-lg font-semibold tracking-tight">
          AtlasHacker<span class="text-neon-green light:text-fg">_</span>
        </h1>
        <p class="text-xs text-fg/50">Tribunal Popular · FUTURO/001</p>
      </div>
      <ThemeToggle />
    </header>

    <div
      ref="scroller"
      class="flex-1 overflow-y-auto [scrollbar-color:color-mix(in_oklab,var(--fg)_25%,transparent)_transparent] [scrollbar-width:thin]"
    >
      <!-- Detalle del testimonio seleccionado -->
      <div v-if="selected" class="px-5 py-4">
        <button
          type="button"
          class="mb-4 inline-flex items-center gap-1.5 rounded-full py-1 pr-3 text-sm text-fg/70 transition hover:text-fg focus-visible:outline-2 focus-visible:outline-fg"
          @click="emit('select', null)"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Todos los testimonios
        </button>
        <TestimonyDetail
          ref="detailView"
          :key="selected.id"
          :testimony="selected"
          :detail="detail"
          :status="detailStatus"
          @retry="emit('retryDetail')"
        />
      </div>

      <!-- Cargando -->
      <ul v-else-if="status === 'loading' || status === 'idle'" class="space-y-1 px-3 py-4" aria-label="Cargando testimonios">
        <li v-for="n in 6" :key="n" class="flex gap-3 px-3 py-3" aria-hidden="true">
          <span class="size-9 shrink-0 animate-pulse rounded-full bg-fg/10" />
          <span class="flex-1 space-y-2">
            <span class="block h-3 w-4/5 animate-pulse rounded-full bg-fg/10" />
            <span class="block h-3 w-1/2 animate-pulse rounded-full bg-fg/10" />
          </span>
        </li>
      </ul>

      <FeedNotice v-else-if="status === 'error'" kind="error" class="mt-8" @retry="emit('retry')" />
      <FeedNotice v-else-if="!testimonies.length" kind="empty" class="mt-8" />

      <!-- Lista -->
      <div v-else class="px-3 py-4">
        <h2 class="mb-2 flex items-baseline justify-between px-2 text-sm font-semibold">
          Testimonios
          <span class="text-xs font-normal text-fg/50">{{ testimonies.length }}</span>
        </h2>
        <ul ref="list" class="space-y-1">
          <li v-for="t in testimonies" :key="t.id" :data-id="t.id">
            <TestimonyListItem :testimony="t" @select="emit('select', $event)" />
          </li>
        </ul>
      </div>
    </div>

    <footer class="border-t border-fg/10 p-4">
      <RouterLink
        :to="{ name: 'testimony-new' }"
        class="flex w-full items-center justify-center gap-2 rounded-full bg-neon-lime py-3 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Subir testimonio
      </RouterLink>
    </footer>
  </aside>
</template>
