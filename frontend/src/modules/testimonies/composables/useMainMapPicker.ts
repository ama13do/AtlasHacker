import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

// Puente entre el formulario (en el panel a un lado) y el mapa grande:
// mientras el paso de ubicación está a la vista, el clic en el mapa marca el lugar
// y la chincheta se puede arrastrar para ajustarlo
export interface MainMapPicker {
  // El formulario pide el mapa para marcar
  active: Ref<boolean>
  // Punto marcado (chincheta en el mapa grande)
  point: Ref<[number, number] | null>
  // MapPage llama a esto con cada clic en el mapa o al soltar la chincheta
  pick: (coordinates: [number, number]) => void
  // El formulario registra qué hacer con el clic
  onPick: (handler: ((coordinates: [number, number]) => void) | null) => void
  flyTo: (coordinates: [number, number], zoom?: number) => void
}

const KEY: InjectionKey<MainMapPicker> = Symbol('main-map-picker')

export function provideMainMapPicker(flyTo: (coordinates: [number, number], zoom?: number) => void): MainMapPicker {
  let handler: ((coordinates: [number, number]) => void) | null = null
  const picker: MainMapPicker = {
    active: ref(false),
    point: ref(null),
    pick: (coordinates) => handler?.(coordinates),
    onPick: (h) => (handler = h),
    flyTo,
  }
  provide(KEY, picker)
  return picker
}

// null fuera del mapa (p. ej. editar desde Mi folio): ahí se usa el mini-mapa
export function useMainMapPicker(): MainMapPicker | null {
  return inject(KEY, null)
}
