import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

// Puente entre el formulario (en la barra lateral) y el mapa grande del inicio:
// mientras el paso de ubicación está a la vista, el clic en el mapa marca el lugar
export interface MainMapPicker {
  // El formulario pide el mapa para marcar
  active: Ref<boolean>
  // Punto marcado (se pinta en el mapa grande)
  point: Ref<[number, number] | null>
  // HomePage llama a esto con cada clic en el mapa
  pick: (coordinates: [number, number]) => void
  // El formulario registra qué hacer con el clic
  onPick: (handler: ((coordinates: [number, number]) => void) | null) => void
  flyTo: (coordinates: [number, number]) => void
}

const KEY: InjectionKey<MainMapPicker> = Symbol('main-map-picker')

export function provideMainMapPicker(flyTo: (coordinates: [number, number]) => void): MainMapPicker {
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

// null fuera del inicio (p. ej. editar desde Mi folio): ahí se usa el mini-mapa
export function useMainMapPicker(): MainMapPicker | null {
  return inject(KEY, null)
}
