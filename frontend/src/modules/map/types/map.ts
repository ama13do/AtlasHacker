export interface MapPoint {
  id: string
  coordinates: [number, number] // lng, lat
  color: string // Relleno del pin
  ink?: string // Color del ícono y del texto sobre `color` (negro por defecto)
  label?: string // Se muestra al pasar el cursor o al seleccionar
  icon?: string // SVG completo (lo genera la app, nunca contenido de usuario)
}
