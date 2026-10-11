<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { Testimony } from '@testimonies/types/testimony'
import TestimonyDetail from '@testimonies/components/TestimonyDetail.vue'
import TestimonyListItem from '@testimonies/components/TestimonyListItem.vue'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'

const props = defineProps<{ testimonies: Testimony[]; selected: Testimony | null }>()
const emit = defineEmits<{ select: [id: string | null] }>()

const scroller = ref<HTMLElement | null>(null)
const detail = ref<InstanceType<typeof TestimonyDetail> | null>(null)
const list = ref<HTMLElement | null>(null)

// Al abrir un testimonio: arriba y foco en su título; al volver: foco en su fila de la lista
watch(
  () => props.selected?.id,
  async (id, previousId) => {
    scroller.value?.scrollTo({ top: 0 })
    await nextTick()
    if (id) detail.value?.focusTitle()
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
        <TestimonyDetail ref="detail" :key="selected.id" :testimony="selected" />
      </div>

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
