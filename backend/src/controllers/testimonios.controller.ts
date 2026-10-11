import { supabase } from '../config/supabase.js';
import { z } from 'zod';
import type { Context } from 'hono';

const crearTestimonioSchema = z.object({
  titulo: z.string().min(3, 'El título debe tener al menos 3 caracteres').max(255),
  descripcion: z.string().min(5, 'La descripción debe tener al menos 5 caracteres'),
  autor_nombre: z.string().max(100).optional().default('Anónimo'),
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
  media_url: z.string().url().optional().nullable(),
  media_tipo: z.enum(['imagen', 'audio', 'video', 'documento', 'ninguno']).default('ninguno'),
  categoria: z.string().max(100).optional().default('general'),
});

// 1. Crear Testimonio con punto PostGIS
export const crearTestimonio = async (c: Context) => {
  try {
    const body = await c.req.json();
    const parseResult = crearTestimonioSchema.safeParse(body);

    if (!parseResult.success) {
      return c.json(
        { error: 'Datos inválidos', detalles: parseResult.error.flatten() },
        400
      );
    }

    const {
      titulo,
      descripcion,
      autor_nombre,
      latitud,
      longitud,
      media_url,
      media_tipo,
      categoria,
    } = parseResult.data;

    // En PostGIS para tipo geography(Point, 4326), se almacena en orden: POINT(longitud latitud)
    const puntoWkt = `POINT(${longitud} ${latitud})`;

    const { data, error } = await supabase
      .from('testimonios')
      .insert({
        titulo,
        descripcion,
        autor_nombre,
        ubicacion: puntoWkt,
        media_url: media_url || null,
        media_tipo,
        categoria,
      })
      .select('id, titulo, descripcion, autor_nombre, latitud, longitud, media_url, media_tipo, categoria, reacciones_conteo, created_at')
      .single();

    if (error) {
      console.error('Error insertando testimonio en Supabase:', error);
      return c.json({ error: 'Error al registrar testimonio', detalle: error.message }, 500);
    }

    return c.json({ success: true, data }, 201);
  } catch (err: any) {
    console.error('Error en crearTestimonio:', err);
    return c.json({ error: 'Error interno del servidor', detalle: err?.message }, 500);
  }
};

// 2. Listar Testimonios (Con soporte de PostGIS: Radio o Bounding Box o General)
export const listarTestimonios = async (c: Context) => {
  try {
    const latStr = c.req.query('lat');
    const lngStr = c.req.query('lng');
    const radioStr = c.req.query('radio'); // metros

    const minLngStr = c.req.query('min_lng');
    const minLatStr = c.req.query('min_lat');
    const maxLngStr = c.req.query('max_lng');
    const maxLatStr = c.req.query('max_lat');

    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    // Caso A: Búsqueda por Radio espacial (ej. alrededor de la ubicación del usuario)
    if (latStr && lngStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      const radio = radioStr ? parseFloat(radioStr) : 10000; // 10km default

      const { data, error } = await supabase.rpc('buscar_testimonios_en_radio', {
        lat,
        lng,
        radio_metros: radio,
      });

      if (error) {
        console.error('Error ejecutando RPC buscar_testimonios_en_radio:', error);
        return c.json({ error: 'Error en búsqueda por radio', detalle: error.message }, 500);
      }

      return c.json({ success: true, total: data?.length || 0, data });
    }

    // Caso B: Búsqueda por Bounding Box (para la vista de pantalla actual del mapa en Leaflet/Mapbox)
    if (minLngStr && minLatStr && maxLngStr && maxLatStr) {
      const min_lng = parseFloat(minLngStr);
      const min_lat = parseFloat(minLatStr);
      const max_lng = parseFloat(maxLngStr);
      const max_lat = parseFloat(maxLatStr);

      const { data, error } = await supabase.rpc('buscar_testimonios_en_bbox', {
        min_lng,
        min_lat,
        max_lng,
        max_lat,
      });

      if (error) {
        console.error('Error ejecutando RPC buscar_testimonios_en_bbox:', error);
        return c.json({ error: 'Error en búsqueda espacial por pantalla', detalle: error.message }, 500);
      }

      return c.json({ success: true, total: data?.length || 0, data });
    }

    // Caso C: Listado general paginado
    const { data, error, count } = await supabase
      .from('testimonios')
      .select('id, titulo, descripcion, autor_nombre, latitud, longitud, media_url, media_tipo, categoria, reacciones_conteo, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error listando testimonios:', error);
      return c.json({ error: 'Error al consultar testimonios', detalle: error.message }, 500);
    }

    return c.json({ success: true, total: count || data?.length || 0, data });
  } catch (err: any) {
    console.error('Error en listarTestimonios:', err);
    return c.json({ error: 'Error interno del servidor', detalle: err?.message }, 500);
  }
};

// 3. Obtener Testimonio por ID (con comentarios)
export const obtenerTestimonioPorId = async (c: Context) => {
  try {
    const id = c.req.param('id');

    const { data: testimonio, error: testError } = await supabase
      .from('testimonios')
      .select('id, titulo, descripcion, autor_nombre, latitud, longitud, media_url, media_tipo, categoria, reacciones_conteo, created_at')
      .eq('id', id)
      .single();

    if (testError || !testimonio) {
      return c.json({ error: 'Testimonio no encontrado' }, 404);
    }

    const { data: comentarios } = await supabase
      .from('comentarios')
      .select('id, autor_nombre, contenido, created_at')
      .eq('testimonio_id', id)
      .order('created_at', { ascending: true });

    return c.json({
      success: true,
      data: {
        ...testimonio,
        comentarios: comentarios || [],
      },
    });
  } catch (err: any) {
    return c.json({ error: 'Error interno', detalle: err?.message }, 500);
  }
};
