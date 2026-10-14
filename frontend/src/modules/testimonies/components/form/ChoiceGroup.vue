<script setup lang="ts" generic="T extends string | boolean">
import { computed, useId } from 'vue'
import FieldHelp from '@testimonies/components/form/FieldHelp.vue'

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
  help?: string
  example?: string
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
      2: 'grid-cols-1 @xl:grid-cols-2',
      3: 'grid-cols-2 @xl:grid-cols-3',
      4: 'grid-cols-2 @xl:grid-cols-3 @3xl:grid-cols-4',
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
    <legend class="mb-1.5 text-sm font-bold text-fg">
      {{ label }}
      <span v-if="required" class="text-accent-ink" aria-hidden="true">*</span>
    </legend>
    <p v-if="hint" class="mb-1.5 text-xs text-fg/60">{{ hint }}</p>
    <FieldHelp v-if="help || example" :help="help" :example="example" class="mb-2" />
    <div class="grid gap-2" :class="gridClass">
      <label
        v-for="option in options"
        :key="String(option.value)"
        class="relative flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-3.5 py-2.5 transition-[translate,box-shadow,background-color] has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-blue"
        :class="[
          isChecked(option.value) ? '-translate-y-px border-ink bg-neon-lime text-black shadow-brut-sm' : 'border-ink/30 bg-card hover:border-ink',
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
            isChecked(option.value) ? 'border-black bg-black text-neon-lime' : 'border-ink/50',
          ]"
          aria-hidden="true"
        >
          <svg v-if="isChecked(option.value)" viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-semibold">{{ option.label }}</span>
          <span v-if="option.description" class="block text-xs opacity-70">{{ option.description }}</span>
        </span>
      </label>
    </div>
    <p v-if="error" :id="errorId" class="text-sm text-danger">{{ error }}</p>
  </fieldset>
</template>
