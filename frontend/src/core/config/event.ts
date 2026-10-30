// Próximo paso de la campaña: se anuncia al terminar de subir un testimonio.
// En enero se lleva a juicio a la CFE. No hay día exacto: solo se muestra el mes, sin calendario
export const TRIAL_ANNOUNCEMENT = {
  badge: 'Próximamente',
  month: 'Ene',
  year: '2027',
  headline: 'En enero de 2027 los llevamos a juicio',
  // Se deja de anunciar al terminar enero (medianoche en CDMX, UTC−6 sin horario de verano)
  endsAt: '2027-02-01T06:00:00Z',
} as const

export const trialIsUpcoming = () => Date.now() < Date.parse(TRIAL_ANNOUNCEMENT.endsAt)
