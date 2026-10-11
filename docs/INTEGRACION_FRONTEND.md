# Integración con el frontend

Todas las rutas y esquemas exactos están en **Swagger (`/docs`)**. Esta guía resume los flujos.
Formato: éxito `{ success: true, data, … }` · error `{ success: false, error: { codigo, mensaje, detalles? } }`.
Geometrías: GeoJSON, **`[longitud, latitud]`**.

## Variables del front (Vercel → Settings → Environment Variables)

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://rwxdsyv0c2.execute-api.us-west-2.amazonaws.com` (en local: `http://localhost:3000`) |
| `VITE_TURNSTILE_SITE_KEY` | `0x4AAAAAAFTqtoFiVa1yH9RI` (site key pública de Turnstile) |
| `VITE_SUPABASE_URL` | `https://xirskbfqycougrtfpyqm.supabase.co` (solo para escuchar el tiempo real) |
| `VITE_SUPABASE_ANON_KEY` | la `anon` key de Supabase (Project Settings → API). Es pública; **nunca** la `service_role`. |

Después de cambiarlas en Vercel hay que volver a desplegar el front.
El widget de Turnstile debe tener agregado el dominio `atlashacker.vercel.app` (Cloudflare → Turnstile → widget → Hostnames).

## Cabeceras que usa el front

| Cabecera | Cuándo |
|---|---|
| `X-Captcha-Token` | Al **subir un testimonio** y al **comentar** (token de Cloudflare Turnstile). |
| `X-Folio` | Zona «mi folio»; opcional al subir/comentar para ligarlo a la persona. |
| `X-Device-Id` | Likes/reacciones/lista de comentarios. UUID aleatorio guardado en `localStorage` (identifica el dispositivo sin datos personales). |
| `Authorization: Bearer <token>` | Dashboard. |

## 1. Pintar el mapa

```js
const cfg = await (await fetch(`${API}/api/config`)).json();   // categorías, expedientes, límites, si pide captcha
// Pines (rápido). Con la caja visible del mapa:
const b = map.getBounds();
const url = `${API}/api/mapa?bbox=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}&categoria=megaproyectos`;
const { data: geojson } = await (await fetch(url)).json();     // FeatureCollection (Point por testimonio)
// Líneas y polígonos: &geometria=simple (o completa). Cerca de mí: &lat=..&lng=..&radio=5000 (metros)
```
`properties`: `id, folio, titulo, categoria_slug, categoria_color, tipo_geometria, aproximada, reacciones_total, comentarios_conteo`.
Detalle al hacer clic: `GET /api/testimonios/{id}` (incluye evidencias autorizadas con URL firmada de 1 h).
Listado: `GET /api/testimonios?limite=30&cursor=…` (paginación por cursor: usa `siguiente_cursor`).

## 2. Tiempo real (Supabase Realtime, canal privado `mapa`)

```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);   // la anon key SÍ va en el front
await supabase.realtime.setAuth();                                  // canal privado

supabase.channel('mapa', { config: { private: true } })
  .on('broadcast', { event: 'testimonio.publicado'   }, ({ payload }) => agregarPin(payload))
  .on('broadcast', { event: 'testimonio.actualizado' }, ({ payload }) => actualizarPin(payload))
  .on('broadcast', { event: 'testimonio.retirado'    }, ({ payload }) => quitarPin(payload.id))
  .subscribe();
```
`payload` (publicado/actualizado): `{ id, folio, titulo, categoria_slug, categoria_color, tipo_geometria, centroide }`; retirado: `{ id }`.
Solo el servidor puede emitir; el cliente únicamente escucha. Si necesitas más datos del evento, consulta `GET /api/testimonios/{id}`.

## 3. Subir un testimonio (ficha)

```js
const r = await fetch(`${API}/api/testimonios`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Captcha-Token': turnstileToken,
             ...(folio && { 'X-Folio': folio }) },
  body: JSON.stringify({
    categoria: 'megaproyectos',                       // slug o UUID
    expediente: 'FUTURO/001',                         // opcional
    ubicacion: { type: 'Point', coordinates: [-99.13, 19.43] },   // o LineString / Polygon
    origen_ubicacion: 'gps',                          // gps | mapa | manual
    lugar_territorio: 'Ejido La Esperanza', entidad: 'Oaxaca', municipio: 'Juchitán',
    aparecer_como: 'anonimo',                         // 'nombre' → enviar "nombre"
    relato: '…', territorio_dice: '…', comunidad_dice: '…',            // secciones 1, 2 y 3
    tiene_evidencia: 'si', evidencia_tipos: ['foto', 'recibo_factura'],  // sección 4
    dato_fuente_anio: 'CFE 2023', fuente_pendiente_verificacion: false,   // sección 5
    pregunta_tribunal: '…',                                               // sección 6
    autorizacion: 'publico_anonimo',                  // publico_con_nombre | publico_anonimo | solo_documentacion_interna | no_autoriza
    autoriza_multimedia: 'si',                        // si | no | na
    info_sensible: false,                             // si true → sensible_accion: anonimizar | uso_interno | revision_antes_publicar
    consentimiento_aceptado: true,                    // obligatorio
    contacto: { correo: '…', telefono: '…' },         // opcional (se guarda cifrado)
    auditoria: { huella_dispositivo: '…', precision_gps_m: 12, zona_horaria: 'America/Mexico_City' }  // opcional
  })
});
const { data } = await r.json();
// data.participante.folio  → SOLO viene la primera vez. Mostrarlo, pedir que lo guarde y NO volver a pedirlo al servidor.
// data.testimonio = { id, folio: 'FUTURO/001-T…', estado: 'pendiente' | 'aprobado', publicado }
```
Si la persona ya tiene folio, envíalo en `X-Folio` y no se emitirá otro.

## 4. Subir evidencias (máx. 5 archivos / 20 MB en total; editable en el dashboard)

```js
const headers = { 'Content-Type': 'application/json', 'X-Folio': folio };
// 1) reservar
const pre = await (await fetch(`${API}/api/mis-testimonios/${id}/evidencias`, { method: 'POST', headers,
  body: JSON.stringify({ archivos: files.map(f => ({ nombre: f.name, mime: f.type, bytes: f.size, tipo: 'foto' })) }) })).json();
// 2) subir cada archivo directo a R2
for (const [i, a] of pre.data.archivos.entries()) {
  await fetch(a.subir.url, { method: 'PUT', headers: { 'Content-Type': files[i].type }, body: files[i] });
  // (el navegador pone Content-Length solo; no lo envíes a mano)
  // 3) confirmar (el servidor verifica en R2 el tamaño y tipo reales)
  await fetch(`${API}/api/mis-testimonios/${id}/evidencias/${a.evidencia_id}/confirmar`, { method: 'POST', headers });
}
```
Tipos permitidos y límites actuales: `GET /api/config` → `configuracion`. El bucket de R2 necesita CORS para `PUT` desde el origen del front (ver `instrucciones.md`).

## 5. Comentarios, likes y reacciones

- `GET /api/testimonios/{id}/comentarios` · `POST` (con captcha; `{ contenido, autor_nombre? }`).
- Likes de comentario: `POST` / `DELETE /api/comentarios/{id}/likes` → `{ likes_conteo }` (idempotente, uno por dispositivo).
- Reacciones del testimonio: `POST /api/testimonios/{id}/reacciones` `{ tipo: like|apoyo|alerta|fuego }`, `DELETE …/reacciones/{tipo}`, `GET …/reacciones/mias`.

## 6. «Mi folio»

Con `X-Folio`: `GET /api/mis-testimonios` (con estado de revisión y motivo si fue rechazado) · `PATCH`/`DELETE /api/mis-testimonios/{id}` (editar → vuelve a revisión; borrar = baja lógica) · `GET`/`PATCH /api/mi-perfil` (hacer público el perfil con un nombre a mostrar, dejar/borrar correo, teléfono, nombre).
Si pierde el folio: *«escribe a nuestro número/correo para recuperarlo»* (el equipo emite uno nuevo desde el dashboard).

## 7. Dashboard

1. `POST /api/auth/login` `{ email, password }` → `access_token` (guárdalo **en memoria**, 15 min) + cookie `httpOnly` de refresh.
2. Renueva con `POST /api/auth/refresh` (con `credentials: 'include'`) antes de que expire o al recibir 401.
3. Pantallas → endpoints: resumen `GET /api/admin/resumen` · series `GET /api/admin/estadisticas/serie` · mapa de calor `…/geografia` · cola de moderación `GET /api/admin/testimonios?estado=pendiente` · detalle/edición `GET|PATCH /api/admin/testimonios/{id}` · `POST …/{id}/aprobar|rechazar|desaprobar|activar|desactivar` · lote `POST …/moderar-lote` · personas `GET /api/admin/participantes` · comentarios `GET /api/admin/comentarios` · configuración `GET|PATCH /api/admin/configuracion` · usuarios · categorías · expedientes · bitácora.
4. Ocultar en la UI lo que el rol no puede hacer (`GET /api/auth/me` → `rol`); el servidor igual lo impide (403).
5. Con `fetch`, `credentials: 'include'` solo en `/api/auth/*` (en axios: `withCredentials: true` en esas llamadas).
6. El front (vercel.app) y la API (amazonaws.com) son dominios distintos: la cookie de refresh es de terceros (va marcada `Partitioned`). En Chrome, Edge y Firefox funciona; **Safari** puede bloquearla, y entonces la sesión dura 15 min y hay que volver a iniciar sesión. Se resuelve del todo cuando haya un dominio propio con la API en un subdominio (p. ej. `api.tudominio.org`).
