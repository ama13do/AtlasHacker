<script setup lang="ts">
import { STEPS } from '@testimonies/composables/useTestimonyForm'

defineProps<{ step: number; maxReached: number; done?: boolean }>()
defineEmits<{ go: [step: number] }>()
</script>

<template>
  <nav aria-label="Pasos del testimonio">
    <ol class="space-y-1">
      <li v-for="(item, i) in STEPS" :key="item.title">
        <button
          type="button"
          class="group relative flex w-full items-center gap-3 rounded-full border-2 py-1.5 pr-3 pl-1.5 text-left text-sm transition focus-visible:outline-3 focus-visible:outline-brand-blue disabled:cursor-default"
          :class="[
            i === step && !done ? 'border-ink bg-card font-bold text-fg shadow-brut-sm' : 'border-transparent text-fg/65',
            i <= maxReached && i !== step && !done ? 'hover:border-ink/40 hover:text-fg' : '',
            i > maxReached && !done ? 'text-fg/30' : '',
          ]"
          :disabled="done || i > maxReached || i === step"
          :aria-current="i === step && !done ? 'step' : undefined"
          @click="$emit('go', i)"
        >
          <!-- Barra del paso actual -->
          <span
            class="grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-black tabular-nums"
            :class="
              done || i < step || (i <= maxReached && i !== step)
                ? 'border-black bg-neon-green text-black'
                : i === step
                  ? 'border-black bg-neon-lime text-black'
                  : 'border-ink/25'
            "
            aria-hidden="true"
          >
            <svg v-if="done || i < step || (i <= maxReached && i !== step)" viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5 12 5 5 9-10" />
            </svg>
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span class="leading-tight">{{ item.title }}</span>
        </button>
      </li>
    </ol>
  </nav>
</template>
