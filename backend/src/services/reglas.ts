import type { ModoPublicacion } from './configuracion.js';

type Entrada = {
  autorizacion: 'publico_con_nombre' | 'publico_anonimo' | 'solo_documentacion_interna' | 'no_autoriza';
  info_sensible: boolean;
  sensible_accion?: 'anonimizar' | 'uso_interno' | 'revision_antes_publicar' | null;
  info_menores?: boolean;
  amenazas?: 'no' | 'si' | 'prefiero_no_decir' | null;
  revision_riesgo?: boolean;
};

export type Decision = {
  estado: 'pendiente' | 'aprobado';
  ubicacion_aproximada: boolean;
  razon: string;
};

/**
 * Decide el estado inicial de un testimonio según el modo de publicación configurado.
 *
 * REGLAS FIJAS (ningún modo puede saltárselas):
 *  1. «solo documentación interna» y «no autorizo publicación» NUNCA se publican (además la vista pública y
 *     el trigger de es_publico lo vuelven a garantizar en la base de datos).
 *  2. Información sensible con «revisión antes de publicar» o «uso interno» → siempre queda pendiente.
 *  2b. Información de niñas, niños o adolescentes (Manual C.10) → siempre queda pendiente.
 *  2c. Modo protección (amenazas «sí» o «prefiero no decir») → siempre queda pendiente y con ubicación aproximada.
 *  2d. Megaproyectos y centrales fósiles (revisión de riesgo, 7 a 14 días) → siempre queda pendiente. Al aprobarse se
 *      publica de inmediato: no hay publicación diferida.
 *  3. Información sensible con «anonimizar» → se oculta el nombre (vista pública) y la ubicación se generaliza.
 */
export function decidirPublicacion(modo: ModoPublicacion, t: Entrada): Decision {
  const proteccion = enModoProteccion(t.amenazas);
  const aproximada = proteccion || (t.info_sensible && t.sensible_accion === 'anonimizar');

  if (t.autorizacion === 'solo_documentacion_interna' || t.autorizacion === 'no_autoriza') {
    return { estado: 'pendiente', ubicacion_aproximada: aproximada, razon: 'sin autorización de publicación' };
  }
  if (t.info_sensible && (t.sensible_accion === 'revision_antes_publicar' || t.sensible_accion === 'uso_interno')) {
    return { estado: 'pendiente', ubicacion_aproximada: aproximada, razon: 'información sensible: requiere revisión' };
  }
  if (proteccion) {
    return { estado: 'pendiente', ubicacion_aproximada: true, razon: 'modo protección (amenazas): requiere revisión' };
  }
  if (t.revision_riesgo) {
    return { estado: 'pendiente', ubicacion_aproximada: aproximada, razon: 'megaproyecto o central fósil: revisión de riesgo' };
  }
  if (t.info_menores) {
    return { estado: 'pendiente', ubicacion_aproximada: aproximada, razon: 'información de menores: requiere revisión' };
  }
  if (modo === 'revisar_todo') return { estado: 'pendiente', ubicacion_aproximada: aproximada, razon: 'modo revisar_todo' };
  if (modo === 'auto_si_no_sensible' && t.info_sensible) {
    return { estado: 'pendiente', ubicacion_aproximada: aproximada, razon: 'modo auto_si_no_sensible con información sensible' };
  }
  return { estado: 'aprobado', ubicacion_aproximada: aproximada, razon: `publicación automática (${modo})` };
}

/** «¿Te han amenazado?» = sí o prefiero no decir: anonimato obligatorio, ubicación aproximada y revisión. */
export function enModoProteccion(amenazas?: string | null): boolean {
  return amenazas === 'si' || amenazas === 'prefiero_no_decir';
}

type Caso = { amenazas?: string | null; hechos?: readonly string[] | null; subcategoria?: string | null };

// Megaproyecto (MP.*) o central fósil, como hecho principal, secundario o corregido por el revisor
const esProyectoORiesgo = (t: Caso) =>
  Boolean(t.hechos?.includes('proyecto_territorio')) ||
  Boolean(t.subcategoria && (t.subcategoria.startsWith('MP.') || t.subcategoria === 'CC.CENTRAL_FOSIL'));

/**
 * Precisión del pin público (Excel de metodología, UI-4 y «Propuesta de interfaz» C): con amenazas solo se muestra
 * el estado; en megaproyectos y centrales fósiles, el centro del municipio. null = cuadrícula de ~1 km (o exacta en
 * testimonios del formulario anterior).
 */
export function precisionPublica(t: Caso): 'estado' | 'municipio' | null {
  if (enModoProteccion(t.amenazas)) return 'estado';
  if (esProyectoORiesgo(t)) return 'municipio';
  return null;
}

/** Revisión de riesgo (7 a 14 días): amenazas, un proyecto en el territorio o una central fósil. */
export function revisionDeRiesgo(t: Caso): boolean {
  return enModoProteccion(t.amenazas) || esProyectoORiesgo(t);
}

/** Subcategorías en las que nunca se publica el nombre (Excel, «Propuesta de interfaz» C: anónimo por defecto). */
export const SIEMPRE_ANONIMO = new Set(['MP.SIN_CONSULTA', 'MP.TIERRAS']);

const TIPOS_CON_DATOS_PERSONALES = new Set(['recibo_factura', 'documento_oficial', 'recibo', 'factura', 'oficio', 'contrato', 'registro_oficial']);

/**
 * ¿Una evidencia recién subida debe quedar visible al público?
 * Solo en modos automáticos, con testimonio aprobado y autorización de multimedia; los recibos y documentos
 * oficiales (suelen traer nombre y domicilio) nunca se publican solos: requieren que alguien del equipo los revise.
 */
export function evidenciaPublicaPorDefecto(
  modo: ModoPublicacion,
  estadoTestimonio: string,
  autorizaMultimedia: 'si' | 'no' | 'na',
  tipo: string,
): boolean {
  if (modo === 'revisar_todo') return false;
  if (estadoTestimonio !== 'aprobado' || autorizaMultimedia !== 'si') return false;
  return !TIPOS_CON_DATOS_PERSONALES.has(tipo);
}
