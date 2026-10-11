<script setup lang="ts">
import { computed, ref } from 'vue'

const COUNTER_THRESHOLD = 0.8

const props = defineProps<{
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  optional?: boolean
  length?: number
  max?: number
}>()

const errorId = computed(() => `${props.id}-error`)
const hintId = computed(() => `${props.id}-hint`)
const describedby = computed(
  () => [props.hint && hintId.value, props.error && errorId.value].filter(Boolean).join(' ') || undefined,
)

// El contador solo aparece al escribir o cerca del límite, para reducir ruido
const focused = ref(false)
const showCounter = computed(
  () => props.max !== undefined && (focused.value || (props.length ?? 0) >= props.max * COUNTER_THRESHOLD),
)
</script>

<template>
  <div class="space-y-1.5" @focusin="focused = true" @focusout="focused = false">
    <div class="flex items-baseline justify-between gap-3">
      <label :for="id" class="text-sm font-semibold text-fg">
        {{ label }}
        <span v-if="required" class="text-accent-ink" aria-hidden="true">*</span>
        <span v-else-if="optional" class="text-xs font-normal text-fg/40">(opcional)</span>
      </label>
      <span
        v-if="showCounter"
        class="text-xs tabular-nums"
        :class="(length ?? 0) >= (max ?? 0) ? 'text-danger' : 'text-fg/40'"
        aria-hidden="true"
      >
        {{ length ?? 0 }}/{{ max }}
      </span>
    </div>
    <p v-if="hint" :id="hintId" class="text-xs text-fg/50">{{ hint }}</p>
    <slot :id="id" :describedby="describedby" :invalid="!!error" />
    <p v-if="error" :id="errorId" class="text-sm text-danger">{{ error }}</p>
  </div>
</template>
