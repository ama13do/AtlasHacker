<script setup lang="ts">
import { ref } from 'vue'
import type { ApiError } from '@/core/http/client'
import { adminTestimoniesService } from '@admin/services/testimonies.service'
import type { ApiAuditoria } from '@admin/types/api'
import { fmtDate } from '@admin/data/labels'

// Auditoría del envío (solo admin). Incluye la IP descifrada: solo se pide a demanda y queda en la bitácora
const props = defineProps<{ testimonyId: string }>()

const data = ref<ApiAuditoria | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await adminTestimoniesService.audit(props.testimonyId)
  } catch (e) {
    error.value = (e as Partial<ApiError>).message ?? 'No se pudo cargar la auditoría.'
  } finally {
    loading.value = false
  }
}

const rows = (a: ApiAuditoria) =>
  [
    ['Recibido', fmtDate(a.created_at, true)],
    ['IP', a.ip],
    ['Navegador', a.user_agent],
    ['Captcha', a.captcha_ok === null ? 'No requerido' : a.captcha_ok ? 'Válido' : 'Inválido'],
    ['Ubicación', [a.origen_ubicacion, a.precision_gps_m != null ? `±${a.precision_gps_m} m` : null].filter(Boolean).join(' · ')],
    ['Zona horaria / idioma', [a.zona_horaria, a.idioma].filter(Boolean).join(' · ')],
    ['Pantalla', a.pantalla],
    ['Consentimiento', a.consentimiento_version],
    ['Se purga el', fmtDate(a.retener_hasta)],
  ].filter(([, v]) => v) as [string, string][]
</script>

<template>
  <section class="space-y-3 rounded-2xl border border-fg/15 p-4" aria-labelledby="audit-title">
    <h2 id="audit-title" class="text-sm font-semibold">Auditoría del envío</h2>
    <template v-if="!data">
      <p class="text-xs text-fg/60">Incluye la IP y el navegador. La consulta queda registrada en la bitácora.</p>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline disabled:opacity-50" :disabled="loading" @click="load">
        {{ loading ? 'Cargando…' : 'Ver auditoría' }}
      </button>
    </template>
    <dl v-else class="space-y-1.5 text-xs">
      <div v-for="[label, value] in rows(data)" :key="label" class="grid grid-cols-[7rem_1fr] gap-2">
        <dt class="text-fg/50">{{ label }}</dt>
        <dd class="break-words">{{ value }}</dd>
      </div>
    </dl>
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
  </section>
</template>
