import { supabase } from '../config/supabase.js';
import { z } from 'zod';
import type { Context } from 'hono';

const reaccionSchema = z.object({
  tipo: z.enum(['like', 'apoyo', 'alerta', 'fuego']).default('like'),
  usuario_fingerprint: z.string().max(100).optional(),
});

export const agregarReaccion = async (c: Context) => {
  try {
    const testimonio_id = c.req.param('id');
    const body = await c.req.json();
    const parseResult = reaccionSchema.safeParse(body);

    if (!parseResult.success) {
      return c.json({ error: 'Datos de reacción inválidos', detalles: parseResult.error.flatten() }, 400);
    }

    const { tipo, usuario_fingerprint } = parseResult.data;

    // 1. Guardar registro individual de reacción
    const { data, error } = await supabase
      .from('reacciones')
      .insert({
        testimonio_id,
        tipo,
        usuario_fingerprint: usuario_fingerprint || null,
      })
      .select('id, testimonio_id, tipo, created_at')
      .single();

    if (error) {
      return c.json({ error: 'No se pudo registrar la reacción', detalle: error.message }, 500);
    }

    // 2. Opcional: Actualizar el jsonb acumulado en testimonios
    // Traemos el testimonio para sumar el contador
    const { data: testData } = await supabase
      .from('testimonios')
      .select('reacciones_conteo')
      .eq('id', testimonio_id)
      .single();

    if (testData) {
      const conteo = testData.reacciones_conteo || {};
      conteo[tipo] = (conteo[tipo] || 0) + 1;

      await supabase
        .from('testimonios')
        .update({ reacciones_conteo: conteo })
        .eq('id', testimonio_id);
    }

    return c.json({ success: true, data }, 201);
  } catch (err: any) {
    return c.json({ error: 'Error interno del servidor', detalle: err?.message }, 500);
  }
};
