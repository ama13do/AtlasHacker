import { sql } from 'drizzle-orm';
import { enSerie, getDb } from '../db/client.js';

type Fila = Record<string, unknown>;
const filas = async <T extends Fila>(consulta: ReturnType<typeof sql>) => [...(await getDb().execute<T>(consulta))];

/** Resumen general para el dashboard (todos los conteos en un solo viaje). */
export async function resumen() {
  const [tot] = await filas<{
    total: number; pendientes: number; aprobados: number; rechazados: number; inactivos: number; publicos: number; sensibles: number;
    pendientes_antiguos: number; ultimos_7_dias: number; reacciones: number;
  }>(sql`
    select count(*)::int as total,
           count(*) filter (where estado = 'pendiente' and activo)::int as pendientes,
           count(*) filter (where estado = 'aprobado')::int as aprobados,
           count(*) filter (where estado = 'rechazado')::int as rechazados,
           count(*) filter (where not activo)::int as inactivos,
           count(*) filter (where es_publico)::int as publicos,
           count(*) filter (where info_sensible)::int as sensibles,
           count(*) filter (where estado = 'pendiente' and activo and created_at < now() - interval '7 days')::int as pendientes_antiguos,
           count(*) filter (where created_at >= now() - interval '7 days')::int as ultimos_7_dias,
           coalesce(sum(reacciones_total), 0)::int as reacciones
    from testimonios`);

  const [porCategoria, porExpediente, porOrigen, [part], [com], [evi], serie] = await enSerie(
    () => filas(sql`
      select c.id, c.slug, c.nombre, c.color, count(t.id)::int as total,
             count(t.id) filter (where t.es_publico)::int as publicos,
             count(t.id) filter (where t.estado = 'pendiente' and t.activo)::int as pendientes
      from categorias c left join testimonios t on t.categoria_id = c.id
      group by c.id order by c.orden, c.nombre`),
    () => filas(sql`
      select e.id, e.codigo, e.materia, count(t.id)::int as total, count(t.id) filter (where t.es_publico)::int as publicos
      from expedientes e left join testimonios t on t.expediente_id = e.id
      group by e.id order by e.codigo`),
    () => filas(sql`select origen, count(*)::int as total from testimonios group by origen order by total desc`),
    () => filas<{ total: number; con_perfil_publico: number; con_correo: number; con_telefono: number; activos: number }>(sql`
      select count(*)::int as total,
             count(*) filter (where perfil_publico)::int as con_perfil_publico,
             count(*) filter (where correo_enc is not null)::int as con_correo,
             count(*) filter (where telefono_enc is not null)::int as con_telefono,
             count(*) filter (where activo)::int as activos
      from participantes`),
    () => filas<{ total: number; pendientes: number; ocultos: number; likes: number }>(sql`
      select count(*)::int as total,
             count(*) filter (where estado = 'pendiente')::int as pendientes,
             count(*) filter (where not activo)::int as ocultos,
             coalesce(sum(likes_conteo), 0)::int as likes
      from comentarios`),
    () => filas<{ total: number; bytes: number; publicas: number }>(sql`
      select count(*)::int as total, coalesce(sum(bytes), 0)::bigint as bytes, count(*) filter (where publica)::int as publicas
      from evidencias where estado_subida = 'subida' and activo`),
    () => filas(sql`
      select to_char(d::date, 'YYYY-MM-DD') as fecha,
             count(t.id)::int as recibidos,
             count(t.id) filter (where t.estado = 'aprobado')::int as aprobados
      from generate_series(current_date - 29, current_date, interval '1 day') d
      left join testimonios t on t.created_at::date = d::date
      group by d order by d`),
  );

  return {
    testimonios: tot,
    por_categoria: porCategoria,
    por_expediente: porExpediente,
    por_origen: porOrigen,
    participantes: part,
    comentarios: com,
    evidencias: { ...evi, bytes: Number(evi?.bytes ?? 0) },
    ultimos_30_dias: serie,
  };
}

/** Serie de tiempo de testimonios recibidos / aprobados. */
export async function serie(desde: string, hasta: string, agrupar: 'dia' | 'semana' | 'mes', categoria?: string) {
  const paso = { dia: 'day', semana: 'week', mes: 'month' }[agrupar];
  return filas(sql`
    select to_char(date_trunc(${paso}, t.created_at), 'YYYY-MM-DD') as periodo,
           count(*)::int as recibidos,
           count(*) filter (where t.estado = 'aprobado')::int as aprobados,
           count(*) filter (where t.estado = 'rechazado')::int as rechazados
    from testimonios t
    ${categoria ? sql`join categorias c on c.id = t.categoria_id and c.slug = ${categoria}` : sql``}
    where t.created_at >= ${desde}::date and t.created_at < (${hasta}::date + 1)
    group by 1 order by 1`);
}

/** Distribución geográfica: por entidad y celdas (para mapa de calor en el dashboard). Usa la ubicación exacta: solo personal. */
export async function geografia(celda: number) {
  const [porEntidad, celdas] = await enSerie(
    () => filas(sql`
      select coalesce(entidad, '(sin entidad)') as entidad, count(*)::int as total, count(*) filter (where es_publico)::int as publicos
      from testimonios where activo group by 1 order by total desc`),
    () => filas(sql`
      select ST_X(g)::float as lng, ST_Y(g)::float as lat, count(*)::int as total
      from (select ST_SnapToGrid(centroide, ${celda}) as g from testimonios where activo) s
      group by g order by total desc limit 2000`),
  );
  return { por_entidad: porEntidad, celdas };
}
