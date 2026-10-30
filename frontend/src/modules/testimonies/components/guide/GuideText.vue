<script setup lang="ts">
import { computed } from 'vue'

// Texto que viene del Excel: las citas «…» se resaltan y las marcas [INFERENCIA: …] se vuelven un ⓘ con explicación
const props = defineProps<{ text: string }>()

const NOTE = 'Interpretación del equipo, no texto literal de la fuente'

const pieces = computed(() => {
  const out: { kind: 'text' | 'quote' | 'inference'; value: string }[] = []
  const re = /(«[^»]*»)|\[INFERENCIA(?::\s*([^\]]*))?\]/g
  let last = 0
  for (const m of props.text.matchAll(re)) {
    if (m.index > last) out.push({ kind: 'text', value: props.text.slice(last, m.index) })
    out.push(m[1] ? { kind: 'quote', value: m[1] } : { kind: 'inference', value: m[2]?.trim() ? `${NOTE} (${m[2].trim()})` : NOTE })
    last = m.index + m[0].length
  }
  if (last < props.text.length) out.push({ kind: 'text', value: props.text.slice(last) })
  return out
})
</script>

<template>
  <template v-for="(p, i) in pieces" :key="i">
    <q v-if="p.kind === 'quote'" class="font-semibold before:content-none after:content-none">{{ p.value }}</q>
    <abbr v-else-if="p.kind === 'inference'" :title="p.value" class="cursor-help text-fg/60 no-underline"><span aria-hidden="true">ⓘ</span><span class="sr-only">{{ p.value }}</span></abbr>
    <template v-else>{{ p.value }}</template>
  </template>
</template>
