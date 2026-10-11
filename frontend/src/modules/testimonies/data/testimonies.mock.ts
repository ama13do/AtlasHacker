import type { Testimony } from '@testimonies/types/testimony'

// Datos de ejemplo (ficticios) mientras la API no envía testimonios
export const TESTIMONIES_MOCK: Testimony[] = [
  {
    id: 't-0001',
    folio: 'FUTURO/001-T0001',
    date: '2026-09-14',
    place: 'Juchitán, Istmo de Tehuantepec, Oax.',
    coordinates: [-95.03, 16.43],
    author: { visibility: 'anonimo' },
    topic: 'transicion',
    title: 'Los aerogeneradores llegaron, la consulta no',
    testimony:
      'En los últimos años se instalaron parques eólicos en tierras comunales. Muchas familias firmaron contratos de arrendamiento sin entender los plazos ni los pagos.',
    territory:
      'Se ven caminos nuevos, cercas y torres donde antes había milpa. Desde 2019 cambió el paso del ganado y el acceso a la laguna.',
    community:
      'La asamblea está dividida. Afecta sobre todo a ejidatarios mayores y a pescadores que ya no pueden pasar por los caminos de siempre.',
    document: { status: 'si', folio: 'FUTURO/001-E0001', description: 'Copia de contrato de arrendamiento y acta de asamblea.' },
    data: { text: 'Superficie arrendada por el parque en el ejido', pendingVerification: true },
    tribunalQuestion: '¿Por qué no se hizo una consulta libre, previa e informada antes de firmar?',
    evidence: ['documento', 'foto', 'mapa'],
    supports: 412,
  },
  {
    id: 't-0002',
    folio: 'FUTURO/001-T0002',
    date: '2026-08-30',
    place: 'Tula de Allende, Hgo.',
    coordinates: [-99.34, 20.05],
    author: { visibility: 'nombre', name: 'Mariana R.' },
    topic: 'contaminacion',
    title: 'El aire de Tula huele a combustóleo',
    testimony:
      'Varias noches a la semana el aire se vuelve pesado y huele a azufre. En la escuela de mis hijos suspenden el recreo al aire libre.',
    territory:
      'Hay hollín en techos y ropa tendida. Las columnas de humo se ven desde la carretera, sobre todo en la madrugada.',
    community:
      'Las familias cercanas reportan más visitas al médico por problemas respiratorios. Afecta a niñas, niños y personas mayores.',
    document: { status: 'pendiente', description: 'Recetas y notas médicas por recopilar.' },
    data: { text: 'Mediciones de calidad del aire en la estación más cercana', pendingVerification: true },
    tribunalQuestion: '¿Qué medidas se tomaron para reducir las emisiones y quién las vigila?',
    evidence: ['foto', 'video', 'estudio'],
    supports: 389,
  },
  {
    id: 't-0003',
    folio: 'FUTURO/001-T0003',
    date: '2026-09-02',
    place: 'Mexicali, B.C.',
    coordinates: [-115.45, 32.62],
    author: { visibility: 'anonimo' },
    topic: 'suceso',
    title: 'Recibos impagables en pleno verano',
    testimony:
      'Con temperaturas de casi 50 °C el aire acondicionado no es un lujo. El recibo de luz de este bimestre fue mayor que mi salario mensual.',
    territory:
      'En la colonia hay casas con el servicio cortado. Desde 2024 los veranos son más largos y los apagones más frecuentes.',
    community:
      'Personas mayores pasan las tardes en plazas comerciales para refrescarse. Afecta a quienes viven en casas de lámina.',
    document: { status: 'si', folio: 'FUTURO/001-E0003', description: 'Recibos de luz de los últimos tres bimestres.' },
    tribunalQuestion: '¿Cómo se define la tarifa para zonas de calor extremo y quién la revisa?',
    evidence: ['recibo', 'foto'],
    supports: 356,
  },
  {
    id: 't-0004',
    folio: 'FUTURO/001-T0004',
    date: '2026-07-21',
    place: 'Coatzacoalcos, Ver.',
    coordinates: [-94.46, 18.14],
    author: { visibility: 'nombre', name: 'Colectivo Río Vivo' },
    topic: 'contaminacion',
    title: 'El río cambió de color',
    testimony:
      'Pescadores encontraron manchas oscuras en el río después de una fuga en la zona industrial. Nadie avisó a la comunidad.',
    territory:
      'Peces muertos en la orilla durante dos semanas. El agua tiene una película aceitosa cerca de la desembocadura.',
    community:
      'La cooperativa de pesca dejó de vender. Afecta a familias que dependen de la pesca y a quienes usan el agua del río.',
    document: { status: 'si', folio: 'FUTURO/001-E0004', description: 'Fotografías georreferenciadas y video del derrame.' },
    data: { text: 'Análisis de muestra de agua', source: 'Laboratorio universitario', pendingVerification: true },
    tribunalQuestion: '¿Quién es responsable de la fuga y por qué no se informó a la población?',
    evidence: ['foto', 'video', 'mapa', 'estudio'],
    supports: 331,
  },
  {
    id: 't-0005',
    folio: 'FUTURO/001-T0005',
    date: '2026-09-20',
    place: 'Hermosillo, Son.',
    coordinates: [-110.96, 29.07],
    author: { visibility: 'anonimo' },
    topic: 'transicion',
    title: 'Sol de sobra, techos sin paneles',
    testimony:
      'Vivimos en uno de los lugares con más sol del país, pero instalar paneles solares en casa sigue siendo inalcanzable para la mayoría.',
    territory:
      'Los nuevos parques solares están lejos de las colonias populares. En los techos de la ciudad casi no hay paneles.',
    community:
      'Jóvenes de la colonia se organizan para pedir un programa de techos solares comunitarios.',
    document: { status: 'no' },
    data: { text: 'Hogares con generación distribuida en el municipio', pendingVerification: true },
    tribunalQuestion: '¿Por qué la energía solar no llega a los hogares que más la necesitan?',
    evidence: ['datos'],
    supports: 298,
  },
  {
    id: 't-0006',
    folio: 'FUTURO/001-T0006',
    date: '2026-08-11',
    place: 'Salamanca, Gto.',
    coordinates: [-101.19, 20.57],
    author: { visibility: 'nombre', name: 'Jorge L.' },
    topic: 'contaminacion',
    title: 'Contingencias que ya son costumbre',
    testimony:
      'Las alertas por mala calidad del aire se repiten cada temporada seca. Nos dicen que no salgamos, pero hay que ir a trabajar.',
    territory:
      'Neblina gris sobre la ciudad en las mañanas. Desde hace años los árboles cercanos a la zona industrial se secan.',
    community:
      'Trabajadores de turnos nocturnos y estudiantes que caminan a la escuela son los más expuestos.',
    document: { status: 'pendiente' },
    tribunalQuestion: '¿Qué plan existe para que las contingencias dejen de ser normales?',
    evidence: ['foto', 'datos'],
    supports: 244,
  },
  {
    id: 't-0007',
    folio: 'FUTURO/001-T0007',
    date: '2026-09-28',
    place: 'Monterrey, N.L.',
    coordinates: [-100.31, 25.69],
    author: { visibility: 'anonimo' },
    topic: 'suceso',
    title: 'Apagones en la ola de calor',
    testimony:
      'Durante la ola de calor hubo cortes de luz de varias horas en mi colonia sin previo aviso, mientras las zonas industriales seguían operando.',
    territory:
      'Los cortes se concentraron en colonias del oriente de la ciudad, entre mayo y junio.',
    community:
      'Se perdieron alimentos y medicamentos que necesitan refrigeración. Afecta a personas con enfermedades crónicas.',
    document: { status: 'si', folio: 'FUTURO/001-E0007', description: 'Capturas de reportes de falla y respuestas recibidas.' },
    tribunalQuestion: '¿Con qué criterios se decide a quién se le corta la luz primero?',
    evidence: ['documento', 'foto'],
    supports: 207,
  },
  {
    id: 't-0008',
    folio: 'FUTURO/001-T0008',
    date: '2026-07-05',
    place: 'Mérida, Yuc.',
    coordinates: [-89.62, 20.97],
    author: { visibility: 'nombre', name: 'Asamblea Maya Territorial' },
    topic: 'transicion',
    title: 'Parques solares sobre la selva',
    testimony:
      'Para instalar un parque solar se desmontaron hectáreas de selva cerca de cenotes. La energía limpia no puede costar el territorio.',
    territory:
      'Se ve la tala desde imágenes satelitales. Los cenotes cercanos tienen menos agua desde que comenzó la obra.',
    community:
      'Comunidades mayas no fueron consultadas. Afecta a apicultores y a quienes dependen del agua de los cenotes.',
    document: { status: 'si', folio: 'FUTURO/001-E0008', description: 'Imágenes satelitales comparativas y mapa del predio.' },
    data: { text: 'Hectáreas desmontadas según imágenes satelitales', pendingVerification: true },
    tribunalQuestion: '¿Cómo se autorizó el cambio de uso de suelo sin consultar a las comunidades?',
    evidence: ['mapa', 'foto', 'estudio'],
    supports: 188,
  },
]
