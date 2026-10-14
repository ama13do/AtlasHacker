<script setup lang="ts">
import { ref } from 'vue'
import type { LoadStatus } from '@testimonies/stores/testimonies'
import type { TestimonyDetail as Detail, TestimonySummary } from '@testimonies/types/testimony'
import TestimonyDetail from '@testimonies/components/TestimonyDetail.vue'

defineProps<{
  testimony: TestimonySummary
  detail: Detail | null
  status?: LoadStatus
  openComments?: boolean
}>()
const emit = defineEmits<{ close: []; retry: []; 'comments-focused': [] }>()

const detailRef = ref<InstanceType<typeof TestimonyDetail> | null>(null)
defineExpose({
  focusComments: () => detailRef.value?.focusComments(),
})
</script>

<!-- Bottom sheet del testimonio seleccionado (móvil) -->
<template>
  <aside class="flex max-h-[62dvh] flex-col overflow-hidden rounded-t-[28px] border-t-2 border-ink bg-surface shadow-[0_-5px_0_0_var(--shadow-c)]">
    <div class="flex justify-center pt-2" aria-hidden="true">
      <span class="h-1.5 w-12 rounded-full bg-fg/40" />
    </div>

    <div class="thin-scroll overflow-y-auto px-5 pt-3 pb-6">
      <TestimonyDetail
        ref="detailRef"
        :testimony="testimony"
        :detail="detail"
        :status="status"
        :open-comments="openComments"
        @retry="$emit('retry')"
        @comments-focused="emit('comments-focused')"
      >
        <template #actions>
          <button
            type="button"
            class="icon-btn size-9"
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
