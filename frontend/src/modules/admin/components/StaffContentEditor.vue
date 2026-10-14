<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { useCategoriesStore } from '@/modules/testimonies'
import { adminTestimoniesService } from '@admin/services/testimonies.service'
import type { ApiEditarTestimonioStaff, ApiTestimonioStaff } from '@admin/types/api'

// Edición de la ficha por el equipo (cada cambio queda en la bitácora con antes y después)
const props = defineProps<{ testimony: ApiTestimonioStaff }>()
const emit = defineEmits<{ saved: [testimony: ApiTestimonioStaff]; cancel: [] }>()

const categories = useCategoriesStore()

type Field = Exclude<keyof ApiEditarTestimonioStaff, 'notas_internas' | 'ubicacion_aproximada'>
const FIELDS: { key: Field; label: string; rows?: number; max: number }[] = [
  { key: 'titulo', label: 'Título', max: 200 },
  { key: 'lugar_territorio', label: 'Lugar / territorio', max: 300 },
  { key: 'municipio', label: 'Municipio', max: 120 },
  { key: 'entidad', label: 'Entidad', max: 100 },
  { key: 'relato', label: 'El testimonio', rows: 6, max: 10000 },
  { key: 'territorio_dice', label: '02 · El territorio dice', rows: 3, max: 5000 },
  { key: 'comunidad_dice', label: '03 · La comunidad dice', rows: 3, max: 5000 },
  { key: 'dato_fuente_anio', label: '04 · Los datos dicen (datos)', rows: 3, max: 5000 },
  { key: 'pregunta_tribunal', label: '05 · La pregunta del Tribunal', rows: 2, max: 5000 },
  { key: 'algo_mas', label: 'Algo más que el Tribunal deba conocer', rows: 2, max: 5000 },
  { key: 'registro_voz', label: 'Cómo quiere que quede registrada su voz (interno)', rows: 2, max: 2000 },
]

const initial = () => ({
  categoria: props.testimony.categoria?.slug ?? '',
  ...Object.fromEntries(FIELDS.map((f) => [f.key, (props.testimony[f.key as keyof ApiTestimonioStaff] as string | null) ?? ''])),
}) as Record<Field, string>

const form = reactive(initial())
const saving = ref(false)
const error = ref<string | null>(null)

const changes = computed(() => {
  const start = initial()
  return Object.fromEntries(Object.entries(form).filter(([k, v]) => v.trim() !== (start[k as Field] ?? '').trim()).map(([k, v]) => [k, v.trim()])) as ApiEditarTestimonioStaff
})
const dirty = computed(() => Object.keys(changes.value).length > 0)

async function save() {
  if (!dirty.value) return emit('cancel')
  if ('relato' in changes.value && (changes.value.relato?.length ?? 0) < 10) {
    error.value = 'El testimonio necesita al menos 10 caracteres.'
    return
  }
  saving.value = true
  error.value = null
  try {
    emit('saved', await adminTestimoniesService.update(props.testimony.id, changes.value))
  } catch (e) {
    error.value = (e as Partial<ApiError>).message ?? 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="save">
    <div class="space-y-1.5">
      <label for="ed-categoria" class="text-sm font-semibold">Categoría</label>
      <select id="ed-categoria" v-model="form.categoria" class="field-input text-sm">
        <option v-for="c in categories.categories" :key="c.slug" :value="c.slug">{{ c.label }}</option>
      </select>
    </div>
    <div v-for="f in FIELDS" :key="f.key" class="space-y-1.5">
      <label :for="`ed-${f.key}`" class="text-sm font-semibold">{{ f.label }}</label>
      <textarea v-if="f.rows" :id="`ed-${f.key}`" v-model="form[f.key]" :rows="f.rows" :maxlength="f.max" class="field-input resize-y text-sm" />
      <input v-else :id="`ed-${f.key}`" v-model="form[f.key]" type="text" :maxlength="f.max" class="field-input text-sm" />
    </div>
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    <div class="flex gap-2">
      <button
        type="submit"
        class="btn-hxnf btn-ink btn-sm"
        :disabled="saving || !dirty"
      >
        {{ saving ? 'Guardando…' : 'Guardar cambios' }}
      </button>
      <button type="button" class="text-sm text-fg/60 hover:underline" @click="emit('cancel')">Cancelar</button>
    </div>
  </form>
</template>
