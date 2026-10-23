// Próximo evento de la campaña: se anuncia al terminar de subir un testimonio («Aparta la fecha»).
// Si cambia la fecha o el lugar, actualizar también public/marcha-19-noviembre.ics (iPhone y Outlook lo abren
// directo como evento; desde un blob o data: varios navegadores solo lo descargan).
// Hora de la Ciudad de México (UTC−6 todo el año, sin horario de verano desde 2022)

export const MARCH_EVENT = {
  title: 'Marcha · Juicios x Nuestro Futuro',
  headline: 'Este 19 de noviembre los llevamos a juicio',
  weekday: 'Jue',
  day: '19',
  month: 'Nov',
  dateLabel: 'Jueves 19 de noviembre',
  timeLabel: '11:00 a 15:00 h',
  place: 'Glorieta de Insurgentes',
  placeDetail: 'Frente a la Secretaría de Energía (Av. Insurgentes 20, CDMX)',
  // En pantallas bajas se omite para que todo quepa sin desplazarse
  placeNote: 'donde también está la Comisión Nacional de Energía.',
  // UTC para calendarios: 11:00–15:00 en CDMX
  start: '20261119T170000Z',
  end: '20261119T210000Z',
  // Se oculta el anuncio cuando el evento ya pasó
  endsAt: '2026-11-19T21:00:00Z',
  description:
    'Marcha de Juicios x Nuestro Futuro en la Glorieta de Insurgentes, frente a la Secretaría de Energía y la Comisión Nacional de Energía. Sube tu testimonio en atlashacker.hxnf.mx',
  ics: '/marcha-19-noviembre.ics',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Glorieta de Insurgentes, Ciudad de México'),
} as const

export const marchIsUpcoming = () => Date.now() < Date.parse(MARCH_EVENT.endsAt)

export function googleCalendarUrl() {
  const e = MARCH_EVENT
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${e.start}/${e.end}`,
    details: e.description,
    location: `${e.place}, ${e.placeDetail}`,
    ctz: 'America/Mexico_City',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}
