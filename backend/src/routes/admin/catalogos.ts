import { createRoute, z } from '@hono/zod-openapi';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { categorias, expedientes } from '../../db/schema.js';
import { E, esViolacionUnica } from '../../lib/errors.js';
import { requiereUsuario } from '../../middleware/seguridad.js';
import { ERRORES, IdParam, SEG_USUARIO, cuerpo, resp } from '../../schemas/comunes.js';
import { registrarBitacora } from '../../services/bitacora.js';
import { nuevoRouter, ok } from '../base.js';

export const adminCatalogos = nuevoRouter();
const TAG_CAT = ['Dashboard · Categorías'];
const TAG_EXP = ['Dashboard · Expedientes'];
const LEER = { security: SEG_USUARIO, middleware: [requiereUsuario('admin', 'moderador', 'lector', 'facilitador')] };
const ADMIN = { security: SEG_USUARIO, middleware: [requiereUsuario('admin')] };

/* ───────────────────────────────────────────────── Categorías ───────────────────────────────────────────────── */

const CategoriaCrear = z
  .object({
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones').max(80),
    nombre: z.string().trim().min(2).max(120),
    descripcion: z.string().trim().max(1000).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Formato #RRGGBB').optional(),
    icono: z.string().trim().max(60).optional(),
    orden: z.number().int().min(0).max(1000).optional(),
  })
  .openapi('CrearCategoria');
const CategoriaEditar = CategoriaCrear.partial().extend({ activo: z.boolean().optional() }).openapi('EditarCategoria');

adminCatalogos.openapi(
  createRoute({ ...LEER, tags: TAG_CAT, method: 'get', path: '/api/admin/categorias', summary: 'Todas las categorías (incluye inactivas)', responses: { 200: resp('Categorías'), ...ERRORES } }),
  async (c) => c.json(ok(await getDb().select().from(categorias).orderBy(asc(categorias.orden), asc(categorias.nombre))), 200),
);

adminCatalogos.openapi(
  createRoute({
    ...ADMIN, tags: TAG_CAT, method: 'post', path: '/api/admin/categorias', summary: 'Crear categoría',
    description: 'Ejemplos: inseguridad-energetica, afectaciones-cambio-climatico, megaproyectos.',
    request: { body: cuerpo(CategoriaCrear) }, responses: { 201: resp('Categoría creada'), ...ERRORES },
  }),
  async (c) => {
    try {
      const [cat] = await getDb().insert(categorias).values(c.req.valid('json')).returning();
      await registrarBitacora(c, { accion: 'categoria.crear', entidad: 'categoria', entidadId: cat!.id, despues: { slug: cat!.slug } });
      return c.json(ok(cat!), 201);
    } catch (err) {
      if (esViolacionUnica(err)) throw E.conflicto('Ya existe una categoría con ese slug', 'SLUG_DUPLICADO');
      throw err;
    }
  },
);

adminCatalogos.openapi(
  createRoute({
    ...ADMIN, tags: TAG_CAT, method: 'patch', path: '/api/admin/categorias/{id}', summary: 'Editar o activar/desactivar una categoría',
    request: { params: IdParam, body: cuerpo(CategoriaEditar) }, responses: { 200: resp('Categoría actualizada'), ...ERRORES },
  }),
  async (c) => {
    const cambios = c.req.valid('json');
    if (Object.keys(cambios).length === 0) throw E.invalido('No hay cambios que aplicar');
    try {
      const [cat] = await getDb().update(categorias).set(cambios).where(eq(categorias.id, c.req.valid('param').id)).returning();
      if (!cat) throw E.noEncontrado('Categoría');
      await registrarBitacora(c, { accion: 'categoria.editar', entidad: 'categoria', entidadId: cat.id, despues: cambios });
      return c.json(ok(cat), 200);
    } catch (err) {
      if (esViolacionUnica(err)) throw E.conflicto('Ya existe una categoría con ese slug', 'SLUG_DUPLICADO');
      throw err;
    }
  },
);

/* ───────────────────────────────────────────────── Expedientes ───────────────────────────────────────────────── */

const ExpedienteCrear = z
  .object({
    codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]+(\/[A-Z0-9]+)*$/, 'Ejemplo: FUTURO/002').max(40),
    titulo: z.string().trim().min(2).max(200),
    materia: z.string().trim().min(2).max(200).openapi({ example: 'Sistema Energético Nacional' }),
    descripcion: z.string().trim().max(2000).optional(),
  })
  .openapi('CrearExpediente');
const ExpedienteEditar = ExpedienteCrear.partial().extend({ activo: z.boolean().optional() }).openapi('EditarExpediente');

adminCatalogos.openapi(
  createRoute({ ...LEER, tags: TAG_EXP, method: 'get', path: '/api/admin/expedientes', summary: 'Todos los expedientes (incluye inactivos)', responses: { 200: resp('Expedientes'), ...ERRORES } }),
  async (c) => c.json(ok(await getDb().select().from(expedientes).orderBy(asc(expedientes.codigo))), 200),
);

adminCatalogos.openapi(
  createRoute({
    ...ADMIN, tags: TAG_EXP, method: 'post', path: '/api/admin/expedientes', summary: 'Crear expediente',
    description: 'Un expediente es un apartado propio con su número (p. ej. FUTURO/001) y su materia. Los folios de testimonio y evidencia usan su código.',
    request: { body: cuerpo(ExpedienteCrear) }, responses: { 201: resp('Expediente creado'), ...ERRORES },
  }),
  async (c) => {
    try {
      const [e] = await getDb().insert(expedientes).values(c.req.valid('json')).returning();
      await registrarBitacora(c, { accion: 'expediente.crear', entidad: 'expediente', entidadId: e!.id, despues: { codigo: e!.codigo } });
      return c.json(ok(e!), 201);
    } catch (err) {
      if (esViolacionUnica(err)) throw E.conflicto('Ya existe un expediente con ese código', 'CODIGO_DUPLICADO');
      throw err;
    }
  },
);

adminCatalogos.openapi(
  createRoute({
    ...ADMIN, tags: TAG_EXP, method: 'patch', path: '/api/admin/expedientes/{id}', summary: 'Editar o activar/desactivar un expediente',
    description: 'Cambiar el código no modifica los folios ya emitidos.',
    request: { params: IdParam, body: cuerpo(ExpedienteEditar) }, responses: { 200: resp('Expediente actualizado'), ...ERRORES },
  }),
  async (c) => {
    const cambios = c.req.valid('json');
    if (Object.keys(cambios).length === 0) throw E.invalido('No hay cambios que aplicar');
    try {
      const [e] = await getDb().update(expedientes).set(cambios).where(eq(expedientes.id, c.req.valid('param').id)).returning();
      if (!e) throw E.noEncontrado('Expediente');
      await registrarBitacora(c, { accion: 'expediente.editar', entidad: 'expediente', entidadId: e.id, despues: cambios });
      return c.json(ok(e), 200);
    } catch (err) {
      if (esViolacionUnica(err)) throw E.conflicto('Ya existe un expediente con ese código', 'CODIGO_DUPLICADO');
      throw err;
    }
  },
);
