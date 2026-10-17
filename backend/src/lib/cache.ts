/**
 * Caché en memoria para lecturas públicas muy repetidas (mapa, listado, ficha, catálogos). Cada contenedor de
 * Lambda tiene la suya: con 50 personas abriendo el mapa, la base responde una vez por contenedor y por TTL en
 * lugar de una vez por persona. Cualquier escritura en el mismo contenedor la vacía (ver app.ts); en los demás,
 * lo publicado tarda a lo más el TTL en aparecer (el tiempo real del mapa lo agrega antes).
 */
const almacen = new Map<string, { valor: unknown; hasta: number }>();
const MAX_ENTRADAS = 300;

export async function enCache<T>(clave: string, segundos: number, cargar: () => Promise<T>): Promise<T> {
  const ahora = Date.now();
  const hit = almacen.get(clave);
  if (hit && hit.hasta > ahora) return hit.valor as T;
  const valor = await cargar();
  almacen.delete(clave);
  // Map conserva el orden de inserción: se sacan las más viejas
  while (almacen.size >= MAX_ENTRADAS) almacen.delete(almacen.keys().next().value!);
  almacen.set(clave, { valor, hasta: ahora + segundos * 1000 });
  return valor;
}

export const limpiarCache = () => almacen.clear();

/** Clave estable a partir de los filtros ya validados (el orden de las propiedades no importa). */
export const claveDe = (prefijo: string, filtros: Record<string, unknown>) =>
  `${prefijo}:${JSON.stringify(Object.keys(filtros).sort().map((k) => [k, filtros[k]]))}`;
