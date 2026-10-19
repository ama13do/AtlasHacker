import { SITE_HOST, SITE_URL } from '@/core/config/brand'

// Datos de los documentos legales (aviso de privacidad, términos y política de cookies), con la estructura de los
// avisos de la Escuela de Liderazgo Climático. Responsable de los datos: Hackers x Nuestro Futuro (solo ella).
// Al cambiar el contenido de un documento: subir VERSION y actualizar la fecha. Si cambia el aviso de
// privacidad, poner la misma versión en el dashboard (Configuración → «Versión vigente del aviso»), que es
// la que queda registrada con cada consentimiento.
// Seguridad: los textos legales no nombran proveedores, tecnologías ni detalles de la infraestructura.
export const LEGAL = {
  version: '2026-10',
  updatedAt: '19 de octubre de 2026',
  // Responsable del tratamiento de los datos (aviso de privacidad)
  responsable: 'Hackers x Nuestro Futuro',
  // Organizaciones que respaldan a la coalición: solo se mencionan en los términos y condiciones
  respaldo: [
    { name: 'Nuestro Derecho al Futuro A.C.', short: 'Nuestro Futuro' },
    { name: 'Participando por México A.C.', short: 'Práctica, Laboratorio para la Democracia' },
  ],
  marca: 'Hackers x Nuestro Futuro',
  proyecto: 'Atlas · Mapas por Nuestro Futuro',
  email: 'hxnf@practica.lat', // oír y recibir notificaciones, derechos ARCO y dudas
  ciudad: 'Ciudad de México',
  site: SITE_URL,
  host: SITE_HOST,
} as const

export const LEGAL_ROUTES = {
  privacy: { name: 'legal-privacy', label: 'Aviso de privacidad' },
  terms: { name: 'legal-terms', label: 'Términos y condiciones' },
  cookies: { name: 'legal-cookies', label: 'Política de cookies' },
} as const
