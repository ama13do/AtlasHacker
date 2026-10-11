import { sql, type SQL, type AnyColumn } from 'drizzle-orm';
import type { GeoJSONGeometry } from './schema.js';

/** Lee una columna geometry como GeoJSON (6 decimales ≈ 0.1 m). */
export const geoJson = (col: AnyColumn | SQL) => sql<GeoJSONGeometry | null>`ST_AsGeoJSON(${col}, 6)::jsonb`;

/** Geometría simplificada para vistas de mapa (tolerancia en grados; 0.0001 ≈ 11 m). */
export const geoJsonSimple = (col: AnyColumn | SQL, tolerancia = 0.0001) =>
  sql<GeoJSONGeometry | null>`ST_AsGeoJSON(ST_SimplifyPreserveTopology(${col}, ${tolerancia}), 6)::jsonb`;

export const bboxSql = (minLng: number, minLat: number, maxLng: number, maxLat: number) =>
  sql`ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)`;

export const puntoSql = (lng: number, lat: number) => sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

/** Fecha/hora con precisión de microsegundos como texto ISO (los Date de JS solo llegan a milisegundos; sirve para cursores). */
export const tsPreciso = (col: AnyColumn) =>
  sql<string>`to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

export function featureCollection(features: unknown[], extra: Record<string, unknown> = {}) {
  return { type: 'FeatureCollection' as const, features, ...extra };
}

/**
 * Referencia calificada "tabla"."columna" para usar DENTRO de subconsultas correlacionadas.
 * (Drizzle omite el nombre de tabla de las columnas cuando la consulta tiene una sola tabla, y entonces
 * `where x.id = ${tabla.id}` se convierte en `x.id = "id"`, que apunta a la tabla interna en vez de la externa.)
 */
export const colDe = (tabla: string, columna: string) => sql.raw(`"${tabla}"."${columna}"`);
