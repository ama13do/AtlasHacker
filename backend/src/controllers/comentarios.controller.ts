import { supabase } from '../config/supabase.js';
import { z } from 'zod';
import type { Context } from 'hono';

const comentarioSchema = z.object({
  contenido: z.string().min(1, 'El contenido no puede estar vacío').max(1000),
  autor_nombre: z.string().max(100).optional().default('Anónimo'),
});

export const agregarComentario = async (c: Context) => {
  try {
    const testimonio_id = c.req.param('id');
    const body = await c.req.json();
    const parseResult = comentarioSchema.safeParse(body);

    if (!parseResult.success) {
      return c.json({ error: 'Datos inválidos', detalles: parseResult.error.flatten() }, 400);
    }

    const { contenido, autor_nombre } = parseResult.data;

    const { data, error } = await supabase
      .from('comentarios')
      .insert({
        testimonio_id,
        contenido,
        autor_nombre,
      })
      .select('id, testimonio_id, autor_nombre, contenido, created_at')
      .single();

    if (error) {
      return c.json({ error: 'No se pudo guardar el comentario', detalle: error.message }, 500);
    }

    return c.json({ success: true, data }, 201);
  } catch (err: any) {
    return c.json({ error: 'Error interno del servidor', detalle: err?.message }, 500);
  }
};

export const listarComentarios = async (c: Context) => {
  try {
    const testimonio_id = c.req.param('id');

    const { data, error } = await supabase
      .from('comentarios')
      .select('id, autor_nombre, contenido, created_at')
      .eq('testimonio_id', testimonio_id)
      .order('created_at', { ascending: true });

    if (error) {
      return c.json({ error: 'Error al consultar comentarios', detalle: error.message }, 500);
    }

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ error: 'Error interno', detalle: err?.message }, 500);
  }
};
