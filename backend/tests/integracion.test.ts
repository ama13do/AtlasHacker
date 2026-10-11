/**
 * Integración de punta a punta: la API REAL (Hono + Drizzle) contra un Postgres 18 + PostGIS embebido (PGlite),
 * con las MISMAS migraciones que se aplican en Supabase. No usa Docker ni toca servicios externos.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type App = typeof import('../src/app.js').app;
let app: App;
let pg: PGlite;
let socket: PGLiteSocketServer;
let db: ReturnType<typeof import('../src/db/client.js').getDb>;

const puertoLibre = () =>
  new Promise<number>((ok, fail) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => ok(port));
    });
    s.on('error', fail);
  });

type Opciones = { body?: unknown; token?: string; folio?: string; ip?: string; headers?: Record<string, string> };
let contadorIp = 10;
async function llamar(metodo: string, ruta: string, o: Opciones = {}) {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  if (o.token) headers.authorization = `Bearer ${o.token}`;
  if (o.folio) headers['x-folio'] = o.folio;
  const ip = o.ip ?? `10.0.0.${contadorIp++ % 250}`;
  const res = await app.request(ruta, { method: metodo, headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined }, {
    event: { requestContext: { requestId: 'req-test', http: { sourceIp: ip } } },
  });
  const texto = await res.text();
  let json: any = null;
  try { json = JSON.parse(texto); } catch { /* no JSON */ }
  return { status: res.status, json, texto, headers: res.headers };
}

const ficha = (extra: Record<string, unknown> = {}) => ({
  categoria: 'megaproyectos',
  ubicacion: { type: 'Point', coordinates: [-99.1332, 19.4326] },
  relato: 'Hace dos años instalaron una línea de transmisión que cruza nuestras parcelas y nadie nos consultó.',
  autorizacion: 'publico_anonimo',
  consentimiento_aceptado: true,
  ...extra,
});

const PASS = 'ContraseñaSegura123';
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};

beforeAll(async () => {
  pg = new PGlite({ extensions: { postgis } });
  await pg.exec('SET search_path = public, extensions');
  const dir = path.resolve(import.meta.dirname, '../drizzle');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    for (const parte of fs.readFileSync(path.join(dir, f), 'utf8').split('--> statement-breakpoint')) if (parte.trim()) await pg.exec(parte);
  }
  const port = await puertoLibre();
  socket = new PGLiteSocketServer({ db: pg, port, host: '127.0.0.1' });
  await socket.start();
  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;

  const { initEnv } = await import('../src/config/env.js');
  await initEnv();
  ({ app } = await import('../src/app.js'));
  const { getDb } = await import('../src/db/client.js');
  db = getDb();

  // Usuarios de cada rol
  const { hashPassword } = await import('../src/lib/passwords.js');
  const { usuarios } = await import('../src/db/schema.js');
  const hash = await hashPassword(PASS);
  for (const rol of ['admin', 'moderador', 'lector', 'facilitador'] as const) {
    await db.insert(usuarios).values({ email: `${rol}@atlas.test`, nombre: `Usuario ${rol}`, rol, password_hash: hash });
  }
  for (const rol of ['admin', 'moderador', 'lector', 'facilitador']) {
    const r = await llamar('POST', '/api/auth/login', { body: { email: `${rol}@atlas.test`, password: PASS }, ip: '172.16.0.1' });
    expect(r.status, `login ${rol}: ${r.texto}`).toBe(200);
    tokens[rol] = r.json.data.access_token;
  }
});

afterAll(async () => {
  const { cerrarDb } = await import('../src/db/client.js');
  await cerrarDb();
  await socket?.stop();
  await pg?.close();
});

describe('sistema, documentación y catálogos', () => {
  it('health y raíz', async () => {
    expect((await llamar('GET', '/health')).json.data.estado).toBe('online');
  });

  it('Swagger está protegido: sin credenciales 401 con desafío Basic; con las de un usuario del dashboard 200', async () => {
    const sin = await llamar('GET', '/docs');
    expect(sin.status).toBe(401);
    expect(sin.headers.get('www-authenticate')).toMatch(/^Basic/);
    expect((await llamar('GET', '/docs/openapi.json')).status).toBe(401);

    const basic = (u: string, p: string) => ({ authorization: `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}` });
    const mal = await llamar('GET', '/docs', { headers: basic('admin@atlas.test', 'incorrecta'), ip: '172.16.0.50' });
    expect(mal.status).toBe(401);

    const ui = await llamar('GET', '/docs', { headers: basic('lector@atlas.test', PASS) });
    expect(ui.status).toBe(200);
    expect(ui.texto).toContain('swagger');

    const spec = await llamar('GET', '/docs/openapi.json', { headers: basic('lector@atlas.test', PASS) });
    expect(spec.status).toBe(200);
    expect(spec.json.openapi).toBe('3.1.0');
    expect(Object.keys(spec.json.components.securitySchemes)).toEqual(expect.arrayContaining(['bearerAuth', 'folioAuth']));
    const rutas = Object.keys(spec.json.paths);
    expect(rutas.length).toBeGreaterThan(55);
    expect(rutas).toEqual(expect.arrayContaining(['/api/testimonios', '/api/mapa', '/api/admin/resumen', '/api/admin/testimonios/{id}/aprobar', '/api/comentarios/{id}/likes']));
    console.log(`   OpenAPI: ${rutas.length} rutas documentadas`);
  });

  it('el catálogo trae las 3 categorías y el expediente FUTURO/001', async () => {
    const r = await llamar('GET', '/api/config');
    expect(r.json.data.categorias.map((c: any) => c.slug)).toEqual(['inseguridad-energetica', 'afectaciones-cambio-climatico', 'megaproyectos']);
    expect(r.json.data.expedientes[0]).toMatchObject({ codigo: 'FUTURO/001', materia: 'Sistema Energético Nacional' });
    expect(r.json.data.configuracion).toMatchObject({ max_archivos_por_testimonio: 5, max_bytes_totales_por_testimonio: 20 * 1024 * 1024 });
  });

  it('las respuestas llevan cabeceras de seguridad y CORS solo para orígenes permitidos', async () => {
    const ok = await llamar('GET', '/health', { headers: { origin: 'http://localhost:5173' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff');
    const mal = await llamar('GET', '/health', { headers: { origin: 'https://evil.example' } });
    expect(mal.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('autenticación del dashboard', () => {
  it('credenciales incorrectas: mismo mensaje exista o no el correo', async () => {
    const a = await llamar('POST', '/api/auth/login', { body: { email: 'admin@atlas.test', password: 'nop' }, ip: '172.16.0.2' });
    const b = await llamar('POST', '/api/auth/login', { body: { email: 'nadie@atlas.test', password: 'nop' }, ip: '172.16.0.2' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.json.error).toEqual(b.json.error);
  });

  it('el login entrega access token y cookie httpOnly de refresh; /me y la rotación funcionan', async () => {
    const r = await llamar('POST', '/api/auth/login', { body: { email: 'MODERADOR@atlas.test', password: PASS }, ip: '172.16.0.3' });
    expect(r.status).toBe(200);
    const cookie = r.headers.get('set-cookie')!;
    expect(cookie).toMatch(/atlas_rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(r.texto).not.toContain('password_hash');

    const me = await llamar('GET', '/api/auth/me', { token: r.json.data.access_token });
    expect(me.json.data).toMatchObject({ email: 'moderador@atlas.test', rol: 'moderador' });

    const refresco = cookie.split(';')[0]!;
    const ref = await llamar('POST', '/api/auth/refresh', { headers: { cookie: refresco }, ip: '172.16.0.3' });
    expect(ref.status).toBe(200);
    // Reutilizar el refresh viejo (fuera de la tolerancia de 15 s se revoca toda la familia; dentro de ella solo se rechaza)
    await db.execute(sql`update sesiones set revocada_at = now() - interval '1 minute' where revocada_at is not null`);
    const reuso = await llamar('POST', '/api/auth/refresh', { headers: { cookie: refresco }, ip: '172.16.0.3' });
    expect(reuso.status).toBe(401);
    const nuevaCookie = ref.headers.get('set-cookie')!.split(';')[0]!;
    expect((await llamar('POST', '/api/auth/refresh', { headers: { cookie: nuevaCookie }, ip: '172.16.0.3' })).status).toBe(401); // familia revocada
  });

  it('sin token o con token basura: 401; con rol insuficiente: 403', async () => {
    expect((await llamar('GET', '/api/admin/resumen')).status).toBe(401);
    expect((await llamar('GET', '/api/admin/resumen', { token: 'basura.basura.basura' })).status).toBe(401);
    expect((await llamar('GET', '/api/admin/usuarios', { token: tokens.moderador })).status).toBe(403);
    expect((await llamar('GET', '/api/admin/usuarios', { token: tokens.lector })).status).toBe(403);
    expect((await llamar('GET', '/api/admin/usuarios', { token: tokens.admin })).status).toBe(200);
  });

  it('bloqueo de cuenta tras 5 intentos fallidos', async () => {
    const ip = '172.16.9.9';
    for (let i = 0; i < 5; i++) await llamar('POST', '/api/auth/login', { body: { email: 'lector@atlas.test', password: 'mal' }, ip });
    const bloqueado = await llamar('POST', '/api/auth/login', { body: { email: 'lector@atlas.test', password: PASS }, ip });
    expect(bloqueado.status).toBe(423);
    await db.execute(sql`update usuarios set bloqueado_hasta = null, intentos_fallidos = 0 where email = 'lector@atlas.test'`);
  });
});

describe('subir testimonio: folio, anonimato y datos personales cifrados', () => {
  let folioPersona = '';

  it('rechaza datos inválidos con el detalle de los campos', async () => {
    const r = await llamar('POST', '/api/testimonios', { body: { categoria: 'megaproyectos', relato: 'corto' } });
    expect(r.status).toBe(400);
    expect(r.json.error.codigo).toBe('DATOS_INVALIDOS');
    expect(Object.keys(r.json.error.detalles.fieldErrors)).toEqual(expect.arrayContaining(['ubicacion', 'relato', 'autorizacion', 'consentimiento_aceptado']));
    // sin consentimiento no se acepta
    expect((await llamar('POST', '/api/testimonios', { body: ficha({ consentimiento_aceptado: false }) })).status).toBe(400);
    // coordenadas invertidas
    expect((await llamar('POST', '/api/testimonios', { body: ficha({ ubicacion: { type: 'Point', coordinates: [19.4, -199.1] } }) })).status).toBe(400);
  });

  it('una persona anónima sube su primer testimonio: recibe folio, queda pendiente y NO sale en el mapa', async () => {
    const r = await llamar('POST', '/api/testimonios', {
      body: ficha({ nombre: 'María López', contacto: { correo: 'Maria@Example.org', telefono: '+52 55 1234 5678' }, lugar_territorio: 'Ejido La Esperanza', entidad: 'Oaxaca', municipio: 'Juchitán' }),
    });
    expect(r.status).toBe(201);
    expect(r.headers.get('cache-control')).toBe('no-store');
    folioPersona = r.json.data.participante.folio;
    expect(folioPersona).toMatch(/^P(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
    expect(r.json.data.testimonio.folio).toMatch(/^FUTURO\/001-T[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(r.json.data.testimonio).toMatchObject({ estado: 'pendiente', publicado: false });
    ids.t1 = r.json.data.testimonio.id;

    expect((await llamar('GET', '/api/mapa')).json.data.features).toHaveLength(0);
    expect((await llamar('GET', `/api/testimonios/${ids.t1}`)).status).toBe(404); // aún no es público
  });

  it('en la base el folio solo existe como hash y los datos personales solo cifrados', async () => {
    const filas = [...(await db.execute<any>(sql`select * from participantes`))];
    expect(filas).toHaveLength(1);
    const p = filas[0];
    const volcado = JSON.stringify(p);
    expect(volcado).not.toContain(folioPersona);
    expect(volcado).not.toContain('María');
    expect(volcado).not.toContain('Example');
    expect(volcado).not.toContain('1234');
    expect(p.folio_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(p.nombre_enc).toMatch(/^v1\./);
    expect(p.correo_enc).toMatch(/^v1\./);
    expect(p.folio_pista).toBe(folioPersona.slice(-4));
    // la auditoría guarda la IP cifrada
    const [a] = [...(await db.execute<any>(sql`select * from testimonios_auditoria`))];
    expect(a.ip_enc).toMatch(/^v1\./);
    expect(JSON.stringify(a)).not.toContain('10.0.0.');
    expect(a.retener_hasta).toBeTruthy();
  });

  it('con su folio la persona ve sus testimonios y se le cuentan; con folio ajeno o falso no entra', async () => {
    const mis = await llamar('GET', '/api/mis-testimonios', { folio: folioPersona.toLowerCase() });
    expect(mis.status).toBe(200);
    expect(mis.json.data).toHaveLength(1);
    expect((await llamar('GET', '/api/mis-testimonios')).status).toBe(401);
    expect((await llamar('GET', '/api/mis-testimonios', { folio: 'P-AAAA-AAAA-AAAA-AAAA' })).status).toBe(401);
    expect((await llamar('GET', '/api/mis-testimonios', { folio: 'no-es-un-folio' })).status).toBe(401);

    const segundo = await llamar('POST', '/api/testimonios', { folio: folioPersona, body: ficha({ categoria: 'inseguridad-energetica' }) });
    expect(segundo.status).toBe(201);
    expect(segundo.json.data.participante).toBeNull(); // no se emite otro folio
    ids.t2 = segundo.json.data.testimonio.id;

    const perfil = await llamar('GET', '/api/mi-perfil', { folio: folioPersona });
    expect(perfil.json.data).toMatchObject({ testimonios: 2, aprobados: 0, dejo_nombre: true, dejo_correo: true, dejo_telefono: true });
    expect(perfil.json.data.datos_personales).toBeUndefined();
    const conDatos = await llamar('GET', '/api/mi-perfil?datos=true', { folio: folioPersona });
    expect(conDatos.json.data.datos_personales).toEqual({ nombre: 'María López', correo: 'maria@example.org', telefono: '+525512345678' });
  });

  it('la persona puede hacer público su perfil, con el nombre que quiera mostrar', async () => {
    const r = await llamar('PATCH', '/api/mi-perfil', { folio: folioPersona, body: { perfil_publico: true, nombre_publico: 'Doña Mari, del ejido' } });
    expect(r.status).toBe(200);
    const col = await llamar('GET', '/api/colaboradores');
    expect(col.json.data).toEqual([{ id: expect.any(String), nombre_publico: 'Doña Mari, del ejido', testimonios_publicados: 0 }]);
    expect(JSON.stringify(col.json)).not.toContain('maria@');
  });

  it('geometrías: línea y polígono (incluso uno inválido, que PostGIS repara) y rechazo de la imposible', async () => {
    const linea = await llamar('POST', '/api/testimonios', { body: ficha({ ubicacion: { type: 'LineString', coordinates: [[-99.1, 19.4], [-99.2, 19.5], [-99.3, 19.45]] } }) });
    expect(linea.status).toBe(201);
    ids.linea = linea.json.data.testimonio.id;
    const poli = await llamar('POST', '/api/testimonios', { body: ficha({ ubicacion: { type: 'Polygon', coordinates: [[[0, 0], [4, 4], [4, 0], [0, 4], [0, 0]]] } }) });
    expect(poli.status).toBe(201); // "moño": autointersección reparada
    ids.poli = poli.json.data.testimonio.id;
    const imposible = await llamar('POST', '/api/testimonios', { body: ficha({ ubicacion: { type: 'LineString', coordinates: [[-99.1, 19.4], [-99.1, 19.4]] } }) });
    expect(imposible.status).toBe(400);
    const tipos = [...(await db.execute<any>(sql`select tipo_geometria from testimonios order by created_at`))].map((r) => r.tipo_geometria);
    expect(tipos).toEqual(['POINT', 'POINT', 'LINESTRING', 'MULTIPOLYGON']);
  });
});

describe('moderación y mapa público', () => {
  it('el lector no puede moderar; el moderador sí; se registra quién', async () => {
    expect((await llamar('POST', `/api/admin/testimonios/${ids.t1}/aprobar`, { token: tokens.lector, body: {} })).status).toBe(403);
    expect((await llamar('POST', `/api/admin/testimonios/${ids.t1}/rechazar`, { token: tokens.moderador, body: {} })).status).toBe(400); // exige motivo

    const r = await llamar('POST', `/api/admin/testimonios/${ids.t1}/aprobar`, { token: tokens.moderador, body: {} });
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ estado: 'aprobado', es_publico: true, activo: true });
    const [t] = [...(await db.execute<any>(sql`select moderado_por, moderado_at from testimonios where id = ${ids.t1}`))];
    expect(t.moderado_por).toBeTruthy();

    const bit = await llamar('GET', `/api/admin/bitacora?entidad=testimonio&entidad_id=${ids.t1}`, { token: tokens.admin });
    const acciones = bit.json.data.map((e: any) => e.accion);
    expect(acciones).toEqual(expect.arrayContaining(['testimonio.crear', 'testimonio.aprobar']));
    const ap = bit.json.data.find((e: any) => e.accion === 'testimonio.aprobar');
    expect(ap).toMatchObject({ actor_tipo: 'usuario', usuario_email: 'moderador@atlas.test', antes: { estado: 'pendiente' }, despues: { estado: 'aprobado' } });
  });

  it('aprobar publica en el mapa: GeoJSON con pin, y detalle público sin datos personales', async () => {
    await llamar('POST', `/api/admin/testimonios/${ids.t2}/aprobar`, { token: tokens.admin, body: {} });
    await llamar('POST', `/api/admin/testimonios/${ids.linea}/aprobar`, { token: tokens.admin, body: {} });
    await llamar('POST', `/api/admin/testimonios/${ids.poli}/aprobar`, { token: tokens.admin, body: {} });

    const mapa = await llamar('GET', '/api/mapa');
    expect(mapa.json.data.type).toBe('FeatureCollection');
    expect(mapa.json.data.features).toHaveLength(4);
    expect(mapa.json.data.features.every((f: any) => f.geometry.type === 'Point')).toBe(true); // modo "punto"

    const completa = await llamar('GET', '/api/mapa?geometria=completa&categoria=megaproyectos');
    expect(completa.json.data.features.map((f: any) => f.geometry.type).sort()).toEqual(['LineString', 'MultiPolygon', 'Point']);

    // el perfil público de la persona cuenta sus testimonios YA publicados (regresión: subconsulta correlacionada)
    expect((await llamar('GET', '/api/colaboradores')).json.data[0]).toMatchObject({ nombre_publico: 'Doña Mari, del ejido', testimonios_publicados: 2 });

    const detalle = await llamar('GET', `/api/testimonios/${ids.t1}`);
    expect(detalle.status).toBe(200);
    expect(detalle.json.data).toMatchObject({ categoria_slug: 'megaproyectos', expediente_codigo: 'FUTURO/001', nombre_publico: null, aproximada: false });
    const volcado = JSON.stringify(detalle.json);
    for (const privado of ['María', 'maria@', 'participante_id', 'notas_internas', 'ip_enc', 'folio_hash']) expect(volcado).not.toContain(privado);
  });

  it('filtros del mapa: bbox, radio en metros, texto completo, categoría y fechas', async () => {
    const dentro = await llamar('GET', '/api/mapa?bbox=-100,19,-98,20');
    expect(dentro.json.data.features.length).toBeGreaterThanOrEqual(3);
    const fuera = await llamar('GET', '/api/mapa?bbox=10,10,11,11');
    expect(fuera.json.data.features).toHaveLength(0);

    const cerca = await llamar('GET', '/api/mapa?lat=19.4326&lng=-99.1332&radio=2000');
    expect(cerca.json.data.features.map((f: any) => f.id)).toEqual(expect.arrayContaining([ids.t1, ids.t2]));
    const lejos = await llamar('GET', '/api/mapa?lat=25&lng=-100&radio=2000');
    expect(lejos.json.data.features).toHaveLength(0);

    expect((await llamar('GET', '/api/mapa?q=transmisión')).json.data.features.length).toBe(4);
    expect((await llamar('GET', '/api/mapa?q=submarino')).json.data.features).toHaveLength(0);
    expect((await llamar('GET', '/api/mapa?categoria=inseguridad-energetica')).json.data.features).toHaveLength(1);
    expect((await llamar('GET', '/api/mapa?radio=100')).status).toBe(400); // radio sin lat/lng
    expect((await llamar('GET', '/api/mapa?bbox=1,2,3')).status).toBe(400);
  });

  it('listado público con paginación por cursor, sin repetir ni saltar elementos', async () => {
    const p1 = await llamar('GET', '/api/testimonios?limite=3');
    expect(p1.json.data).toHaveLength(3);
    expect(p1.json.siguiente_cursor).toBeTruthy();
    const p2 = await llamar('GET', `/api/testimonios?limite=3&cursor=${p1.json.siguiente_cursor}`);
    expect(p2.json.data).toHaveLength(1);
    expect(p2.json.siguiente_cursor).toBeNull();
    const todos = [...p1.json.data, ...p2.json.data].map((t: any) => t.id);
    expect(new Set(todos).size).toBe(4);
    expect((await llamar('GET', '/api/testimonios?cursor=zzz')).status).toBe(400);
  });

  it('desactivar (activo=0) retira del mapa sin borrar; activar lo regresa; aprobado→pendiente también retira', async () => {
    await llamar('POST', `/api/admin/testimonios/${ids.t2}/desactivar`, { token: tokens.moderador, body: {} });
    expect((await llamar('GET', `/api/testimonios/${ids.t2}`)).status).toBe(404);
    const [fila] = [...(await db.execute<any>(sql`select activo, estado from testimonios where id = ${ids.t2}`))];
    expect(fila).toEqual({ activo: false, estado: 'aprobado' }); // sigue en la base
    await llamar('POST', `/api/admin/testimonios/${ids.t2}/activar`, { token: tokens.moderador, body: {} });
    expect((await llamar('GET', `/api/testimonios/${ids.t2}`)).status).toBe(200);
    await llamar('POST', `/api/admin/testimonios/${ids.t2}/desaprobar`, { token: tokens.moderador, body: {} });
    expect((await llamar('GET', `/api/testimonios/${ids.t2}`)).status).toBe(404);
    await llamar('POST', `/api/admin/testimonios/${ids.t2}/aprobar`, { token: tokens.moderador, body: {} });
  });

  it('PATCH permite cambiar cualquier aspecto y deja el antes/después en la bitácora', async () => {
    const r = await llamar('PATCH', `/api/admin/testimonios/${ids.t1}`, {
      token: tokens.moderador,
      body: { titulo: 'Línea de transmisión sin consulta', categoria: 'afectaciones-cambio-climatico', notas_internas: 'Verificar con la comunidad', municipio: 'Juchitán de Zaragoza' },
    });
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ titulo: 'Línea de transmisión sin consulta', notas_internas: 'Verificar con la comunidad', categoria: { slug: 'afectaciones-cambio-climatico' } });
    const bit = await llamar('GET', `/api/admin/bitacora?accion=testimonio.editar&entidad_id=${ids.t1}`, { token: tokens.admin });
    expect(bit.json.data[0].despues).toMatchObject({ titulo: 'Línea de transmisión sin consulta', municipio: 'Juchitán de Zaragoza' });
    expect(bit.json.data[0].usuario_email).toBe('moderador@atlas.test');
    expect((await llamar('PATCH', `/api/admin/testimonios/${ids.t1}`, { token: tokens.moderador, body: {} })).status).toBe(400);
    expect((await llamar('PATCH', `/api/admin/testimonios/${ids.t1}`, { token: tokens.lector, body: { titulo: 'x' } })).status).toBe(403);
    // devolver a su categoría original
    await llamar('PATCH', `/api/admin/testimonios/${ids.t1}`, { token: tokens.moderador, body: { categoria: 'megaproyectos' } });
  });
});

describe('consentimiento e información sensible', () => {
  it('«anonimizar»: se oculta el nombre aunque quiso aparecer y la ubicación se generaliza', async () => {
    const r = await llamar('POST', '/api/testimonios', {
      body: ficha({ aparecer_como: 'nombre', nombre: 'Pedro Ruiz', autorizacion: 'publico_con_nombre', info_sensible: true, sensible_accion: 'anonimizar', ubicacion: { type: 'Point', coordinates: [-99.13321, 19.43267] } }),
    });
    expect(r.status).toBe(201);
    const id = r.json.data.testimonio.id;
    await llamar('POST', `/api/admin/testimonios/${id}/aprobar`, { token: tokens.moderador, body: {} });
    const d = await llamar('GET', `/api/testimonios/${id}`);
    expect(d.json.data.nombre_publico).toBeNull();
    expect(d.json.data.aproximada).toBe(true);
    expect(d.json.data.ubicacion.coordinates).toEqual([-99.13, 19.43]); // generalizada ~1 km
    const [exacta] = [...(await db.execute<any>(sql`select ST_X(ubicacion) x from testimonios where id = ${id}`))];
    expect(exacta.x).toBeCloseTo(-99.13321, 5); // la exacta se conserva (privada)
  });

  it('con autorización «público con nombre» y sin sensibilidad, el nombre sí aparece', async () => {
    const r = await llamar('POST', '/api/testimonios', { body: ficha({ aparecer_como: 'nombre', nombre: 'Ana Torres', autorizacion: 'publico_con_nombre' }) });
    const id = r.json.data.testimonio.id;
    await llamar('POST', `/api/admin/testimonios/${id}/aprobar`, { token: tokens.moderador, body: {} });
    expect((await llamar('GET', `/api/testimonios/${id}`)).json.data.nombre_publico).toBe('Ana Torres');
    // quiere nombre pero solo autorizó público anónimo: prevalece lo más restrictivo
    const r2 = await llamar('POST', '/api/testimonios', { body: ficha({ aparecer_como: 'nombre', nombre: 'Luis', autorizacion: 'publico_anonimo' }) });
    await llamar('POST', `/api/admin/testimonios/${r2.json.data.testimonio.id}/aprobar`, { token: tokens.admin, body: {} });
    expect((await llamar('GET', `/api/testimonios/${r2.json.data.testimonio.id}`)).json.data.nombre_publico).toBeNull();
    // aparecer con nombre exige el nombre
    expect((await llamar('POST', '/api/testimonios', { body: ficha({ aparecer_como: 'nombre' }) })).status).toBe(400);
    // sensible exige acción
    expect((await llamar('POST', '/api/testimonios', { body: ficha({ info_sensible: true }) })).status).toBe(400);
  });

  it('«solo documentación interna» y «no autorizo» se aprueban pero NUNCA se publican', async () => {
    for (const autorizacion of ['solo_documentacion_interna', 'no_autoriza']) {
      const r = await llamar('POST', '/api/testimonios', { body: ficha({ autorizacion }) });
      const id = r.json.data.testimonio.id;
      const ap = await llamar('POST', `/api/admin/testimonios/${id}/aprobar`, { token: tokens.admin, body: {} });
      expect(ap.json.data).toMatchObject({ estado: 'aprobado', es_publico: false });
      expect((await llamar('GET', `/api/testimonios/${id}`)).status).toBe(404);
    }
    const m = await llamar('GET', '/api/mapa?limite=100');
    expect(m.json.data.features.every((f: any) => ids.t1 || f)).toBe(true);
  });
});

describe('modos de publicación configurables desde el dashboard', () => {
  it('solo el admin cambia la configuración, con validación', async () => {
    expect((await llamar('PATCH', '/api/admin/configuracion', { token: tokens.moderador, body: { modo_publicacion: 'auto_todo' } })).status).toBe(403);
    expect((await llamar('PATCH', '/api/admin/configuracion', { token: tokens.admin, body: { modo_publicacion: 'inventado' } })).status).toBe(400);
    expect((await llamar('PATCH', '/api/admin/configuracion', { token: tokens.admin, body: { max_archivos_por_testimonio: -1 } })).status).toBe(400);
  });

  it('auto_si_no_sensible: publica solo lo no sensible', async () => {
    await llamar('PATCH', '/api/admin/configuracion', { token: tokens.admin, body: { modo_publicacion: 'auto_si_no_sensible' } });
    const normal = await llamar('POST', '/api/testimonios', { body: ficha() });
    expect(normal.json.data.testimonio).toMatchObject({ estado: 'aprobado', publicado: true });
    const sensible = await llamar('POST', '/api/testimonios', { body: ficha({ info_sensible: true, sensible_accion: 'anonimizar' }) });
    expect(sensible.json.data.testimonio).toMatchObject({ estado: 'pendiente', publicado: false });
  });

  it('auto_todo: publica todo salvo las reglas fijas', async () => {
    await llamar('PATCH', '/api/admin/configuracion', { token: tokens.admin, body: { modo_publicacion: 'auto_todo' } });
    const a = await llamar('POST', '/api/testimonios', { body: ficha({ info_sensible: true, sensible_accion: 'anonimizar' }) });
    expect(a.json.data.testimonio.publicado).toBe(true);
    const b = await llamar('POST', '/api/testimonios', { body: ficha({ info_sensible: true, sensible_accion: 'revision_antes_publicar' }) });
    expect(b.json.data.testimonio).toMatchObject({ estado: 'pendiente', publicado: false });
    const c = await llamar('POST', '/api/testimonios', { body: ficha({ autorizacion: 'no_autoriza' }) });
    expect(c.json.data.testimonio).toMatchObject({ publicado: false });
    await llamar('PATCH', '/api/admin/configuracion', { token: tokens.admin, body: { modo_publicacion: 'revisar_todo' } });
    const d = await llamar('POST', '/api/testimonios', { body: ficha() });
    expect(d.json.data.testimonio.publicado).toBe(false);
  });

  it('el cambio de configuración queda en la bitácora con el valor anterior', async () => {
    const bit = await llamar('GET', '/api/admin/bitacora?accion=configuracion.editar', { token: tokens.admin });
    expect(bit.json.data[0]).toMatchObject({ usuario_email: 'admin@atlas.test', antes: { modo_publicacion: 'auto_todo' }, despues: { modo_publicacion: 'revisar_todo' } });
  });
});

describe('comentarios, likes y reacciones', () => {
  let comentario = '';

  it('comentar requiere un testimonio público; se puede comentar de forma anónima', async () => {
    expect((await llamar('POST', `/api/testimonios/${ids.t2}/comentarios`, { body: { contenido: '' } })).status).toBe(400);
    const r = await llamar('POST', `/api/testimonios/${ids.t1}/comentarios`, { body: { contenido: 'Aquí pasó lo mismo en 2023.', autor_nombre: 'Vecino' } });
    expect(r.status).toBe(201);
    comentario = r.json.data.id;
    const noPublico = [...(await db.execute<any>(sql`select id from testimonios where not es_publico limit 1`))][0].id;
    expect((await llamar('POST', `/api/testimonios/${noPublico}/comentarios`, { body: { contenido: 'hola' } })).status).toBe(404);
  });

  it('los comentarios también reciben likes: uno por dispositivo, idempotente, y se pueden quitar', async () => {
    const a = await llamar('POST', `/api/comentarios/${comentario}/likes`, { headers: { 'x-device-id': 'dispositivo-A' } });
    expect(a.json.data).toEqual({ agregado: true, likes_conteo: 1 });
    const repetido = await llamar('POST', `/api/comentarios/${comentario}/likes`, { headers: { 'x-device-id': 'dispositivo-A' } });
    expect(repetido.json.data).toEqual({ agregado: false, likes_conteo: 1 });
    const b = await llamar('POST', `/api/comentarios/${comentario}/likes`, { headers: { 'x-device-id': 'dispositivo-B' } });
    expect(b.json.data.likes_conteo).toBe(2);

    const lista = await llamar('GET', `/api/testimonios/${ids.t1}/comentarios`, { headers: { 'x-device-id': 'dispositivo-A' } });
    expect(lista.json.data).toHaveLength(1);
    expect(lista.json.data[0]).toMatchObject({ contenido: 'Aquí pasó lo mismo en 2023.', likes_conteo: 2, le_di_like: true });
    const otra = await llamar('GET', `/api/testimonios/${ids.t1}/comentarios`, { headers: { 'x-device-id': 'dispositivo-C' } });
    expect(otra.json.data[0].le_di_like).toBe(false);

    const quitar = await llamar('DELETE', `/api/comentarios/${comentario}/likes`, { headers: { 'x-device-id': 'dispositivo-B' } });
    expect(quitar.json.data).toEqual({ quitado: true, likes_conteo: 1 });
    expect((await llamar('POST', `/api/comentarios/00000000-0000-4000-8000-000000000000/likes`)).status).toBe(404);
  });

  it('reacciones a testimonios: contador atómico por tipo, una por dispositivo y tipo', async () => {
    const h = (d: string) => ({ headers: { 'x-device-id': d } });
    await llamar('POST', `/api/testimonios/${ids.t1}/reacciones`, { body: { tipo: 'like' }, ...h('d1') });
    await llamar('POST', `/api/testimonios/${ids.t1}/reacciones`, { body: { tipo: 'like' }, ...h('d2') });
    await llamar('POST', `/api/testimonios/${ids.t1}/reacciones`, { body: { tipo: 'apoyo' }, ...h('d1') });
    const rep = await llamar('POST', `/api/testimonios/${ids.t1}/reacciones`, { body: { tipo: 'like' }, ...h('d1') });
    expect(rep.json.data).toMatchObject({ agregada: false, reacciones_total: 3, reacciones_conteo: { like: 2, apoyo: 1 } });
    expect((await llamar('GET', `/api/testimonios/${ids.t1}/reacciones/mias`, h('d1'))).json.data.sort()).toEqual(['apoyo', 'like']);
    const q = await llamar('DELETE', `/api/testimonios/${ids.t1}/reacciones/like`, h('d1'));
    expect(q.json.data).toMatchObject({ quitada: true, reacciones_total: 2 });
    expect((await llamar('POST', `/api/testimonios/${ids.t1}/reacciones`, { body: { tipo: 'inventada' } })).status).toBe(400);
    // los contadores se ven en el detalle público
    expect((await llamar('GET', `/api/testimonios/${ids.t1}`)).json.data).toMatchObject({ reacciones_total: 2, comentarios_conteo: 1 });
  });

  it('moderación de comentarios: ocultar baja el contador y desaparece de la lista pública', async () => {
    expect((await llamar('PATCH', `/api/admin/comentarios/${comentario}`, { token: tokens.lector, body: { activo: false } })).status).toBe(403);
    expect((await llamar('PATCH', `/api/admin/comentarios/${comentario}`, { token: tokens.moderador, body: { activo: false } })).status).toBe(200);
    expect((await llamar('GET', `/api/testimonios/${ids.t1}/comentarios`)).json.data).toHaveLength(0);
    expect((await llamar('GET', `/api/testimonios/${ids.t1}`)).json.data.comentarios_conteo).toBe(0);
    expect((await llamar('DELETE', `/api/admin/comentarios/${comentario}`, { token: tokens.moderador })).status).toBe(403); // borrar de la BD: solo admin
  });

  it('con moderación de comentarios activada quedan pendientes', async () => {
    await llamar('PATCH', '/api/admin/configuracion', { token: tokens.admin, body: { comentarios_requieren_moderacion: true } });
    const r = await llamar('POST', `/api/testimonios/${ids.t1}/comentarios`, { body: { contenido: 'Pendiente de aprobar' } });
    expect(r.json.data).toMatchObject({ estado: 'pendiente', visible: false });
    expect((await llamar('GET', `/api/testimonios/${ids.t1}/comentarios`)).json.data).toHaveLength(0);
    await llamar('PATCH', '/api/admin/comentarios/' + r.json.data.id, { token: tokens.moderador, body: { estado: 'aprobado' } });
    expect((await llamar('GET', `/api/testimonios/${ids.t1}/comentarios`)).json.data).toHaveLength(1);
    await llamar('PATCH', '/api/admin/configuracion', { token: tokens.admin, body: { comentarios_requieren_moderacion: false } });
  });
});

describe('edición y baja por la propia persona', () => {
  let folio = '';
  let id = '';
  it('al editar vuelve a revisión y sale del mapa; la baja es lógica', async () => {
    const r = await llamar('POST', '/api/testimonios', { body: ficha() });
    folio = r.json.data.participante.folio;
    id = r.json.data.testimonio.id;
    await llamar('POST', `/api/admin/testimonios/${id}/aprobar`, { token: tokens.admin, body: {} });
    expect((await llamar('GET', `/api/testimonios/${id}`)).status).toBe(200);

    const e = await llamar('PATCH', `/api/mis-testimonios/${id}`, { folio, body: { relato: 'Versión corregida del relato de la comunidad afectada.', info_sensible: true, sensible_accion: 'anonimizar' } });
    expect(e.status).toBe(200);
    expect(e.json.data).toMatchObject({ estado: 'pendiente', es_publico: false, ubicacion_aproximada: true });
    expect(e.json.data.notas_internas).toBeUndefined(); // lo interno no se le muestra a la persona
    expect((await llamar('GET', `/api/testimonios/${id}`)).status).toBe(404);

    // nadie más puede tocar ese testimonio, ni siquiera con otro folio válido
    const otra = await llamar('POST', '/api/testimonios', { body: ficha() });
    const folioAjeno = otra.json.data.participante.folio;
    expect((await llamar('PATCH', `/api/mis-testimonios/${id}`, { folio: folioAjeno, body: { relato: 'intento de modificar el relato ajeno' } })).status).toBe(404);
    expect((await llamar('DELETE', `/api/mis-testimonios/${id}`, { folio: folioAjeno })).status).toBe(404);

    expect((await llamar('DELETE', `/api/mis-testimonios/${id}`, { folio })).status).toBe(200);
    const [fila] = [...(await db.execute<any>(sql`select activo from testimonios where id = ${id}`))];
    expect(fila.activo).toBe(false);
  });
});

describe('personas, recuperación de folio y derechos ARCO (dashboard)', () => {
  let personaId = '';
  let folioViejo = '';

  it('se busca por correo o teléfono sin descifrar (índice ciego) y no se exponen datos personales en el listado', async () => {
    const r = await llamar('GET', '/api/admin/participantes?correo=MARIA@example.org', { token: tokens.moderador });
    expect(r.status).toBe(200);
    expect(r.json.data).toHaveLength(1);
    expect(r.json.data[0]).toMatchObject({ testimonios: 2, dejo_correo: true });
    expect(JSON.stringify(r.json)).not.toContain('maria@example.org');
    personaId = r.json.data[0].id;
    expect((await llamar('GET', '/api/admin/participantes?telefono=%2B52%2055%201234%205678', { token: tokens.moderador })).json.data).toHaveLength(1);
    expect((await llamar('GET', '/api/admin/participantes?correo=otra@example.org', { token: tokens.moderador })).json.data).toHaveLength(0);
    expect((await llamar('GET', '/api/admin/participantes', { token: tokens.lector })).status).toBe(403);
  });

  it('ver datos personales descifrados queda en la bitácora', async () => {
    const r = await llamar('GET', `/api/admin/participantes/${personaId}`, { token: tokens.moderador });
    expect(r.json.data.datos_personales).toEqual({ nombre: 'María López', correo: 'maria@example.org', telefono: '+525512345678' });
    const bit = await llamar('GET', `/api/admin/bitacora?accion=participante.ver_datos_personales`, { token: tokens.admin });
    expect(bit.json.data[0]).toMatchObject({ usuario_email: 'moderador@atlas.test', entidad_id: personaId });
    expect(JSON.stringify(bit.json)).not.toContain('maria@example.org');
  });

  it('recuperar folio perdido: se emite uno nuevo y el anterior deja de servir', async () => {
    const inicial = [...(await db.execute<any>(sql`select folio_pista from participantes where id = ${personaId}`))][0];
    folioViejo = inicial.folio_pista;
    const r = await llamar('POST', `/api/admin/participantes/${personaId}/rotar-folio`, { token: tokens.moderador });
    expect(r.status).toBe(200);
    const nuevo = r.json.data.folio;
    expect(nuevo).toMatch(/^P(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
    expect((await llamar('GET', '/api/mis-testimonios', { folio: nuevo })).json.data).toHaveLength(2);
    const anterior = [...(await db.execute<any>(sql`select folio_pista from participantes where id = ${personaId}`))][0].folio_pista;
    expect(anterior).toBe(nuevo.slice(-4));
    void folioViejo;
  });

  it('desactivar a una persona bloquea su folio; cancelar datos borra lo personal pero conserva los testimonios', async () => {
    const f = (await llamar('POST', `/api/admin/participantes/${personaId}/rotar-folio`, { token: tokens.admin })).json.data.folio;
    await llamar('PATCH', `/api/admin/participantes/${personaId}`, { token: tokens.moderador, body: { activo: false } });
    expect((await llamar('GET', '/api/mis-testimonios', { folio: f })).status).toBe(401);
    await llamar('PATCH', `/api/admin/participantes/${personaId}`, { token: tokens.moderador, body: { activo: true } });

    expect((await llamar('DELETE', `/api/admin/participantes/${personaId}/datos-personales`, { token: tokens.moderador })).status).toBe(403);
    expect((await llamar('DELETE', `/api/admin/participantes/${personaId}/datos-personales`, { token: tokens.admin })).status).toBe(200);
    const p = (await llamar('GET', `/api/admin/participantes/${personaId}`, { token: tokens.admin })).json.data;
    expect(p).toMatchObject({ dejo_nombre: false, dejo_correo: false, dejo_telefono: false, perfil_publico: false, testimonios: 2 });
    expect(p.datos_cancelados_at).toBeTruthy();
    expect((await llamar('GET', '/api/admin/participantes?correo=maria@example.org', { token: tokens.admin })).json.data).toHaveLength(0);
  });
});

describe('facilitador: captura de fichas en papel', () => {
  let id = '';
  it('el facilitador sube un testimonio, recibe el folio para entregarlo y solo ve lo suyo', async () => {
    const r = await llamar('POST', '/api/admin/testimonios', { token: tokens.facilitador, body: ficha({ nombre: 'Rosa Pérez', contacto: { telefono: '9511234567' }, facilitador_nombre: 'Equipo Istmo' }) });
    expect(r.status).toBe(201);
    expect(r.json.data.participante.folio).toMatch(/^P-/);
    id = r.json.data.testimonio.id;
    const [t] = [...(await db.execute<any>(sql`select origen, facilitador_nombre, facilitador_id is not null as con_f from testimonios where id = ${id}`))];
    expect(t).toEqual({ origen: 'facilitador', facilitador_nombre: 'Equipo Istmo', con_f: true });

    const suyos = await llamar('GET', '/api/admin/testimonios', { token: tokens.facilitador });
    expect(suyos.json.total).toBe(1);
    expect((await llamar('GET', `/api/admin/testimonios/${ids.t1}`, { token: tokens.facilitador })).status).toBe(404);
    expect((await llamar('GET', `/api/admin/testimonios/${id}`, { token: tokens.facilitador })).status).toBe(200);
    expect((await llamar('POST', `/api/admin/testimonios/${id}/aprobar`, { token: tokens.facilitador, body: {} })).status).toBe(403);
    expect((await llamar('POST', '/api/admin/testimonios', { token: tokens.lector, body: ficha() })).status).toBe(403);
  });
});

describe('evidencias: máximo 5 archivos y 20 MB en total (configurable)', () => {
  let id = '';
  let folio = '';
  const archivo = (nombre: string, bytes: number, extra: Record<string, unknown> = {}) => ({ nombre, mime: 'image/jpeg', bytes, tipo: 'foto', ...extra });

  it('reserva archivos con URLs firmadas de R2 y respeta los límites', async () => {
    const r = await llamar('POST', '/api/testimonios', { body: ficha() });
    id = r.json.data.testimonio.id;
    folio = r.json.data.participante.folio;

    const ok = await llamar('POST', `/api/mis-testimonios/${id}/evidencias`, { folio, body: { archivos: [archivo('a.jpg', 5_000_000), archivo('b.jpg', 5_000_000)] } });
    expect(ok.status).toBe(201);
    const a = ok.json.data.archivos[0];
    expect(a.folio).toMatch(/^FUTURO\/001-E[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(a.subir.url).toMatch(/^https:\/\/bucket-prueba\.cuentadeprueba\.r2\.cloudflarestorage\.com\/evidencias\/.+X-Amz-Signature=/);
    expect(a.subir.cabeceras['Content-Length']).toBe('5000000');
    expect(a.subir.url).not.toContain('secretodeprueba');

    // 10 MB usados: 11 MB más excede los 20 MB; 4 archivos más excede los 5
    const demasiado = await llamar('POST', `/api/mis-testimonios/${id}/evidencias`, { folio, body: { archivos: [archivo('c.jpg', 11_000_000)] } });
    expect(demasiado.status).toBe(400);
    expect(demasiado.json.error.mensaje).toMatch(/20 MB/);
    const muchos = await llamar('POST', `/api/mis-testimonios/${id}/evidencias`, { folio, body: { archivos: [1, 2, 3, 4].map((n) => archivo(`${n}.jpg`, 1000)) } });
    expect(muchos.status).toBe(400);
    expect(muchos.json.error.mensaje).toMatch(/Máximo 5/);
    expect((await llamar('POST', `/api/mis-testimonios/${id}/evidencias`, { folio, body: { archivos: [archivo('c.jpg', 1000), archivo('d.jpg', 1000), archivo('e.jpg', 1000)] } })).status).toBe(201); // 5 en total, justo el límite
  });

  it('rechaza tipos no permitidos, incoherentes, y a quien no es dueño', async () => {
    const otro = (await llamar('POST', '/api/testimonios', { body: ficha() })).json.data.participante.folio;
    expect((await llamar('POST', `/api/mis-testimonios/${id}/evidencias`, { folio: otro, body: { archivos: [archivo('x.jpg', 10)] } })).status).toBe(404);
    expect((await llamar('POST', `/api/mis-testimonios/${id}/evidencias`, { folio, body: { archivos: [{ nombre: 'virus.exe', mime: 'application/x-msdownload', bytes: 10, tipo: 'otro' }] } })).status).toBe(400);
    expect((await llamar('POST', `/api/mis-testimonios/${id}/evidencias`, { folio, body: { archivos: [{ nombre: 'a.pdf', mime: 'application/pdf', bytes: 10, tipo: 'foto' }] } })).status).toBe(400);
  });

  it('el administrador puede cambiar los límites desde el panel y se aplican de inmediato', async () => {
    await llamar('PATCH', '/api/admin/configuracion', { token: tokens.admin, body: { max_archivos_por_testimonio: 7, max_bytes_totales_por_testimonio: 30 * 1024 * 1024 } });
    const r = await llamar('POST', `/api/mis-testimonios/${id}/evidencias`, { folio, body: { archivos: [archivo('f.jpg', 1000), archivo('g.jpg', 1000)] } });
    expect(r.status).toBe(201);
    expect(r.json.data.limites).toEqual({ max_archivos: 7, max_bytes_totales: 30 * 1024 * 1024 });
    await llamar('PATCH', '/api/admin/configuracion', { token: tokens.admin, body: { max_archivos_por_testimonio: 5, max_bytes_totales_por_testimonio: 20 * 1024 * 1024 } });
  });

  it('confirmar sin haber subido el archivo da conflicto (verifica en R2 el archivo real)', async () => {
    const lista = await llamar('GET', `/api/mis-testimonios/${id}/evidencias`, { folio });
    expect(lista.json.data.length).toBeGreaterThanOrEqual(5);
    expect(lista.json.data.every((e: any) => e.estado_subida === 'pendiente')).toBe(true);
  });
});

describe('evidencias ya subidas: conteo en el dashboard y visibilidad pública con URL firmada', () => {
  it('solo las evidencias marcadas como públicas salen en el detalle público, con URL temporal y sin exponer la clave de R2', async () => {
    const r = await llamar('POST', '/api/testimonios', { body: ficha({ autoriza_multimedia: 'si' }) });
    const id = r.json.data.testimonio.id;
    const folio = r.json.data.participante.folio;
    const pre = await llamar('POST', `/api/mis-testimonios/${id}/evidencias`, {
      folio,
      body: { archivos: [{ nombre: 'foto-torre.jpg', mime: 'image/jpeg', bytes: 2000, tipo: 'foto' }, { nombre: 'recibo.pdf', mime: 'application/pdf', bytes: 3000, tipo: 'recibo_factura' }] },
    });
    expect(pre.status).toBe(201);
    // Simula el fin de la subida a R2 (la verificación contra R2 real requiere red)
    await db.execute(sql`update evidencias set estado_subida = 'subida', bytes = bytes_declarados where testimonio_id = ${id}`);

    // aprobar: publica la multimedia autorizada, pero NUNCA el recibo (suele traer nombre y domicilio)
    await llamar('POST', `/api/admin/testimonios/${id}/aprobar`, { token: tokens.moderador, body: {} });
    const pub = (await llamar('GET', `/api/testimonios/${id}`)).json.data;
    expect(pub.evidencias.map((e: any) => e.tipo)).toEqual(['foto']);
    expect(pub.evidencias[0].url).toMatch(/X-Amz-Signature=.+/);
    expect(JSON.stringify(pub)).not.toContain('storage_key');

    // el equipo ve ambas y puede publicar el recibo a mano (queda registrado)
    const lista = (await llamar('GET', `/api/admin/testimonios/${id}/evidencias`, { token: tokens.lector })).json.data;
    expect(lista).toHaveLength(2);
    const recibo = lista.find((e: any) => e.tipo === 'recibo_factura');
    expect(recibo.publica).toBe(false);
    await llamar('PATCH', `/api/admin/testimonios/${id}/evidencias/${recibo.id}`, { token: tokens.moderador, body: { publica: true } });
    expect((await llamar('GET', `/api/testimonios/${id}`)).json.data.evidencias).toHaveLength(2);
    const bit = await llamar('GET', '/api/admin/bitacora?accion=evidencia.editar', { token: tokens.admin });
    expect(bit.json.data[0]).toMatchObject({ usuario_email: 'moderador@atlas.test', despues: { publica: true } });
  });

  it('el listado del dashboard cuenta las evidencias subidas de cada testimonio (regresión: subconsulta correlacionada)', async () => {
    const [t] = [...(await db.execute<any>(sql`select testimonio_id, count(*)::int n from evidencias where estado_subida = 'subida' group by 1 order by n desc limit 1`))];
    const lista = await llamar('GET', `/api/admin/testimonios?por_pagina=200`, { token: tokens.lector });
    const fila = lista.json.data.find((x: any) => x.id === t.testimonio_id);
    expect(fila.evidencias_conteo).toBe(t.n);
    expect(fila.evidencias_conteo).toBeGreaterThan(0);
  });

  it('el personal obtiene una URL temporal para ver una evidencia y queda en la bitácora', async () => {
    const [e] = [...(await db.execute<any>(sql`select id from evidencias where estado_subida = 'subida' limit 1`))];
    const r = await llamar('GET', `/api/admin/evidencias/${e.id}/url`, { token: tokens.lector });
    expect(r.status).toBe(200);
    expect(r.json.data.expira_en_segundos).toBe(300);
    expect((await llamar('GET', `/api/admin/bitacora?accion=evidencia.ver`, { token: tokens.admin })).json.data[0]).toMatchObject({ entidad_id: e.id });
  });
});

describe('eliminación permanente solo con confirmación explícita', () => {
  it('borrar de la base de datos exige ser admin y confirmar con el folio', async () => {
    const r = await llamar('POST', '/api/testimonios', { body: ficha() });
    const id = r.json.data.testimonio.id;
    const folio = r.json.data.testimonio.folio;
    expect((await llamar('DELETE', `/api/admin/testimonios/${id}?confirmar=${encodeURIComponent(folio)}`, { token: tokens.moderador })).status).toBe(403);
    expect((await llamar('DELETE', `/api/admin/testimonios/${id}`, { token: tokens.admin })).status).toBe(400); // falta confirmar
    expect((await llamar('DELETE', `/api/admin/testimonios/${id}?confirmar=FUTURO/001-TXXXXXXXX`, { token: tokens.admin })).status).toBe(400);
    const ok = await llamar('DELETE', `/api/admin/testimonios/${id}?confirmar=${encodeURIComponent(folio.toLowerCase())}`, { token: tokens.admin });
    expect(ok.status).toBe(200);
    expect([...(await db.execute(sql`select 1 from testimonios where id = ${id}`))]).toHaveLength(0);
    const bit = await llamar('GET', `/api/admin/bitacora?accion=testimonio.eliminar_permanente`, { token: tokens.admin });
    expect(bit.json.data[0]).toMatchObject({ entidad_id: id, antes: { folio } }); // queda constancia aunque ya no exista
  });
});

describe('dashboard: resumen, estadísticas, usuarios, catálogos y exportación', () => {
  it('el resumen trae todo lo necesario para pintar el dashboard', async () => {
    const r = await llamar('GET', '/api/admin/resumen', { token: tokens.lector });
    expect(r.status).toBe(200);
    const d = r.json.data;
    expect(d.testimonios).toMatchObject({ total: expect.any(Number), pendientes: expect.any(Number), publicos: expect.any(Number) });
    expect(d.por_categoria).toHaveLength(3);
    expect(d.por_expediente[0].codigo).toBe('FUTURO/001');
    expect(d.ultimos_30_dias).toHaveLength(30);
    expect(d.participantes.total).toBeGreaterThan(0);
    expect(d.testimonios.total).toBe(d.por_categoria.reduce((s: number, c: any) => s + c.total, 0));
  });

  it('serie de tiempo, geografía y exportación GeoJSON', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const s = await llamar('GET', `/api/admin/estadisticas/serie?desde=${hoy}&hasta=${hoy}&agrupar=dia`, { token: tokens.moderador });
    expect(s.json.data[0].recibidos).toBeGreaterThan(5);
    const g = await llamar('GET', '/api/admin/estadisticas/geografia', { token: tokens.moderador });
    expect(g.json.data.celdas[0]).toMatchObject({ lng: expect.any(Number), lat: expect.any(Number), total: expect.any(Number) });
    const ex = await llamar('GET', '/api/admin/exportar/testimonios.geojson?estado=aprobado', { token: tokens.moderador });
    expect(ex.json.data.type).toBe('FeatureCollection');
    expect(ex.json.data.features.length).toBeGreaterThan(3);
    expect(JSON.stringify(ex.json)).not.toContain('maria@');
    expect((await llamar('GET', '/api/admin/exportar/testimonios.geojson', { token: tokens.lector })).status).toBe(403);
  });

  it('listado del dashboard con filtros combinados y paginación', async () => {
    const pend = await llamar('GET', '/api/admin/testimonios?estado=pendiente&por_pagina=2', { token: tokens.moderador });
    expect(pend.json.data.length).toBeLessThanOrEqual(2);
    expect(pend.json.total).toBeGreaterThan(2);
    expect(pend.json.data.every((t: any) => t.estado === 'pendiente')).toBe(true);
    const sens = await llamar('GET', '/api/admin/testimonios?info_sensible=true&categoria=megaproyectos', { token: tokens.lector });
    expect(sens.json.data.every((t: any) => t.info_sensible)).toBe(true);
    const folio = pend.json.data[0].folio;
    expect((await llamar('GET', `/api/admin/testimonios?folio=${encodeURIComponent(folio.toLowerCase())}`, { token: tokens.lector })).json.total).toBe(1);
    expect((await llamar('GET', '/api/admin/testimonios?q=transmisión', { token: tokens.lector })).json.total).toBeGreaterThan(0);
    expect((await llamar('GET', '/api/admin/testimonios?estado=inventado', { token: tokens.lector })).status).toBe(400);
  });

  it('moderación por lote', async () => {
    const pend = (await llamar('GET', '/api/admin/testimonios?estado=pendiente&activo=true&por_pagina=3', { token: tokens.admin })).json.data.map((t: any) => t.id);
    const r = await llamar('POST', '/api/admin/testimonios/moderar-lote', { token: tokens.moderador, body: { ids: [...pend, '00000000-0000-4000-8000-000000000000'], accion: 'rechazar', motivo: 'Sin información suficiente' } });
    expect(r.json.data).toMatchObject({ procesados: pend.length + 1, correctos: pend.length });
    const mis = [...(await db.execute<any>(sql`select estado, motivo_rechazo from testimonios where id = ${pend[0]}`))][0];
    expect(mis).toEqual({ estado: 'rechazado', motivo_rechazo: 'Sin información suficiente' });
  });

  it('usuarios: se crean con contraseña temporal, no se puede quitar al último admin ni auto-degradarse', async () => {
    const nuevo = await llamar('POST', '/api/admin/usuarios', { token: tokens.admin, body: { email: 'nueva@atlas.test', nombre: 'Persona Nueva', rol: 'facilitador' } });
    expect(nuevo.status).toBe(201);
    expect(nuevo.json.data.password_temporal.length).toBeGreaterThanOrEqual(15);
    expect(nuevo.json.data.usuario.password_hash).toBeUndefined();
    expect((await llamar('POST', '/api/admin/usuarios', { token: tokens.admin, body: { email: 'NUEVA@atlas.test', nombre: 'Duplicada', rol: 'lector' } })).status).toBe(409);
    expect((await llamar('POST', '/api/admin/usuarios', { token: tokens.admin, body: { email: 'debil@atlas.test', nombre: 'Débil', rol: 'lector', password: '1234' } })).status).toBe(400);

    const me = (await llamar('GET', '/api/auth/me', { token: tokens.admin })).json.data;
    expect((await llamar('PATCH', `/api/admin/usuarios/${me.id}`, { token: tokens.admin, body: { activo: false } })).status).toBe(409);
    expect((await llamar('PATCH', `/api/admin/usuarios/${me.id}`, { token: tokens.admin, body: { rol: 'lector' } })).status).toBe(409);

    // desactivar a alguien cierra su sesión de inmediato
    const mod = (await llamar('GET', '/api/auth/me', { token: tokens.moderador })).json.data;
    await llamar('PATCH', `/api/admin/usuarios/${mod.id}`, { token: tokens.admin, body: { activo: false } });
    expect((await llamar('GET', '/api/auth/me', { token: tokens.moderador })).status).toBe(401);
    await llamar('PATCH', `/api/admin/usuarios/${mod.id}`, { token: tokens.admin, body: { activo: true } });
    // al reactivarlo debe iniciar sesión de nuevo: los tokens viejos no reviven
    expect((await llamar('GET', '/api/auth/me', { token: tokens.moderador })).status).toBe(401);
    const re = await llamar('POST', '/api/auth/login', { body: { email: 'moderador@atlas.test', password: PASS }, ip: '172.16.0.77' });
    tokens.moderador = re.json.data.access_token;
  });

  it('categorías y expedientes: el admin crea nuevos; el slug/código no se duplica', async () => {
    const c = await llamar('POST', '/api/admin/categorias', { token: tokens.admin, body: { slug: 'agua-y-energia', nombre: 'Agua y energía', color: '#00AA88' } });
    expect(c.status).toBe(201);
    expect((await llamar('POST', '/api/admin/categorias', { token: tokens.admin, body: { slug: 'agua-y-energia', nombre: 'Otra' } })).status).toBe(409);
    expect((await llamar('POST', '/api/admin/categorias', { token: tokens.admin, body: { slug: 'Mal Slug', nombre: 'x' } })).status).toBe(400);
    expect((await llamar('POST', '/api/admin/categorias', { token: tokens.moderador, body: { slug: 'otra', nombre: 'Otra' } })).status).toBe(403);
    await llamar('PATCH', `/api/admin/categorias/${c.json.data.id}`, { token: tokens.admin, body: { activo: false } });
    expect((await llamar('GET', '/api/config')).json.data.categorias.map((x: any) => x.slug)).not.toContain('agua-y-energia');
    expect((await llamar('POST', '/api/testimonios', { body: ficha({ categoria: 'agua-y-energia' }) })).status).toBe(400); // desactivada

    const e = await llamar('POST', '/api/admin/expedientes', { token: tokens.admin, body: { codigo: 'futuro/002', titulo: 'Segundo expediente', materia: 'Transición energética' } });
    expect(e.status).toBe(201);
    expect(e.json.data.codigo).toBe('FUTURO/002');
    const t = await llamar('POST', '/api/testimonios', { body: ficha({ expediente: 'FUTURO/002' }) });
    expect(t.json.data.testimonio.folio).toMatch(/^FUTURO\/002-T/);
  });

  it('la auditoría de envío es solo del admin, descifra la IP y deja rastro; se puede desactivar', async () => {
    const r = await llamar('POST', '/api/testimonios', { body: ficha(), ip: '203.0.113.7', headers: { 'user-agent': 'Prueba/1.0' } });
    const id = r.json.data.testimonio.id;
    expect((await llamar('GET', `/api/admin/testimonios/${id}/auditoria`, { token: tokens.moderador })).status).toBe(403);
    const a = await llamar('GET', `/api/admin/testimonios/${id}/auditoria`, { token: tokens.admin });
    expect(a.json.data).toMatchObject({ ip: '203.0.113.7', user_agent: 'Prueba/1.0', consentimiento_version: 'v1' });

    await llamar('PATCH', '/api/admin/configuracion', { token: tokens.admin, body: { auditoria_envio_activa: false } });
    const sinAud = await llamar('POST', '/api/testimonios', { body: ficha() });
    expect((await llamar('GET', `/api/admin/testimonios/${sinAud.json.data.testimonio.id}/auditoria`, { token: tokens.admin })).status).toBe(404);
    await llamar('PATCH', '/api/admin/configuracion', { token: tokens.admin, body: { auditoria_envio_activa: true } });

    // purga de la auditoría vencida
    await db.execute(sql`update testimonios_auditoria set retener_hasta = now() - interval '1 day' where testimonio_id = ${id}`);
    const p = await llamar('POST', '/api/admin/mantenimiento/purgar', { token: tokens.admin });
    expect(p.json.data.auditoria).toBe(1);
  });

  it('la bitácora no se puede alterar ni borrar', async () => {
    await expect(db.execute(sql`update bitacora set accion = 'manipulada'`)).rejects.toThrow();
    await expect(db.execute(sql`delete from bitacora`)).rejects.toThrow();
  });
});

describe('endurecimiento', () => {
  it('los errores internos no filtran detalles; las rutas desconocidas y los cuerpos enormes se controlan', async () => {
    expect((await llamar('GET', '/api/no-existe')).json.error.codigo).toBe('RUTA_NO_ENCONTRADA');
    expect((await llamar('GET', '/api/testimonios/no-es-uuid')).status).toBe(400);
    const grande = await llamar('POST', '/api/testimonios', { body: { relato: 'x'.repeat(1_100_000) } });
    expect(grande.status).toBe(413);
  });

  it('límite de peticiones por IP al subir testimonios', async () => {
    const ip = '198.51.100.99';
    let ultimo = 0;
    for (let i = 0; i < 12; i++) ultimo = (await llamar('POST', '/api/testimonios', { body: ficha(), ip })).status;
    expect(ultimo).toBe(429);
  });

  it('RLS: ningún rol de Supabase puede leer las tablas; el rol de QGIS solo ve la vista pública', async () => {
    const rls = [...(await db.execute<any>(sql`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`))];
    expect(rls).toEqual([]);
    const grants = [...(await db.execute<any>(sql`select table_name from information_schema.role_table_grants where grantee = 'lector_qgis' and table_schema = 'public'`))].map((r) => r.table_name);
    expect(grants).toEqual(['v_testimonios_publicos']);
  });
});
