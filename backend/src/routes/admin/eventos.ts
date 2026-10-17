import { createRoute, z } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { eventos } from '../../db/schema.js';
import { E } from '../../lib/errors.js';
import { requiereUsuario } from '../../middleware/seguridad.js';
import { ERRORES, IdParam, SEG_USUARIO, cuerpo, resp } from '../../schemas/comunes.js';
import { registrarBitacora } from '../../services/bitacora.js';
import { horasDeEvento, resumenEventos } from '../../services/ir.js';
import { nuevoRouter, ok, sinCache } from '../base.js';

export const adminEventos = nuevoRouter();
const TAG = ['Dashboard · Enlace /ir y eventos'];
// Ver: administración y lectura (como el resumen). Crear y editar: administración. Borrar: solo superadmin
const LEER = { security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'lector')] };
const ADMIN = { security: SEG_USUARIO, middleware: [requiereUsuario('admin')] };
const SUPERADMIN = { security: SEG_USUARIO, middleware: [requiereUsuario('superadmin')] };

const Fecha = z.iso.datetime({ offset: true }).openapi({ example: '2026-10-18T10:00:00-06:00' });
const EventoCrear = z
  .object({
    nombre: z.string().trim().min(2).max(160).openapi({ example: 'Feria de energía CDMX' }),
    lugar: z.string().trim().max(200).optional(),
    inicio: Fecha,
    fin: Fecha,
  })
  .openapi('CrearEvento');
const EventoEditar = EventoCrear.partial().openapi('EditarEvento');

const validarHorario = (inicio: Date, fin: Date) => {
  if (fin <= inicio) throw E.invalido('El evento debe terminar después de empezar');
  if (fin.getTime() - inicio.getTime() > 31 * 86_400_000) throw E.invalido('Un evento no puede durar más de 31 días');
};

adminEventos.openapi(
  createRoute({
    ...LEER, tags: TAG, method: 'get', path: '/api/admin/eventos', summary: 'Visitas al enlace /ir por evento',
    description:
      'Totales del enlace (siempre y hoy), cada evento con las visitas que caen en su horario, las visitas fuera de cualquier evento y la serie diaria. ' +
      '`unicos` = personas distintas (IP + dispositivo) por día.',
    request: { query: z.object({ dias: z.coerce.number().int().min(7).max(366).default(60) }) },
    responses: { 200: resp('Resumen del enlace y eventos'), ...ERRORES },
  }),
  async (c) => {
    sinCache(c);
    return c.json(ok(await resumenEventos(c.req.valid('query').dias)), 200);
  },
);

adminEventos.openapi(
  createRoute({
    ...LEER, tags: TAG, method: 'get', path: '/api/admin/eventos/{id}/horas', summary: 'Visitas por hora de un evento',
    request: { params: IdParam }, responses: { 200: resp('Horas con visitas'), ...ERRORES },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const [e] = await getDb().select({ id: eventos.id }).from(eventos).where(eq(eventos.id, id)).limit(1);
    if (!e) throw E.noEncontrado('Evento');
    return c.json(ok(await horasDeEvento(id)), 200);
  },
);

adminEventos.openapi(
  createRoute({
    ...ADMIN, tags: TAG, method: 'post', path: '/api/admin/eventos', summary: 'Registrar un evento',
    description: 'Se puede registrar después: las visitas se guardan por hora y el evento toma las que caen en su horario.',
    request: { body: cuerpo(EventoCrear) }, responses: { 201: resp('Evento creado'), ...ERRORES },
  }),
  async (c) => {
    const b = c.req.valid('json');
    const inicio = new Date(b.inicio);
    const fin = new Date(b.fin);
    validarHorario(inicio, fin);
    const [e] = await getDb()
      .insert(eventos)
      .values({ nombre: b.nombre, lugar: b.lugar || null, inicio, fin, created_by: c.get('usuario')!.id })
      .returning();
    await registrarBitacora(c, { accion: 'evento.crear', entidad: 'evento', entidadId: e!.id, despues: { nombre: e!.nombre, inicio: e!.inicio, fin: e!.fin } });
    return c.json(ok(e!), 201);
  },
);

adminEventos.openapi(
  createRoute({
    ...ADMIN, tags: TAG, method: 'patch', path: '/api/admin/eventos/{id}', summary: 'Editar un evento',
    request: { params: IdParam, body: cuerpo(EventoEditar) }, responses: { 200: resp('Evento actualizado'), ...ERRORES },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const b = c.req.valid('json');
    if (Object.keys(b).length === 0) throw E.invalido('No hay cambios que aplicar');
    const db = getDb();
    const [antes] = await db.select().from(eventos).where(eq(eventos.id, id)).limit(1);
    if (!antes) throw E.noEncontrado('Evento');
    const cambios = {
      ...(b.nombre !== undefined && { nombre: b.nombre }),
      ...(b.lugar !== undefined && { lugar: b.lugar || null }),
      ...(b.inicio !== undefined && { inicio: new Date(b.inicio) }),
      ...(b.fin !== undefined && { fin: new Date(b.fin) }),
    };
    validarHorario(cambios.inicio ?? antes.inicio, cambios.fin ?? antes.fin);
    const [e] = await db.update(eventos).set(cambios).where(eq(eventos.id, id)).returning();
    const previo = Object.fromEntries(Object.keys(cambios).map((k) => [k, antes[k as keyof typeof antes]]));
    await registrarBitacora(c, { accion: 'evento.editar', entidad: 'evento', entidadId: id, antes: previo, despues: cambios });
    return c.json(ok(e!), 200);
  },
);

adminEventos.openapi(
  createRoute({
    ...SUPERADMIN, tags: TAG, method: 'delete', path: '/api/admin/eventos/{id}', summary: 'Borrar un evento',
    description: 'Solo superadmin. Borra el evento (nombre y horario), NO las visitas: esas horas pasan a «fuera de evento».',
    request: { params: IdParam }, responses: { 200: resp('Evento borrado'), ...ERRORES },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const [e] = await getDb().delete(eventos).where(eq(eventos.id, id)).returning();
    if (!e) throw E.noEncontrado('Evento');
    await registrarBitacora(c, { accion: 'evento.eliminar', entidad: 'evento', entidadId: id, antes: { nombre: e.nombre, inicio: e.inicio, fin: e.fin } });
    return c.json(ok({ id }), 200);
  },
);
