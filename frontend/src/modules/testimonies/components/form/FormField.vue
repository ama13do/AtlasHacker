<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  length?: number
  max?: number
}>()

const errorId = computed(() => `${props.id}-error`)
const hintId = computed(() => `${props.id}-hint`)
const describedby = computed(
  () => [props.hint && hintId.value, props.error && errorId.value].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-baseline justify-between gap-3">
      <label :for="id" class="text-sm font-semibold">
        {{ label }}
        <span v-if="optional" class="font-normal text-white/50">(opcional)</span>
      </label>
      <span
        v-if="max !== undefined"
        class="text-xs tabular-nums"
        :class="(length ?? 0) > max ? 'text-brand-orange' : 'text-white/40'"
        aria-hidden="true"
      >
        {{ length ?? 0 }}/{{ max }}
      </span>
    </div>
    <p v-if="hint" :id="hintId" class="text-sm text-white/60">{{ hint }}</p>
    <slot :id="id" :describedby="describedby" :invalid="!!error" />
    <p v-if="error" :id="errorId" class="text-sm text-brand-orange">{{ error }}</p>
  </div>
</template>
