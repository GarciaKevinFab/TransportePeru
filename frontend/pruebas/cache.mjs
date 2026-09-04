// Pruebas del cache de lecturas (src/services/cache.js).
//
//   cd frontend && node pruebas/cache.mjs
//
// Va fuera de src/ a proposito: webpack solo empaqueta lo que cuelga de
// index.js, pero un fichero de pruebas dentro del arbol de la aplicacion acaba
// tarde o temprano importado por error. Y no usa `craco test` porque lo que hay
// que comprobar es que las peticiones SALEN o NO SALEN de verdad, y para eso
// hace falta un servidor HTTP y el adapter real de axios -- en jsdom con el
// adapter simulado la prueba no probaria nada.
//
// LAS DOS QUE IMPORTAN
//
//   "la peticion real lleva Authorization" caza el fallo de lanzar el viaje
//   desde el propio interceptor del cache, que corre ANTES del que pone el
//   token: todas las lecturas saldrian sin cabecera.
//
//   "tras un 401 el reintento sale de verdad" caza el otro: si el cache
//   guardara las respuestas fallidas, el `api(originalRequest)` que sigue a la
//   renovacion del token leeria el 401 de memoria y la sesion no se
//   recuperaria jamas. Es el peor de los dos, porque solo aparece cuando
//   caduca un token -- horas despues de desplegar.

import http from 'node:http';
import { createRequire } from 'node:module';
import { instalarCache, limpiarCache } from '../src/services/cache.js';

const require = createRequire(import.meta.url);
const axios = require('axios');

let golpes = 0;        // cuantas veces se llega de verdad al "backend"
let devolver401 = false;

const servidor = http.createServer((req, res) => {
  golpes++;
  if (devolver401) {
    res.statusCode = 401;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ detail: 'token caducado' }));
    return;
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    url: req.url,
    golpe: golpes,
    auth: req.headers.authorization || null,
  }));
});

await new Promise((r) => servidor.listen(0, '127.0.0.1', r));

const api = axios.create({ baseURL: `http://127.0.0.1:${servidor.address().port}/api` });
// Mismo orden de registro que src/services/api.js: primero el de la cabecera,
// luego el cache. Si se invierte, la prueba deja de reproducir la aplicacion.
api.interceptors.request.use((c) => { c.headers.Authorization = 'Bearer TOKEN-DE-PRUEBA'; return c; });
instalarCache(api);

const fallos = [];
function comprobar(nombre, real, esperado) {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos.push(nombre);
  console.log(`${bien ? 'OK   ' : 'FALLO'} ${nombre}: ${JSON.stringify(real)}` +
    (bien ? '' : ` (esperado ${JSON.stringify(esperado)})`));
}

// --- Lo que se ahorra ------------------------------------------------------

golpes = 0;
const primera = await api.get('/tipos-carga');
await api.get('/tipos-carga');
await api.get('/tipos-carga');
comprobar('3 GET identicos = 1 viaje', golpes, 1);

comprobar('la peticion real lleva Authorization', primera.data.auth, 'Bearer TOKEN-DE-PRUEBA');

limpiarCache(); golpes = 0;
await Promise.all([
  api.get('/dashboard/kpis'), api.get('/dashboard/kpis'),
  api.get('/dashboard/kpis'), api.get('/dashboard/kpis'),
]);
comprobar('4 GET en paralelo = 1 viaje', golpes, 1);

limpiarCache(); golpes = 0;
await api.get('/trips', { params: { estado: 'abierto' } });
await api.get('/trips', { params: { estado: 'cerrado' } });
comprobar('params distintos = 2 viajes', golpes, 2);

golpes = 0;
await api.get('/trips', { params: { estado: 'abierto' } });
comprobar('mismo params = 0 viajes', golpes, 0);

// --- Lo que NO se puede ahorrar --------------------------------------------

// Cerrar un viaje mueve la caja y los KPI. Si el cache no lo olvidara, el
// tablero seguiria contando el viaje como abierto.
limpiarCache(); golpes = 0;
await api.get('/cashbox/balance');
await api.get('/dashboard/kpis');
await api.post('/trips/abc/complete');
const antes = golpes;
await api.get('/cashbox/balance');
await api.get('/dashboard/kpis');
comprobar('tras cerrar un viaje se releen caja y dashboard', golpes - antes, 2);

// Montar un neumatico cambia el vehiculo.
limpiarCache(); golpes = 0;
await api.get('/vehicles');
await api.post('/tires/mount');
const antesNeum = golpes;
await api.get('/vehicles');
comprobar('montar un neumatico relee vehiculos', golpes - antesNeum, 1);

limpiarCache(); golpes = 0;
await api.get('/upload');
await api.get('/upload');
comprobar('/upload nunca cachea', golpes, 2);

limpiarCache(); golpes = 0;
await api.get('/reports/cost-per-km', { responseType: 'arraybuffer' });
await api.get('/reports/cost-per-km', { responseType: 'arraybuffer' });
comprobar('descargas no cachean', golpes, 2);

limpiarCache(); golpes = 0;
await api.get('/vehicles');
await api.get('/vehicles', { sinCache: true });
comprobar('sinCache fuerza el viaje', golpes, 2);

// El cambio de turno en la oficina: setAuthToken/clearAuthToken vacian el
// cache, o el siguiente usuario veria los datos del anterior.
limpiarCache(); golpes = 0;
await api.get('/trips');
limpiarCache();
await api.get('/trips');
comprobar('limpiarCache obliga a releer', golpes, 2);

// --- Renovacion del token --------------------------------------------------

// Un 401 no puede quedarse guardado: services/api.js renueva el token y repite
// la MISMA peticion. Si leyera el fallo de memoria, la sesion no volveria nunca.
limpiarCache(); golpes = 0;
devolver401 = true;
try { await api.get('/trips'); } catch { /* se espera el 401 */ }
devolver401 = false;
const reintento = await api.get('/trips');   // lo que hace api(originalRequest)
comprobar('tras un 401 el reintento sale de verdad', golpes, 2);
comprobar('y trae la respuesta buena', reintento.status, 200);

// --- Cuando el backend no responde -----------------------------------------

limpiarCache(); golpes = 0;
servidor.close();
try { await api.get('/alerts'); } catch { /* se espera que falle */ }
comprobar('un fallo de red no deja entrada en cache', golpes, 0);

console.log(fallos.length ? `\n${fallos.length} FALLOS: ${fallos.join(', ')}` : '\nTodo correcto');
process.exit(fallos.length ? 1 : 0);
