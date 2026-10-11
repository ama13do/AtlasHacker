<script setup lang="ts" generic="T extends string | boolean">
import { computed, useId } from 'vue'

export interface Choice<V> {
  value: V
  label: string
  description?: string
  disabled?: boolean
}

const props = defineProps<{
  label: string
  options: Choice<T>[]
  multiple?: boolean
  error?: string
  hint?: string
  columns?: 1 | 2 | 3 | 4
  required?: boolean
}>()

// Un valor (radio) o varios (checkbox)
const model = defineModel<T | T[] | null>({ required: true })

const name = useId()
const errorId = `${name}-error`

const gridClass = computed(
  () =>
    ({
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-2 sm:grid-cols-3',
      4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    })[props.columns ?? 2],
)

function isChecked(value: T) {
  return props.multiple ? (model.value as T[]).includes(value) : model.value === value
}

function toggle(value: T) {
  if (!props.multiple) {
    model.value = value
    return
  }
  const current = model.value as T[]
  model.value = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}
</script>

<template>
  <fieldset class="space-y-1.5" :aria-describedby="error ? errorId : undefined">
    <legend class="mb-1.5 text-sm font-semibold text-fg">
      {{ label }}
      <span v-if="required" class="text-accent-ink" aria-hidden="true">*</span>
    </legend>
    <p v-if="hint" class="mb-1.5 text-xs text-fg/50">{{ hint }}</p>
    <div class="grid gap-2" :class="gridClass">
      <label
        v-for="option in options"
        :key="String(option.value)"
        class="relative flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-fg"
        :class="[
          isChecked(option.value) ? 'border-neon-lime bg-neon-lime/10 light:border-fg light:bg-neon-lime/35' : 'border-fg/20 hover:border-fg/40',
          option.disabled && 'cursor-not-allowed opacity-40',
        ]"
      >
        <input
          :type="multiple ? 'checkbox' : 'radio'"
          :name="name"
          class="sr-only"
          :checked="isChecked(option.value)"
          :disabled="option.disabled"
          @change="toggle(option.value)"
        />
        <span
          class="mt-0.5 grid size-5 shrink-0 place-items-center border-2 transition"
          :class="[
            multiple ? 'rounded-md' : 'rounded-full',
            isChecked(option.value) ? 'border-neon-lime bg-neon-lime text-black' : 'border-fg/40',
          ]"
          aria-hidden="true"
        >
          <svg v-if="isChecked(option.value)" viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-semibold">{{ option.label }}</span>
          <span v-if="option.description" class="block text-xs text-fg/60">{{ option.description }}</span>
        </span>
      </label>
    </div>
    <p v-if="error" :id="errorId" class="text-sm text-danger">{{ error }}</p>
  </fieldset>
</template>
