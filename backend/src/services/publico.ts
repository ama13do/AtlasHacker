import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { enSerie, getDb } from '../db/client.js';
import { bboxSql, colDe, featureCollection, geoJson, geoJsonSimple, puntoSql, tsPreciso } from '../db/geo.js';
import { categorias, expedientes, participantes, testimonios, v_testimonios_publicos as v } from '../db/schema.js';
import { enCache } from '../lib/cache.js';
import { E } from '../lib/errors.js';
import { codificarCursor, decodificarCursor } from '../lib/paginacion.js';
import type { FiltrosPublicos } from '../schemas/testimonios.js';
import { evidenciasPublicas } from './evidencias.js';

/** WHERE común del mapa y del listado público. Todo sale de la vista v_testimonios_publicos. */
function condiciones(f: FiltrosPublicos): (SQL | undefined)[] {
  const c: (SQL | undefined)[] = [];
  if (f.categoria) c.push(inArray(v.categoria_slug, f.categoria.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)));
  if (f.expediente) c.push(eq(v.expediente_codigo, f.expediente.toUpperCase()));
  if (f.entidad) c.push(eq(v.entidad, f.entidad));
  if (f.q) c.push(sql`${v.busqueda} @@ websearch_to_tsquery('spanish', ${f.q})`);
  if (f.desde) c.push(sql`${v.fecha} >= ${f.desde}::date`);
  if (f.hasta) c.push(sql`${v.fecha} <= ${f.hasta}::date`);
  if (f.bbox) c.push(sql`${v.ubicacion_publica} && ${bboxSql(...f.bbox)}`);
  if (f.lat !== undefined && f.lng !== undefined) {
    c.push(sql`ST_DWithin(${v.ubicacion_publica}::geography, ${puntoSql(f.lng, f.lat)}::geography, ${f.radio ?? 10000})`);
  } else if (f.radio !== undefined) {
    throw E.invalido('"radio" requiere "lat" y "lng"');
  }
  return c;
}

/* ───────────────────────────────────────────── Mapa ───────────────────────────────────────────── */

/** GeoJSON FeatureCollection listo para Leaflet/Mapbox/MapLibre. */
export async function mapaPublico(f: FiltrosPublicos & { geometria: 'punto' | 'simple' | 'completa'; limite: number }) {
  const geom = f.geometria === 'completa' ? geoJson(v.ubicacion_publica) : f.geometria === 'simple' ? geoJsonSimple(v.ubicacion_publica) : geoJson(v.centroide_publico);
  const orden = f.lat !== undefined && f.lng !== undefined ? sql`ST_Distance(${v.ubicacion_publica}::geography, ${puntoSql(f.lng, f.lat)}::geography)` : desc(v.created_at);
  const filas = await getDb()
    .select({
      id: v.id, folio: v.folio, titulo: v.titulo, categoria_slug: v.categoria_slug, categoria_nombre: v.categoria_nombre, categoria_color: v.categoria_color,
      tipo_geometria: v.tipo_geometria, aproximada: v.ubicacion_aproximada, fecha: v.fecha, lugar_territorio: v.lugar_territorio,
      reacciones_total: v.reacciones_total, comentarios_conteo: v.comentarios_conteo, geometry: geom,
    })
    .from(v)
    .where(and(...condiciones(f)))
    .orderBy(orden)
    .limit(f.limite + 1);

  const truncado = filas.length > f.limite;
  const features = filas.slice(0, f.limite).map(({ geometry, ...properties }) => ({ type: 'Feature' as const, id: properties.id, geometry, properties }));
  return featureCollection(features, { truncado, limite: f.limite });
}

/* ───────────────────────────────────── Listado paginado por cursor ───────────────────────────────────── */

export async function listarPublicos(f: FiltrosPublicos, limite: number, cursorRaw?: string) {
  const cursor = decodificarCursor(cursorRaw);
  const cond = condiciones(f);
  if (cursor) cond.push(sql`(${v.created_at}, ${v.id}) < (${cursor.t}::timestamptz, ${cursor.id}::uuid)`);

  const filas = await getDb()
    .select({
      id: v.id, folio: v.folio, expediente_codigo: v.expediente_codigo, categoria_slug: v.categoria_slug, categoria_nombre: v.categoria_nombre, categoria_color: v.categoria_color,
      titulo: v.titulo, fecha: v.fecha, lugar_territorio: v.lugar_territorio, entidad: v.entidad, municipio: v.municipio, nombre_publico: v.nombre_publico,
      relato_resumen: sql<string>`left(${v.relato}, 280)`, tipo_geometria: v.tipo_geometria, aproximada: v.ubicacion_aproximada,
      centroide: geoJson(v.centroide_publico), reacciones_conteo: v.reacciones_conteo, reacciones_total: v.reacciones_total, comentarios_conteo: v.comentarios_conteo,
      created_at: v.created_at, cursor_t: tsPreciso(v.created_at as never),
    })
    .from(v)
    .where(and(...cond))
    .orderBy(desc(v.created_at), desc(v.id))
    .limit(limite + 1);

  const hayMas = filas.length > limite;
  const pagina = filas.slice(0, limite);
  const ultimo = pagina[pagina.length - 1];
  return {
    items: pagina.map(({ cursor_t: _t, ...resto }) => resto),
    siguiente_cursor: hayMas && ultimo ? codificarCursor({ t: ultimo.cursor_t, id: ultimo.id! }) : null,
  };
}

/* ────────────────────────────────────────────── Detalle ────────────────────────────────────────────── */

export async function detallePublico(id: string) {
  const [t] = await getDb()
    .select({
      id: v.id, folio: v.folio, expediente_codigo: v.expediente_codigo, categoria_slug: v.categoria_slug, categoria_nombre: v.categoria_nombre, categoria_color: v.categoria_color,
      titulo: v.titulo, fecha: v.fecha, lugar_territorio: v.lugar_territorio, entidad: v.entidad, municipio: v.municipio, nombre_publico: v.nombre_publico,
      relato: v.relato, territorio_dice: v.territorio_dice, comunidad_dice: v.comunidad_dice, tiene_evidencia: v.tiene_evidencia, evidencia_tipos: v.evidencia_tipos,
      dato_fuente_anio: v.dato_fuente_anio, fuentes: v.fuentes, fuente_pendiente_verificacion: v.fuente_pendiente_verificacion, pregunta_tribunal: v.pregunta_tribunal, algo_mas: v.algo_mas,
      tipo_geometria: v.tipo_geometria, aproximada: v.ubicacion_aproximada, ubicacion: geoJson(v.ubicacion_publica), centroide: geoJson(v.centroide_publico),
      reacciones_conteo: v.reacciones_conteo, reacciones_total: v.reacciones_total, comentarios_conteo: v.comentarios_conteo, publicado_at: v.publicado_at, created_at: v.created_at,
    })
    .from(v)
    .where(eq(v.id, id))
    .limit(1);
  if (!t) throw E.noEncontrado('Testimonio');
  return { ...t, evidencias: await evidenciasPublicas(id) };
}

/* ───────────────────────────────────── Catálogos y estadísticas ───────────────────────────────────── */

export async function catalogosPublicos() {
  const db = getDb();
  const [cats, exps] = await enSerie(
    () => db.select({ id: categorias.id, slug: categorias.slug, nombre: categorias.nombre, descripcion: categorias.descripcion, color: categorias.color, icono: categorias.icono }).from(categorias).where(eq(categorias.activo, true)).orderBy(categorias.orden, categorias.nombre),
    () => db.select({ id: expedientes.id, codigo: expedientes.codigo, titulo: expedientes.titulo, materia: expedientes.materia, descripcion: expedientes.descripcion }).from(expedientes).where(eq(expedientes.activo, true)).orderBy(expedientes.codigo),
  );
  return { categorias: cats, expedientes: exps };
}

/** Contadores públicos para la portada del mapa (caché de 30 s). */
export const estadisticasPublicas = () => enCache('estadisticas', 30, calcularEstadisticas);

async function calcularEstadisticas() {
  const db = getDb();
  const [[tot], porCategoria, porEntidad] = await enSerie(
    () => db.select({ testimonios: sql<number>`count(*)::int`, ultimo: sql<string | null>`max(${v.publicado_at})` }).from(v),
    () => db.execute<{ slug: string; nombre: string; color: string | null; total: number }>(sql`
      select c.slug, c.nombre, c.color, count(v.id)::int as total
      from categorias c left join v_testimonios_publicos v on v.categoria_id = c.id
      where c.activo group by c.id order by c.orden, c.nombre`),
    () => db.execute<{ entidad: string; total: number }>(sql`
      select entidad, count(*)::int as total from v_testimonios_publicos where entidad is not null group by entidad order by total desc limit 40`),
  );
  return {
    testimonios: tot?.testimonios ?? 0,
    ultimo_publicado_at: tot?.ultimo ?? null,
    por_categoria: [...porCategoria],
    por_entidad: [...porEntidad],
  };
}

/** Personas que decidieron hacer público su perfil (con el nombre que quisieron mostrar) y cuántos testimonios tienen publicados. */
export async function colaboradoresPublicos() {
  return getDb()
    .select({
      id: participantes.id,
      nombre_publico: participantes.nombre_publico,
      testimonios_publicados: sql<number>`(select count(*)::int from ${testimonios} t where t.participante_id = ${colDe('participantes', 'id')} and t.es_publico)`,
    })
    .from(participantes)
    .where(and(eq(participantes.perfil_publico, true), eq(participantes.activo, true)))
    .orderBy(desc(sql`2`))
    .limit(500);
}
