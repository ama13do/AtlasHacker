<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type ControlPosition,
  type FitBoundsOptions,
  type FlyToOptions,
  type GeoJSONSource,
  type LngLatBoundsLike,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection, Point } from 'geojson'
import mexicoGeo from '@map/assets/mexico.json'
import { BRAND } from '@/core/config/theme'
import { useTheme, type Theme } from '@/core/theme/useTheme'
import { BASE_LAYERS, CITY_LABELS_MIN_ZOOM, STREETS_MIN_ZOOM, MAP_STYLES, MAX_ZOOM, MEXICO_BOUNDS, MEXICO_CENTER, MIN_ZOOM, PAN_BOUNDS, type MapDetail } from '@map/config'
import { buildOutsideMask } from '@map/utils/mask'
import { STATE_FEATURES, stateBounds, stateFeature } from '@map/utils/geo'
import type { MapPoint } from '@map/types/map'
import MapCompass from '@map/components/MapCompass.vue'

// MapLibre resuelve su worker relativo a su propio módulo; Vite lo reubica al pre-empaquetar
setWorkerUrl(workerUrl)

const props = withDefaults(
  defineProps<{
    points?: MapPoint[]
    selectedId?: string | null
    navigationPosition?: ControlPosition
    // Margen del encuadre inicial, p. ej. para no quedar bajo un header superpuesto
    fitPadding?: FitBoundsOptions['padding']
    // Modo «marcar»: el clic (o soltar la chincheta) emite `pick`; los pines se atenúan
    pickable?: boolean
    // Lugar marcado: chincheta lima arrastrable
    pickPoint?: [number, number] | null
    // Detalle del mapa base: solo estados, o estados + ciudades al acercarse
    detail?: MapDetail
    // Permite elegir un estado con un clic (emite `selectState`); `selectedState` = código ISO (MX-JAL)
    selectableStates?: boolean
    selectedState?: string | null
    // Agrupa los pines cercanos (número en una píldora)
    cluster?: boolean
    // Pin resaltado desde fuera (p. ej. al pasar el cursor por la lista)
    hoveredId?: string | null
    // Animación de entrada: vuelo hacia México, silueta que aparece y pines que caen escalonados
    intro?: boolean
  }>(),
  {
    points: () => [],
    selectedId: null,
    navigationPosition: 'top-right',
    fitPadding: 20,
    pickable: false,
    pickPoint: null,
    detail: 'states',
    selectableStates: false,
    selectedState: null,
    cluster: true,
    hoveredId: null,
    intro: false,
  },
)

const emit = defineEmits<{
  select: [id: string]
  hover: [id: string | null]
  pick: [coordinates: [number, number]]
  selectState: [code: string | null]
}>()

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
// El mapa se muestra con el sur arriba (bearing 180); se puede girar con la rosa o con gestos
const SOUTH_UP = 180
// Zoom al que se abren los grupos como máximo (luego se ven los pines sueltos)
const CLUSTER_MAX_ZOOM = 11

// Datos de las capas del estado seleccionado: máscara alrededor y su contorno
function selectedStateData(code: string | null) {
  const feature = code ? stateFeature(code) : undefined
  return {
    mask: feature ? buildOutsideMask({ type: 'FeatureCollection', features: [feature] }) : EMPTY,
    outline: feature ? { type: 'FeatureCollection' as const, features: [feature] } : EMPTY,
  }
}

const mexico = mexicoGeo as FeatureCollection
const { theme } = useTheme()

// Colores de las capas propias según el tema. México se dibuja como en hxnf.mx/capitulos:
// contorno de tinta sobre un trazo verde grueso y una sombra dura desplazada
const LAYER_COLORS: Record<
  Theme,
  { land: string; water: string; mask: string; maskOpacity: number; outline: string; halo: string; haloOpacity: number; shadow: string; ink: string; states: string; statesOpacity: number; textHalo: string }
> = {
  dark: { land: '#0b0b0b', water: '#17191c', mask: BRAND.black, maskOpacity: 0.7, outline: BRAND.white, halo: BRAND.neonGreen, haloOpacity: 0.55, shadow: BRAND.neonLime, ink: BRAND.white, states: BRAND.neonGreen, statesOpacity: 0.4, textHalo: BRAND.black },
  light: { land: '#ffffff', water: '#e9eef1', mask: BRAND.white, maskOpacity: 0.78, outline: BRAND.black, halo: BRAND.neonGreen, haloOpacity: 0.75, shadow: BRAND.black, ink: BRAND.black, states: BRAND.black, statesOpacity: 0.3, textHalo: BRAND.white },
}

// Deja del estilo base solo fondo, agua, límites y nombres de estado (y ciudades al acercarse si se pide)
function simplifyBaseStyle(instance: MapLibreMap, detail: MapDetail) {
  const t = theme.value
  const layers = BASE_LAYERS[t]
  const colors = LAYER_COLORS[t]
  const keep = new Set([
    ...layers.base,
    ...layers.stateBoundaries,
    ...layers.stateLabels,
    ...(detail === 'states+cities' ? [...layers.cityLabels, ...layers.streets, ...layers.localLabels] : []),
  ])

  for (const layer of instance.getStyle().layers) {
    if (!keep.has(layer.id)) instance.setLayoutProperty(layer.id, 'visibility', 'none')
  }

  const exists = (id: string) => !!instance.getLayer(id)

  // Fondo de papel y agua apenas teñida (como el mapa de hxnf.mx/capitulos)
  if (exists('background')) instance.setPaintProperty('background', 'background-color', colors.land)
  if (exists('water')) instance.setPaintProperty('water', 'fill-color', colors.water)

  // Contorno de cada estado
  for (const id of layers.stateBoundaries.filter(exists)) {
    instance.setFilter(id, ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]])
    instance.setPaintProperty(id, 'line-color', colors.states)
    instance.setPaintProperty(id, 'line-opacity', colors.statesOpacity)
    instance.setPaintProperty(id, 'line-width', ['interpolate', ['linear'], ['zoom'], 4, 0.7, 8, 1.4])
    instance.setPaintProperty(id, 'line-dasharray', [1, 0]) // continua
    instance.setLayerZoomRange(id, 0, 24)
  }

  // Nombres (estados siempre; ciudades desde CITY_LABELS_MIN_ZOOM): en español si existe
  const labels = [...layers.stateLabels, ...(detail === 'states+cities' ? layers.cityLabels : [])].filter(exists)
  for (const id of labels) {
    instance.setLayoutProperty(id, 'text-field', ['coalesce', ['get', 'name:es'], ['get', 'name']])
    instance.setPaintProperty(id, 'text-color', colors.ink)
    instance.setPaintProperty(id, 'text-opacity', layers.stateLabels.includes(id) ? 0.5 : 0.75)
    instance.setPaintProperty(id, 'text-halo-color', colors.textHalo)
    instance.setPaintProperty(id, 'text-halo-width', 1.4)
  }
  for (const id of layers.stateLabels.filter(exists)) instance.setLayerZoomRange(id, 3.5, 24)
  if (detail === 'states+cities') {
    for (const id of layers.cityLabels.filter(exists)) instance.setLayerZoomRange(id, CITY_LABELS_MIN_ZOOM, 24)
    // Calles y localidades con su estilo original, solo de cerca
    for (const id of [...layers.streets, ...layers.localLabels].filter(exists)) instance.setLayerZoomRange(id, STREETS_MIN_ZOOM, 24)
    for (const id of layers.localLabels.filter(exists)) {
      instance.setLayoutProperty(id, 'text-field', ['coalesce', ['get', 'name:es'], ['get', 'name']])
    }
  }
}

// El seleccionado va aparte (siempre visible, nunca dentro de un grupo)
function pointsToGeoJSON(points: MapPoint[], exclude: string | null): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: points
      .filter((p) => p.id !== exclude)
      .map((p) => ({ type: 'Feature', properties: { id: p.id }, geometry: { type: 'Point', coordinates: p.coordinates } })),
  }
}

const pointById = computed(() => new Map(props.points.map((p) => [p.id, p])))

// --- Elementos HTML de los pines ---

// Retardo de la caída de cada pin durante la entrada (escalonado, con tope)
let dropIndex = 0
let dropping = false

function pinElement(point: MapPoint, active = false): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `tm-pin${active ? ' is-active' : ''}${point.id === props.hoveredId ? ' is-hover' : ''}${dropping ? ' is-dropping' : ''}`
  el.dataset.id = point.id
  if (dropping) el.style.setProperty('--drop-delay', `${Math.min(dropIndex++ * 35, 900)}ms`)
  el.style.setProperty('--mk', point.color)
  el.style.setProperty('--mk-text', point.ink ?? '#000')
  const motion = document.createElement('span')
  motion.className = 'tm-pin-motion'
  const pill = document.createElement('span')
  pill.className = 'tm-pin-pill'
  // El ícono lo genera la app (data/categories); el texto del testimonio va como texto plano
  pill.innerHTML = point.icon ?? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>'
  if (point.label) {
    const label = document.createElement('span')
    label.className = 'tm-pin-label'
    label.textContent = point.label
    pill.append(label)
  }
  const tip = document.createElement('span')
  tip.className = 'tm-pin-tip'
  motion.append(pill, tip)
  el.append(motion)
  el.addEventListener('click', (e) => {
    // Sin propagar: el clic en un pin no debe elegir el estado que tiene debajo
    e.stopPropagation()
    if (!props.pickable) emit('select', point.id)
  })
  el.addEventListener('mouseenter', () => emit('hover', point.id))
  el.addEventListener('mouseleave', () => emit('hover', null))
  return el
}

// Resaltado desde la lista
watch(
  () => props.hoveredId,
  (id, previous) => {
    for (const marker of markers.values()) {
      const el = marker.getElement()
      if (el.dataset.id === previous) el.classList.remove('is-hover')
      if (el.dataset.id === id) el.classList.add('is-hover')
    }
  },
)

function clusterElement(clusterId: number, count: number, coordinates: [number, number]): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `tm-cluster${count >= 25 ? ' is-lg' : ''}`
  el.textContent = count > 999 ? `${Math.round(count / 100) / 10}k` : String(count)
  el.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (!map || props.pickable) return
    const source = map.getSource<GeoJSONSource>('points')
    const zoom = source ? await source.getClusterExpansionZoom(clusterId) : map.getZoom() + 2
    map.easeTo({ center: coordinates, zoom: Math.min(zoom + 0.5, MAX_ZOOM), duration: 600 })
  })
  return el
}

function pickElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'tm-pick'
  el.innerHTML =
    '<span class="tm-pick-head"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span><span class="tm-pick-shadow"></span>'
  el.title = 'Arrastra para ajustar el lugar'
  return el
}

const container = ref<HTMLDivElement | null>(null)
// Instancia fuera de la reactividad de Vue para evitar proxies
let map: MapLibreMap | null = null
// Si se pidió un flyTo antes de cargar el estilo, no pisarlo con el encuadre inicial;
// tras el primer encuadre tampoco se re-encuadra (p. ej. al cambiar de tema)
let cameraRequested = false
// Mientras nadie mueva el mapa, si el contenedor cambia de tamaño (paneles que aparecen,
// fuentes que cargan) se vuelve a encuadrar México o el estado elegido
let userMoved = false

function initialBounds() {
  return (props.selectedState && stateBounds(props.selectedState)) || MEXICO_BOUNDS
}

// Orientación actual (la rosa la sigue) y el contenedor del control donde se monta la rosa
const bearing = ref(SOUTH_UP)
const compassHost = ref<HTMLDivElement | null>(null)

// fitBounds vuelve al norte si no se le da bearing: siempre se conserva el giro actual
function fit(instance: MapLibreMap, bounds: LngLatBoundsLike, options: FitBoundsOptions) {
  instance.fitBounds(bounds, { ...options, bearing: instance.getBearing() })
}

function southUp() {
  map?.easeTo({ bearing: SOUTH_UP, duration: 600 })
}

// Gira 90° hasta el siguiente punto cardinal (si se giró a mano, primero se alinea)
function rotateMap() {
  if (!map) return
  map.easeTo({ bearing: (Math.floor(map.getBearing() / 90 + 0.01) + 1) * 90, duration: 500 })
}

// Pines visibles: `p:<id>` (sueltos) y `c:<cluster_id>` (grupos)
const markers = new Map<string, Marker>()
let selectedMarker: Marker | null = null
let pickMarker: Marker | null = null

function clearMarkers() {
  for (const marker of markers.values()) marker.remove()
  markers.clear()
}

// Crea los pines de lo que la fuente tiene en pantalla y quita los que ya no están
function syncMarkers() {
  if (!map?.getSource('points') || !map.isSourceLoaded('points')) return
  const seen = new Set<string>()
  for (const feature of map.querySourceFeatures('points')) {
    const p = feature.properties as { id?: string; cluster?: boolean; cluster_id?: number; point_count?: number }
    const key = p.cluster ? `c:${p.cluster_id}` : `p:${p.id}`
    if (seen.has(key)) continue // Un punto puede venir repetido en varias teselas
    seen.add(key)
    if (markers.has(key)) continue

    const coordinates = (feature.geometry as Point).coordinates as [number, number]
    let marker: Marker
    if (p.cluster) {
      const element = clusterElement(p.cluster_id!, p.point_count!, coordinates)
      marker = new Marker({ element, anchor: 'center' })
      element.setAttribute('aria-label', `${p.point_count} testimonios cercanos. Acercar`)
    } else {
      const point = pointById.value.get(p.id!)
      if (!point) continue
      const element = pinElement(point)
      marker = new Marker({ element, anchor: 'bottom' })
      element.setAttribute('aria-label', point.label ? `Testimonio: ${point.label}` : 'Testimonio')
    }
    markers.set(key, marker.setLngLat(coordinates).addTo(map))
  }
  for (const [key, marker] of markers) {
    if (!seen.has(key)) {
      marker.remove()
      markers.delete(key)
    }
  }
}

function syncSelected() {
  selectedMarker?.remove()
  selectedMarker = null
  const point = props.selectedId ? pointById.value.get(props.selectedId) : undefined
  if (!map || !point) return
  const element = pinElement(point, true)
  selectedMarker = new Marker({ element, anchor: 'bottom' }).setLngLat(point.coordinates).addTo(map)
  element.setAttribute('aria-label', point.label ? `Testimonio seleccionado: ${point.label}` : 'Testimonio seleccionado')
  element.setAttribute('aria-current', 'true')
}

function refreshPoints() {
  const source = map?.getSource<GeoJSONSource>('points')
  if (!source) return
  clearMarkers()
  source.setData(pointsToGeoJSON(props.points, props.selectedId))
  syncSelected()
}

// Chincheta del lugar que se marca; arrastrable
function syncPick() {
  if (!map) return
  const point = props.pickable ? props.pickPoint : null
  if (!point) {
    pickMarker?.remove()
    pickMarker = null
    return
  }
  if (!pickMarker) {
    const marker = new Marker({ element: pickElement(), anchor: 'bottom', draggable: true })
    marker.on('dragstart', () => marker.getElement().classList.add('is-dragging'))
    marker.on('dragend', () => {
      marker.getElement().classList.remove('is-dragging')
      const { lng, lat } = marker.getLngLat()
      emit('pick', [lng, lat])
      // Si el punto se rechaza (fuera de México), la chincheta vuelve a su lugar
      nextTick(syncPick)
    })
    pickMarker = marker.setLngLat(point).addTo(map)
  } else {
    pickMarker.setLngLat(point)
  }
}

onMounted(() => {
  if (!container.value) return

  const animateIntro = props.intro && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  dropping = animateIntro
  const instance = new MapLibreMap({
    container: container.value,
    style: MAP_STYLES[theme.value],
    center: animateIntro ? [-99, 14] : MEXICO_CENTER,
    zoom: animateIntro ? MIN_ZOOM : 4.5,
    // Con la entrada animada, el mapa se voltea mientras llega a México
    bearing: animateIntro ? 0 : SOUTH_UP,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    maxBounds: PAN_BOUNDS,
    // Atribución compacta (botón ⓘ) para no chocar con otros controles en móvil
    attributionControl: { compact: true },
    // Se puede girar (clic derecho o Ctrl + arrastrar; dos dedos en móvil), pero nunca inclinar
    pitchWithRotate: false,
    touchPitch: false,
    maxPitch: 0,
  })

  bearing.value = instance.getBearing()
  instance.addControl(new NavigationControl({ showCompass: false }), props.navigationPosition)
  // Rosa de los vientos: control propio junto al zoom (la monta el Teleport de la plantilla)
  const host = document.createElement('div')
  host.className = 'maplibregl-ctrl tm-compass-ctrl'
  instance.addControl({ onAdd: () => host, onRemove: () => host.remove() }, props.navigationPosition)
  compassHost.value = host
  instance.on('rotate', () => (bearing.value = instance.getBearing()))

  // style.load no espera a las teselas: las capas propias aparecen de inmediato
  // También se dispara tras setStyle (cambio de tema): las capas propias se vuelven a añadir
  instance.on('style.load', () => {
    const colors = LAYER_COLORS[theme.value]
    simplifyBaseStyle(instance, props.detail)

    instance.addSource('mexico-mask', { type: 'geojson', data: buildOutsideMask(mexico) })
    instance.addLayer({
      id: 'mexico-mask',
      type: 'fill',
      source: 'mexico-mask',
      paint: { 'fill-color': colors.mask, 'fill-opacity': colors.maskOpacity },
    })

    // Silueta de México: sombra dura, trazo verde y contorno de tinta
    instance.addSource('mexico', { type: 'geojson', data: mexico })
    instance.addLayer({
      id: 'mexico-shadow',
      type: 'line',
      source: 'mexico',
      // Anclada a la pantalla: la sombra dura cae abajo a la derecha aunque el mapa esté girado
      paint: { 'line-color': colors.shadow, 'line-width': 2.5, 'line-translate': [5, 5], 'line-translate-anchor': 'viewport', 'line-opacity': 0.9 },
    })
    instance.addLayer({
      id: 'mexico-halo',
      type: 'line',
      source: 'mexico',
      layout: { 'line-join': 'round' },
      paint: { 'line-color': colors.halo, 'line-opacity': colors.haloOpacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 5, 8, 9] },
    })
    instance.addLayer({
      id: 'mexico-outline',
      type: 'line',
      source: 'mexico',
      layout: { 'line-join': 'round' },
      paint: { 'line-color': colors.outline, 'line-width': 1.6 },
    })

    if (props.selectableStates) addStateLayers(instance, colors)

    // Fuente de los pines; la capa es invisible: los pines son HTML (ver syncMarkers)
    clearMarkers()
    instance.addSource('points', {
      type: 'geojson',
      data: pointsToGeoJSON(props.points, props.selectedId),
      cluster: props.cluster,
      clusterRadius: 52,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
    })
    instance.addLayer({ id: 'points-anchor', type: 'circle', source: 'points', paint: { 'circle-radius': 0, 'circle-opacity': 0 } })

    if (!cameraRequested) {
      if (animateIntro) {
        // Entrada: desde lejos hacia México; la silueta se dibuja mientras llega
        for (const id of ['mexico-shadow', 'mexico-halo', 'mexico-outline']) {
          const target = instance.getPaintProperty(id, 'line-opacity') ?? 1
          instance.setPaintProperty(id, 'line-opacity', 0)
          instance.setPaintProperty(id, 'line-opacity-transition', { duration: 1400, delay: 300 })
          requestAnimationFrame(() => instance.setPaintProperty(id, 'line-opacity', target as number))
        }
        instance.fitBounds(initialBounds(), { padding: props.fitPadding, bearing: SOUTH_UP, duration: 2200, easing: (t) => 1 - Math.pow(1 - t, 3) })
        instance.once('moveend', () => setTimeout(() => (dropping = false), 1200))
      } else {
        fit(instance, initialBounds(), { padding: props.fitPadding, animate: false })
      }
    }
    cameraRequested = true
    syncSelected()
    syncPick()
  })

  instance.on('render', syncMarkers)

  // El estilo base pide íconos que ocultamos: se les da una imagen vacía para no llenar la consola de avisos
  instance.on('styleimagemissing', (e) => {
    if (!instance.hasImage(e.id)) instance.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) })
  })

  // La atribución compacta arranca abierta; se deja como botón ⓘ (sigue a un clic de distancia)
  instance.once('load', () => {
    container.value?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
  })

  // Solo los gestos de la persona traen originalEvent
  instance.on('movestart', (e) => {
    if ((e as { originalEvent?: Event }).originalEvent) userMoved = true
  })
  instance.on('resize', () => {
    if (!userMoved && !instance.isMoving() && !props.selectedId && !props.pickable && instance.isStyleLoaded()) {
      fit(instance, initialBounds(), { padding: props.fitPadding, animate: false })
    }
  })

  if (props.selectableStates) bindStateEvents(instance)

  instance.on('click', (e) => {
    if (props.pickable) emit('pick', [e.lngLat.lng, e.lngLat.lat])
  })

  map = instance
})

watch(() => props.points, refreshPoints, { deep: true })
watch(() => props.selectedId, refreshPoints)
watch(() => [props.pickPoint, props.pickable], syncPick)

watch(
  () => props.pickable,
  (on) => map && (map.getCanvas().style.cursor = on ? 'crosshair' : ''),
  { flush: 'post' },
)

watch(theme, (value) => map?.setStyle(MAP_STYLES[value], { diff: false }))

// --- Selección de estado ---

// Capas: relleno invisible para el clic (se aclara al pasar el cursor), municipios (líneas del mapa base,
// solo con un estado elegido), máscara alrededor del estado elegido y su contorno
function addStateLayers(instance: MapLibreMap, colors: (typeof LAYER_COLORS)[Theme]) {
  const selected = selectedStateData(props.selectedState)
  instance.addSource('states', { type: 'geojson', data: { type: 'FeatureCollection', features: STATE_FEATURES }, promoteId: 'code' })
  instance.addLayer({
    id: 'states-fill',
    type: 'fill',
    source: 'states',
    paint: {
      'fill-color': BRAND.neonGreen,
      'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], theme.value === 'dark' ? 0.16 : 0.22, 0],
    },
  })
  if (instance.getSource('openmaptiles')) {
    instance.addLayer({
      id: 'municipalities',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      // OpenFreeMap solo trae admin_level 6 (municipios) desde z9
      minzoom: 9,
      filter: ['all', ['==', ['get', 'admin_level'], 6], ['!=', ['get', 'maritime'], 1]],
      layout: { visibility: props.selectedState ? 'visible' : 'none' },
      paint: { 'line-color': colors.ink, 'line-opacity': 0.45, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.4] },
    })
  }
  instance.addSource('state-mask', { type: 'geojson', data: selected.mask })
  instance.addLayer({ id: 'state-mask', type: 'fill', source: 'state-mask', paint: { 'fill-color': colors.mask, 'fill-opacity': 0.6 } })
  instance.addSource('state-selected', { type: 'geojson', data: selected.outline })
  instance.addLayer({
    id: 'state-outline-halo',
    type: 'line',
    source: 'state-selected',
    layout: { 'line-join': 'round' },
    paint: { 'line-color': BRAND.neonGreen, 'line-width': 7, 'line-opacity': 0.8 },
  })
  instance.addLayer({ id: 'state-outline', type: 'line', source: 'state-selected', paint: { 'line-color': colors.outline, 'line-width': 2.2 } })
}

function bindStateEvents(instance: MapLibreMap) {
  let hovered: string | null = null
  const setHover = (code: string | null) => {
    if (hovered) instance.setFeatureState({ source: 'states', id: hovered }, { hover: false })
    hovered = code
    if (code) instance.setFeatureState({ source: 'states', id: code }, { hover: true })
  }

  instance.on('mousemove', 'states-fill', (e) => {
    if (props.pickable) return setHover(null)
    const code = e.features?.[0]?.properties?.code as string | undefined
    // Con un estado elegido, solo él reacciona; el resto está bajo la máscara
    setHover(code && (!props.selectedState || code === props.selectedState) ? code : null)
    instance.getCanvas().style.cursor = code ? 'pointer' : ''
  })
  instance.on('mouseleave', 'states-fill', () => {
    setHover(null)
    instance.getCanvas().style.cursor = props.pickable ? 'crosshair' : ''
  })

  instance.on('click', (e) => {
    if (props.pickable || !instance.getLayer('states-fill')) return
    const code = instance.queryRenderedFeatures(e.point, { layers: ['states-fill'] })[0]?.properties?.code as string | undefined
    if (props.selectedState) {
      // Clic fuera del estado elegido (en la máscara o el mar): volver a todo México
      if (code !== props.selectedState) emit('selectState', null)
    } else if (code) {
      emit('selectState', code)
    }
  })
}

watch(
  () => props.selectedState,
  (code) => {
    if (!map?.getSource('state-mask')) return
    const selected = selectedStateData(code)
    map.getSource<GeoJSONSource>('state-mask')?.setData(selected.mask)
    map.getSource<GeoJSONSource>('state-selected')?.setData(selected.outline)
    if (map.getLayer('municipalities')) map.setLayoutProperty('municipalities', 'visibility', code ? 'visible' : 'none')
    cameraRequested = true
    fit(map, (code && stateBounds(code)) || MEXICO_BOUNDS, { padding: props.fitPadding, duration: 800 })
  },
)

function flyTo(coordinates: [number, number], padding?: FlyToOptions['padding'], minZoom = 7) {
  cameraRequested = true
  userMoved = true
  map?.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), minZoom), padding, essential: true })
}

function fitTo(bounds: LngLatBoundsLike, padding?: FitBoundsOptions['padding']) {
  cameraRequested = true
  userMoved = true
  if (map) fit(map, bounds, { padding: padding ?? props.fitPadding, duration: 800, maxZoom: 15 })
}

defineExpose({ flyTo, fitTo })

onBeforeUnmount(() => {
  clearMarkers()
  selectedMarker?.remove()
  pickMarker?.remove()
  map?.remove()
  map = null
})
</script>

<template>
  <div class="h-full w-full">
    <div ref="container" class="tm-map h-full w-full" :class="{ 'is-picking': pickable, 'has-selection': !!selectedId && !pickable }" />
    <Teleport v-if="compassHost" :to="compassHost">
      <MapCompass :bearing="bearing" @south-up="southUp" @rotate="rotateMap" />
    </Teleport>
  </div>
</template>

<style>
/* Con un testimonio abierto, los demás pines pasan a segundo plano (siguen siendo clicables) */
.tm-map.has-selection .tm-pin:not(.is-active):not(:hover):not(.is-hover),
.tm-map.has-selection .tm-cluster:not(:hover) {
  opacity: 0.4;
}

/* Entrada: los pines caen escalonados */
.tm-pin.is-dropping .tm-pin-motion {
  animation: tm-pin-drop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) var(--drop-delay, 0ms) both;
}

@keyframes tm-pin-drop {
  from {
    opacity: 0;
    translate: 0 -28px;
    scale: 0.4;
  }
  to {
    opacity: 1;
    translate: 0 0;
    scale: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tm-pin.is-dropping .tm-pin-motion {
    animation: none;
  }
}

/* Mientras se marca un lugar, los pines quedan de fondo y no se pueden abrir */
.tm-map.is-picking .tm-pin,
.tm-map.is-picking .tm-cluster {
  opacity: 0.28;
  pointer-events: none;
}

.tm-pin-motion {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
