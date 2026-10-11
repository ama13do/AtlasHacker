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
          class="group relative flex w-full items-center gap-3 rounded-xl py-2 pr-3 pl-4 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-white disabled:cursor-default"
          :class="[
            i === step && !done ? 'bg-white/5 font-semibold text-white' : 'text-white/60',
            i <= maxReached && i !== step && !done ? 'hover:bg-white/5 hover:text-white' : '',
            i > maxReached && !done ? 'text-white/30' : '',
          ]"
          :disabled="done || i > maxReached || i === step"
          :aria-current="i === step && !done ? 'step' : undefined"
          @click="$emit('go', i)"
        >
          <!-- Barra del paso actual -->
          <span
            v-if="i === step && !done"
            class="absolute top-2 bottom-2 left-0 w-1 rounded-full bg-neon-lime"
            aria-hidden="true"
          />
          <span
            class="grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums"
            :class="
              done || i < step || (i <= maxReached && i !== step)
                ? 'bg-neon-lime text-black'
                : i === step
                  ? 'border-2 border-neon-lime text-neon-lime'
                  : 'border border-white/20'
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
