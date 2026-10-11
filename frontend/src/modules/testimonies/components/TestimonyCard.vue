<script setup lang="ts">
import type { Testimony } from '@testimonies/types/testimony'
import TestimonyDetail from '@testimonies/components/TestimonyDetail.vue'

defineProps<{ testimony: Testimony }>()
defineEmits<{ close: [] }>()
</script>

<!-- Bottom sheet del testimonio seleccionado (móvil) -->
<template>
  <aside class="flex max-h-[60dvh] flex-col overflow-hidden rounded-t-3xl border-t border-fg/15 bg-surface shadow-2xl">
    <div class="flex justify-center pt-2" aria-hidden="true">
      <span class="h-1 w-10 rounded-full bg-fg/30" />
    </div>

    <div class="overflow-y-auto px-5 pt-3 pb-6 [scrollbar-color:color-mix(in_oklab,var(--fg)_25%,transparent)_transparent] [scrollbar-width:thin]">
      <TestimonyDetail :testimony="testimony">
        <template #actions>
          <button
            type="button"
            class="grid size-9 shrink-0 place-items-center rounded-full bg-fg/10 hover:bg-fg/20 focus-visible:outline-2 focus-visible:outline-fg"
            aria-label="Cerrar testimonio"
            @click="$emit('close')"
          >
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </template>
      </TestimonyDetail>
    </div>
  </aside>
</template>
