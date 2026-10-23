// Próximo evento de la campaña: se anuncia al terminar de subir un testimonio («Aparta la fecha»).
// El .ics de public/ es lo que abren iPhone y Outlook (desde un blob o data: varios navegadores solo lo
// descargan): si cambia el evento, actualizarlo también.

// Hora y lugar todavía no se anuncian. Para publicarlos: SHOW_DETAILS = true y en public/marcha-19-noviembre.ics
// cambiar el día completo por DTSTART:20261119T170000Z / DTEND:20261119T210000Z y agregar LOCATION
// (versión completa en el commit 6fa3b30). Con false, el compilador quita estos datos del sitio publicado
const SHOW_DETAILS = false

export const MARCH_EVENT = {
  title: 'Marcha · Juicios x Nuestro Futuro',
  headline: 'Este 19 de noviembre los llevamos a juicio',
  weekday: 'Jue',
  day: '19',
  month: 'Nov',
  dateLabel: 'Jueves 19 de noviembre',
  // Se oculta el anuncio al terminar el día del evento (medianoche en CDMX, UTC−6 sin horario de verano)
  endsAt: '2026-11-20T06:00:00Z',
  description: 'Marcha de Juicios x Nuestro Futuro. Sube tu testimonio en atlashacker.hxnf.mx',
  ics: '/marcha-19-noviembre.ics',
} as const

export const MARCH_DETAILS = SHOW_DETAILS
  ? {
      timeLabel: '11:00 a 15:00 h',
      place: 'Glorieta de Insurgentes',
      placeDetail: 'Frente a la Secretaría de Energía (Av. Insurgentes 20, CDMX)',
      // En pantallas bajas se omite para que todo quepa sin desplazarse
      placeNote: 'donde también está la Comisión Nacional de Energía.',
      // UTC para calendarios: 11:00–15:00 en CDMX
      start: '20261119T170000Z',
      end: '20261119T210000Z',
      description:
        'Marcha de Juicios x Nuestro Futuro en la Glorieta de Insurgentes, frente a la Secretaría de Energía y la Comisión Nacional de Energía. Sube tu testimonio en atlashacker.hxnf.mx',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Glorieta de Insurgentes, Ciudad de México'),
    }
  : null

export const marchIsUpcoming = () => Date.now() < Date.parse(MARCH_EVENT.endsAt)

export function googleCalendarUrl() {
  const e = MARCH_EVENT
  const d = MARCH_DETAILS
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    // Sin hora: evento de día completo
    dates: d ? `${d.start}/${d.end}` : '20261119/20261120',
    details: d?.description ?? e.description,
    ctz: 'America/Mexico_City',
  })
  if (d) params.set('location', `${d.place}, ${d.placeDetail}`)
  return `https://calendar.google.com/calendar/render?${params}`
}
