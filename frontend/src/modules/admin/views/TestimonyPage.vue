<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { ApiError } from '@/core/http/client'
import { MapView, type MapPoint } from '@/modules/map'
import { categoryStyle, useCategoriesStore } from '@/modules/testimonies'
import { adminTestimoniesService } from '@admin/services/testimonies.service'
import { useAuthStore } from '@admin/stores/auth'
import type { ApiTestimonioStaff } from '@admin/types/api'
import { AUTORIZACION_LABELS, EVIDENCIA_LABELS, MULTIMEDIA_LABELS, VOZ_IMAGEN_LABELS, ORIGEN_LABELS, SENSIBLE_LABELS, fmtDate } from '@admin/data/labels'
import AuditPanel from '@admin/components/AuditPanel.vue'
import ModerationActions from '@admin/components/ModerationActions.vue'
import ModerationStatus from '@admin/components/ModerationStatus.vue'
import StaffContentEditor from '@admin/components/StaffContentEditor.vue'
import StaffEvidencePanel from '@admin/components/StaffEvidencePanel.vue'

const props = defineProps<{ id: string }>()

const router = useRouter()
const auth = useAuthStore()
const categories = useCategoriesStore()
// Editar la ficha, la ubicación pública y las notas internas: administración
const canEdit = computed(() => auth.perms.admin)

const t = ref<ApiTestimonioStaff | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const error = ref<string | null>(null)
const editing = ref(false)
const notice = ref<string | null>(null)

async function load() {
  status.value = 'loading'
  try {
    t.value = await adminTestimoniesService.get(props.id)
    status.value = 'ready'
  } catch (e) {
    const err = e as Partial<ApiError>
    error.value = err.status === 404 ? 'No encontramos este testimonio.' : 'No pudimos cargar el testimonio.'
    status.value = 'error'
  }
}

function updated(next: ApiTestimonioStaff, message = 'Cambios guardados.') {
  t.value = next
  editing.value = false
  notice.value = message
}

watch(() => props.id, load)
onMounted(() => {
  load()
  categories.load().catch(() => {})
})

const points = computed<MapPoint[]>(() =>
  t.value?.centroide ? [{ id: t.value.id, coordinates: t.value.centroide.coordinates, color: categoryStyle(t.value.categoria?.slug ?? '').color }] : [],
)

// Acercar el mapa al punto en cuanto existe
const mapView = ref<InstanceType<typeof MapView> | null>(null)
watch(mapView, (view) => {
  if (view && t.value?.centroide) view.flyTo(t.value.centroide.coordinates)
})

const place = computed(() => {
  if (!t.value) return ''
  return [t.value.lugar_territorio, [t.value.municipio, t.value.entidad].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Sin lugar'
})

// Gestión interna: notas y ubicación aproximada
const notes = ref('')
watch(t, (v) => (notes.value = v?.notas_internas ?? ''), { immediate: true })
const savingInternal = ref(false)
async function saveInternal(changes: { notas_internas?: string | null; ubicacion_aproximada?: boolean }) {
  if (!t.value) return
  savingInternal.value = true
  try {
    updated(await adminTestimoniesService.update(t.value.id, changes))
  } catch (e) {
    notice.value = (e as Partial<ApiError>).message ?? 'No se pudo guardar.'
  } finally {
    savingInternal.value = false
  }
}

// Regresa a la cola conservando sus filtros si se llegó desde ahí
function goBack() {
  if (window.history.state?.back?.startsWith('/admin/testimonios')) router.back()
  else router.push({ name: 'admin-testimonies' })
}

function onDeleted() {
  router.replace({ name: 'admin-testimonies' })
}

const evidenceTypes = computed(() => (t.value?.evidencia_tipos ?? []).map((e: string) => EVIDENCIA_LABELS[e] ?? e).join(', '))

const DOCUMENT_LABELS = { si: 'Sí', no: 'No', pendiente: 'Pendiente' } as const

const SECTIONS = computed(() =>
  t.value
    ? ([
        ['El testimonio', t.value.relato],
      ] as [string, string | null][]).filter(([, v]) => v)
    : [],
)
// 02 y 03 van después de 01 · El recibo dice (orden del Manual)
const TERRITORY_SECTIONS = computed(() =>
  t.value
    ? ([
        ['02 · El territorio dice', t.value.territorio_dice],
        ['03 · La comunidad dice', t.value.comunidad_dice],
      ] as [string, string | null][]).filter(([, v]) => v)
    : [],
)
</script>

<template>
  <div class="space-y-6">
    <button type="button" class="inline-flex items-center gap-1.5 text-sm text-fg/70 hover:text-fg" @click="goBack">
      <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      Testimonios
    </button>

    <div v-if="status === 'loading'" class="space-y-3" aria-hidden="true">
      <div class="h-8 w-2/3 animate-pulse rounded-full bg-fg/10" />
      <div class="h-64 animate-pulse rounded-2xl bg-fg/10" />
    </div>
    <div v-else-if="status === 'error'" class="border-2 border-ink bg-card shadow-brut space-y-2 rounded-[22px] p-6" role="alert">
      <p class="font-semibold">{{ error }}</p>
      <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" @click="load">Reintentar</button>
    </div>

    <template v-else-if="t">
      <!-- Encabezado -->
      <header class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <ModerationStatus :estado="t.estado" :activo="t.activo" :publico="t.es_publico" />
          <span v-if="t.categoria" class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-black" :class="categoryStyle(t.categoria.slug).bg">
            {{ t.categoria.nombre }}
          </span>
          <span v-if="t.info_sensible" class="rounded-full bg-brand-orange px-2.5 py-0.5 text-xs font-semibold text-black">⚠ Información sensible</span>
        </div>
        <h1 class="text-2xl leading-tight font-semibold">{{ t.titulo || 'Sin título' }}</h1>
        <p class="text-sm text-fg/60">
          <span class="font-mono">{{ t.folio }}</span> · {{ place }} · Fecha de la ficha {{ fmtDate(t.fecha) }} ·
          Recibido {{ fmtDate(t.created_at, true) }} · {{ ORIGEN_LABELS[t.origen] }}
        </p>
        <p v-if="t.estado === 'rechazado' && t.motivo_rechazo" class="rounded-xl bg-brand-orange/10 px-3 py-2 text-sm light:bg-brand-orange/25">
          <span class="font-semibold">Motivo del rechazo:</span> {{ t.motivo_rechazo }}
        </p>
      </header>

      <p v-if="notice" class="rounded-xl bg-fg/5 px-4 py-2 text-sm" role="status">{{ notice }}</p>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <!-- Ficha -->
        <div class="min-w-0 space-y-5">
          <section class="border-2 border-ink bg-card shadow-brut space-y-5 rounded-[22px] p-5">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-sm font-semibold">Ficha</h2>
              <button v-if="canEdit && !editing" type="button" class="text-sm font-semibold text-accent-ink hover:underline" @click="editing = true">
                Editar
              </button>
            </div>

            <StaffContentEditor v-if="editing" :testimony="t" @saved="updated" @cancel="editing = false" />

            <template v-else>
              <div v-for="[title, text] in SECTIONS" :key="title">
                <h3 class="mb-1 text-xs font-semibold tracking-wide text-fg/50 uppercase">{{ title }}</h3>
                <p class="text-sm leading-relaxed whitespace-pre-line text-fg/85">{{ text }}</p>
              </div>
              <div>
                <h3 class="mb-1 text-xs font-semibold tracking-wide text-fg/50 uppercase">01 · El recibo dice</h3>
                <p class="text-sm text-fg/85">
                  Evidencia: <span class="font-semibold">{{ DOCUMENT_LABELS[t.tiene_evidencia] }}</span>
                  <template v-if="t.evidencia_tipos?.length">
                    · {{ evidenceTypes }}
                  </template>
                  <template v-if="t.evidencia_otro"> ({{ t.evidencia_otro }})</template>
                </p>
                <p v-if="t.evidencia_descripcion" class="mt-1 text-sm whitespace-pre-line text-fg/85">{{ t.evidencia_descripcion }}</p>
                <div v-if="t.enlaces_evidencia?.length" class="mt-2">
                  <p class="text-xs font-semibold text-fg/60">Links</p>
                  <ul class="mt-1 space-y-1 text-sm">
                    <li v-for="url in t.enlaces_evidencia" :key="url">
                      <a :href="url" target="_blank" rel="noopener noreferrer" class="break-all underline">{{ url }}</a>
                    </li>
                  </ul>
                </div>
              </div>
              <div v-for="[title, text] in TERRITORY_SECTIONS" :key="title">
                <h3 class="mb-1 text-xs font-semibold tracking-wide text-fg/50 uppercase">{{ title }}</h3>
                <p class="text-sm leading-relaxed whitespace-pre-line text-fg/85">{{ text }}</p>
              </div>
              <div v-if="t.dato_fuente_anio || t.fuentes?.length">
                <h3 class="mb-1 text-xs font-semibold tracking-wide text-fg/50 uppercase">04 · Los datos dicen</h3>
                <p v-if="t.dato_fuente_anio" class="text-sm leading-relaxed whitespace-pre-line text-fg/85">{{ t.dato_fuente_anio }}</p>
                <ul v-if="t.fuentes?.length" class="mt-2 space-y-1 text-sm">
                  <li v-for="(f, i) in t.fuentes" :key="i" class="flex flex-wrap gap-x-2">
                    <span class="font-semibold">{{ f.fuente }}</span>
                    <span v-if="f.anio" class="text-fg/60">{{ f.anio }}</span>
                    <a v-if="f.enlace && /^https?:\/\//.test(f.enlace)" :href="f.enlace" target="_blank" rel="noopener noreferrer" class="break-all underline">{{ f.enlace }}</a>
                    <span v-else-if="f.enlace" class="text-fg/70">{{ f.enlace }}</span>
                  </li>
                </ul>
                <p v-if="t.fuente_pendiente_verificacion" class="mt-1 text-xs text-danger">Fuente pendiente de verificación</p>
              </div>
              <div v-if="t.pregunta_tribunal" class="rounded-2xl border border-neon-lime/40 bg-neon-lime/10 p-4 light:border-fg/15 light:bg-neon-lime/35">
                <h3 class="text-xs font-semibold tracking-wide text-accent-ink uppercase">05 · La pregunta del Tribunal</h3>
                <p class="mt-1 font-semibold text-accent-ink">{{ t.pregunta_tribunal }}</p>
              </div>
              <div v-if="t.algo_mas">
                <h3 class="mb-1 text-xs font-semibold tracking-wide text-fg/50 uppercase">Algo más que el Tribunal deba conocer</h3>
                <p class="text-sm leading-relaxed whitespace-pre-line text-fg/85">{{ t.algo_mas }}</p>
              </div>
              <div v-if="t.registro_voz" class="rounded-2xl border-2 border-dashed border-ink/40 p-3">
                <h3 class="mb-1 text-xs font-semibold tracking-wide text-fg/50 uppercase">Cómo quiere que quede registrada su voz · interno</h3>
                <p class="text-sm leading-relaxed whitespace-pre-line text-fg/85">{{ t.registro_voz }}</p>
              </div>
            </template>
          </section>

          <StaffEvidencePanel :testimony-id="t.id" :items="t.evidencias" :own-capture="t.facilitador_id === auth.user?.id" @changed="t.evidencias = $event" />
        </div>

        <!-- Lateral -->
        <aside class="min-w-0 space-y-4">
          <ModerationActions :testimony="t" @updated="updated($event, 'Estado actualizado.')" @deleted="onDeleted" />

          <!-- Consentimiento y protección -->
          <section class="border-2 border-ink bg-card shadow-brut space-y-2 rounded-[22px] p-4 text-sm" aria-labelledby="consent-title">
            <h2 id="consent-title" class="font-semibold">Consentimiento</h2>
            <dl class="space-y-1.5">
              <div class="flex justify-between gap-3"><dt class="text-fg/60">Autoriza</dt><dd class="text-right font-semibold">{{ AUTORIZACION_LABELS[t.autorizacion] }}</dd></div>
              <div class="flex justify-between gap-3"><dt class="text-fg/60">Voz o imagen (transmisión)</dt><dd class="text-right font-semibold">{{ t.autoriza_voz_imagen ? VOZ_IMAGEN_LABELS[t.autoriza_voz_imagen] : 'No se preguntó' }}</dd></div>
              <div class="flex justify-between gap-3"><dt class="text-fg/60">Personas fotografiadas autorizaron</dt><dd class="text-right font-semibold">{{ MULTIMEDIA_LABELS[t.autoriza_multimedia] }}</dd></div>
              <div class="flex justify-between gap-3">
                <dt class="text-fg/60">Niñas, niños o adolescentes</dt>
                <dd class="text-right font-semibold" :class="{ 'text-danger': t.info_menores }">{{ t.info_menores ? 'Sí · revisar con cuidados' : 'No' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-fg/60">Aparece como</dt>
                <dd class="text-right font-semibold">{{ t.aparecer_como === 'nombre' ? t.nombre_publico || 'Con nombre' : 'Anónimo' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-fg/60">Info. sensible</dt>
                <dd class="text-right font-semibold" :class="{ 'text-danger': t.info_sensible }">
                  {{ t.info_sensible ? `Sí · ${SENSIBLE_LABELS[t.sensible_accion ?? ''] ?? '—'}` : 'No' }}
                </dd>
              </div>
              <div v-if="t.consentimiento_version" class="flex justify-between gap-3"><dt class="text-fg/60">Versión</dt><dd>{{ t.consentimiento_version }}</dd></div>
              <div v-if="t.facilitador_nombre" class="flex justify-between gap-3"><dt class="text-fg/60">Facilitador/a</dt><dd class="text-right">{{ t.facilitador_nombre }}</dd></div>
            </dl>
          </section>

          <!-- Ubicación -->
          <section class="border-2 border-ink bg-card shadow-brut space-y-2 rounded-[22px] p-4 text-sm" aria-labelledby="map-title">
            <h2 id="map-title" class="font-semibold">Ubicación exacta</h2>
            <div v-if="points.length" class="border-2 border-ink bg-card shadow-brut relative h-48 overflow-hidden rounded-xl">
              <MapView ref="mapView" class="absolute inset-0" :points="points" :selected-id="t.id" />
            </div>
            <p v-if="t.centroide" class="text-xs text-fg/60 tabular-nums">
              {{ t.centroide.coordinates[1].toFixed(5) }}, {{ t.centroide.coordinates[0].toFixed(5) }} · {{ t.origen_ubicacion }}
            </p>
            <label v-if="canEdit" class="flex cursor-pointer items-start gap-2 pt-1">
              <input
                type="checkbox"
                class="mt-0.5 size-4 accent-neon-lime"
                :checked="t.ubicacion_aproximada"
                :disabled="savingInternal"
                @change="saveInternal({ ubicacion_aproximada: ($event.target as HTMLInputElement).checked })"
              />
              <span>Mostrar ubicación aproximada (~1 km) en el mapa público</span>
            </label>
          </section>

          <!-- Notas internas -->
          <section v-if="canEdit" class="border-2 border-ink bg-card shadow-brut space-y-2 rounded-[22px] p-4 text-sm" aria-labelledby="notes-title">
            <h2 id="notes-title" class="font-semibold">Notas internas</h2>
            <textarea v-model="notes" rows="3" maxlength="5000" class="field-input text-sm" placeholder="Solo las ve el equipo" aria-labelledby="notes-title" />
            <button
              type="button"
              class="btn-hxnf btn-paper btn-sm"
              :disabled="savingInternal || notes.trim() === (t.notas_internas ?? '').trim()"
              @click="saveInternal({ notas_internas: notes.trim() || null })"
            >
              Guardar notas
            </button>
          </section>
          <section v-else-if="t.notas_internas" class="border-2 border-ink bg-card shadow-brut space-y-1 rounded-[22px] p-4 text-sm">
            <h2 class="font-semibold">Notas internas</h2>
            <p class="whitespace-pre-line text-fg/80">{{ t.notas_internas }}</p>
          </section>

          <AuditPanel v-if="auth.perms.admin && t.tiene_auditoria" :testimony-id="t.id" />

          <div class="flex flex-wrap gap-4 text-sm">
            <RouterLink
              :to="{ name: 'admin-comments', query: { tab: 'todos', testimonio: t.id } }"
              class="font-semibold text-accent-ink hover:underline"
            >
              Ver comentarios ({{ t.comentarios_conteo }})
            </RouterLink>
            <RouterLink v-if="auth.perms.admin" :to="{ name: 'admin-person', params: { id: t.participante_id } }" class="font-semibold text-accent-ink hover:underline">
              Persona que lo aportó
            </RouterLink>
            <RouterLink v-if="auth.perms.log" :to="{ name: 'admin-log', query: { folio: t.folio } }" class="font-semibold text-accent-ink hover:underline">
              Historial
            </RouterLink>
          </div>
          <p class="text-xs text-fg/50">
            {{ t.reacciones_total }} reacciones · {{ t.comentarios_conteo }} comentarios
            <template v-if="t.publicado_at"> · publicado {{ fmtDate(t.publicado_at, true) }}</template>
            <template v-if="t.moderado_at"> · moderado {{ fmtDate(t.moderado_at, true) }}<template v-if="t.moderado_por_nombre"> por {{ t.moderado_por_nombre }}</template></template>
          </p>
        </aside>
      </div>
    </template>
  </div>
</template>
