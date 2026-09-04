// Cache de lecturas para el cliente de axios.
//
// EL PROBLEMA
//
//   Cada pantalla monta su `useEffect` y pide sus datos. Ir a Viajes, entrar a
//   uno, volver al listado y abrir Vehiculos son cuatro viajes al backend para
//   pintar cosas que en buena parte ya estaban en memoria. Hay 115 `useEffect`
//   y 91 lecturas repartidas por la aplicacion: el catalogo de tipos de carga,
//   los tipos de documento o las plantillas de checklist se vuelven a pedir en
//   cada navegacion aunque no cambien en meses.
//
//   Con varias empresas operando a la vez, eso es carga constante sobre
//   Postgres para devolver lo mismo, y un esqueleto de carga en pantalla cada
//   vez que alguien vuelve atras.
//
// POR QUE AQUI Y NO CON UNA LIBRERIA
//
//   react-query resuelve esto mejor, pero obliga a reescribir los 91 puntos de
//   llamada repartidos en 45 ficheros y a recompilar con una dependencia mas.
//   Todas las lecturas ya pasan por la misma instancia de axios
//   (services/api.js), asi que un interceptor las cubre todas de una vez.
//
// QUE HACE, EN ORDEN
//
//   1. Deduplica: si la misma peticion ya esta en vuelo, la segunda se cuelga
//      de la primera en vez de abrir otra.
//   2. Sirve de memoria mientras la entrada siga viva (TTL por ruta).
//   3. Invalida al escribir: un POST/PUT/DELETE tira el cache de su entidad y
//      el de las que dependen de ella. Sin esto el cache miente, que es peor
//      que no tenerlo.
//
// QUE NO ES
//
//   No tiene nada que ver con hooks/useOffline.js. Aquel guarda viajes y
//   vehiculos en IndexedDB para que un chofer sin señal pueda seguir
//   trabajando, y sobrevive a cerrar el navegador a proposito. Esto vive en
//   memoria, dura segundos y solo evita repetir la misma consulta.

import axios from 'axios';

// clave -> { expira: epoch ms, respuesta }
const almacen = new Map();
// clave -> Promise de la peticion en curso
const enVuelo = new Map();

// TTL en segundos por prefijo de ruta. Gana el primero que encaja, asi que lo
// especifico va antes que lo general.
//
// El criterio es "cuanto puede envejecer este dato sin que a nadie le importe":
// los tipos de carga los edita el administrador cada varios meses; un viaje en
// curso cambia mientras alguien mira la pantalla.
const TTL = [
  // Catalogo: se toca de Pascuas a Ramos.
  ['/document-types', 300],
  ['/tipos-carga', 300],
  ['/checklist-templates', 300],
  ['/routes', 300],
  ['/suppliers', 300],
  ['/proveedores', 300],
  ['/maintenance/matrix-plans', 300],
  ['/inventory/items', 300],
  ['/notifications/vapid-public-key', 300],
  // Flota y personal: cambia al dar de alta una unidad o un chofer.
  ['/vehicles', 60],
  ['/units', 60],
  ['/couplings', 60],
  ['/users', 60],
  ['/tires', 60],
  // Agregados: se recalculan sobre datos del dia.
  ['/dashboard', 60],
  ['/reports', 60],
  ['/fuel/kpis', 60],
  // Operativa viva. TTL corto: existe para absorber el ida y vuelta entre
  // pantallas, no para ahorrarse una recarga de verdad.
  ['/trips', 20],
  ['/checklists', 20],
  ['/documents', 20],
  ['/issues', 20],
  ['/alerts', 20],
  ['/cashbox', 20],
  ['/liquidaciones-flete', 20],
  ['/liquidacion-lineas', 20],
  ['/detracciones', 20],
  ['/settlements', 20],
  ['/maintenance', 20],
  ['/fuel', 20],
  ['/inventory', 20],
  ['/whatsapp', 20],
  ['/auth/me', 30],
];

// Rutas que NUNCA se cachean.
//
//   /upload y /documentos/ocr  suben o procesan ficheros; ni son GET ni
//                              tendria sentido repetir una respuesta.
//   /auth/refresh              la renovacion del token tiene que salir siempre.
const NUNCA = ['/upload', '/documentos/ocr', '/auth/refresh'];

// Que hay que olvidar cuando se escribe en cada sitio.
//
// Las dependencias cruzadas son el motivo de que esto sea una tabla y no
// "borrar lo que empiece igual": cerrar un viaje cambia el viaje, PERO TAMBIEN
// la caja, la liquidacion, los KPI y las alertas. Si solo se olvidara /trips,
// el tablero seguiria contando el viaje como abierto.
const DEPENDE = {
  '/trips': ['/trips', '/dashboard', '/alerts', '/settlements', '/cashbox', '/reports', '/checklists', '/liquidaciones-flete', '/vehicles'],
  '/settlements': ['/settlements', '/trips', '/cashbox', '/dashboard', '/reports'],
  '/liquidaciones-flete': ['/liquidaciones-flete', '/liquidacion-lineas', '/trips', '/dashboard', '/reports'],
  '/liquidacion-lineas': ['/liquidacion-lineas', '/liquidaciones-flete', '/trips', '/dashboard'],
  '/detracciones': ['/detracciones', '/dashboard', '/reports'],
  '/cashbox': ['/cashbox', '/dashboard', '/reports'],
  '/vehicles': ['/vehicles', '/units', '/tires', '/couplings', '/dashboard', '/maintenance', '/documents'],
  '/units': ['/units', '/vehicles', '/couplings'],
  '/couplings': ['/couplings', '/vehicles', '/units'],
  '/tires': ['/tires', '/vehicles', '/reports', '/inventory'],
  '/maintenance': ['/maintenance', '/vehicles', '/alerts', '/dashboard', '/inventory'],
  '/documents': ['/documents', '/alerts', '/reports', '/vehicles', '/users'],
  '/documentos': ['/documents', '/alerts'],
  '/upload': ['/documents'],
  '/checklists': ['/checklists', '/trips', '/issues', '/vehicles'],
  '/checklist-templates': ['/checklist-templates', '/checklists'],
  '/issues': ['/issues', '/alerts', '/maintenance', '/vehicles'],
  '/alerts': ['/alerts', '/dashboard'],
  '/fuel': ['/fuel', '/dashboard', '/reports', '/vehicles'],
  '/inventory': ['/inventory', '/maintenance', '/tires'],
  '/whatsapp': ['/whatsapp', '/trips'],
  '/tipos-carga': ['/tipos-carga', '/trips'],
  '/proveedores': ['/proveedores', '/suppliers'],
  '/suppliers': ['/suppliers', '/proveedores'],
  '/routes': ['/routes', '/trips'],
  '/users': ['/users'],
  '/auth': null, // login, logout o cambio de token: el cache entero deja de valer
};

function prefijo(url) {
  // '/trips/abc/complete' -> '/trips'. Basta el primer segmento para decidir a
  // quien afecta una escritura.
  const limpia = String(url || '').split('?')[0];
  const partes = limpia.split('/').filter(Boolean);
  return partes.length ? `/${partes[0]}` : '/';
}

function ttlDe(url) {
  const limpia = String(url || '').split('?')[0];
  for (const [ruta, segundos] of TTL) {
    if (limpia === ruta || limpia.startsWith(`${ruta}/`)) return segundos;
  }
  // Cualquier GET fuera de la tabla se cachea unos segundos igualmente. Es el
  // caso que motiva todo esto: navegar a otra pantalla y volver no deberia
  // repetir la consulta. Diez segundos no envejecen nada que un humano note, y
  // cubre las rutas que se añadan mañana sin tocar aqui.
  return 10;
}

function cacheable(config) {
  if (String(config.method || 'get').toLowerCase() !== 'get') return false;
  // Las descargas vienen como blob o arraybuffer.
  if (config.responseType && config.responseType !== 'json') return false;
  const limpia = String(config.url || '').split('?')[0];
  if (NUNCA.some((r) => limpia === r || limpia.startsWith(`${r}/`))) return false;
  // Escotilla por llamada: api.get(url, { sinCache: true }) para el boton de
  // "Actualizar", que tiene que ir al servidor siempre o no significa nada.
  if (config.sinCache) return false;
  return true;
}

function claveDe(config) {
  // Los params se ordenan: { desde, hasta } y { hasta, desde } son la misma
  // consulta y tienen que compartir entrada.
  const params = config.params || {};
  const orden = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join('&');
  return `${config.url}${orden ? `?${orden}` : ''}`;
}

/** Olvida las lecturas afectadas por una escritura en `url`. */
export function invalidar(url) {
  const raiz = prefijo(url);
  const afectados = raiz in DEPENDE ? DEPENDE[raiz] : [raiz];

  if (afectados === null) {
    almacen.clear();
    return;
  }
  for (const clave of Array.from(almacen.keys())) {
    if (afectados.some((p) => clave === p || clave.startsWith(`${p}/`) || clave.startsWith(`${p}?`))) {
      almacen.delete(clave);
    }
  }
}

/** Vacia el cache entero. Se llama al entrar y al salir de una sesion. */
export function limpiarCache() {
  almacen.clear();
  enVuelo.clear();
}

/**
 * Engancha el cache a una instancia de axios.
 *
 * Se hace con `config.adapter` y no devolviendo la respuesta desde el
 * interceptor porque axios espera que un interceptor de peticion devuelva una
 * config, no una respuesta: cortar ahi obliga a rechazar la promesa con un
 * objeto centinela y a distinguirlo despues en el interceptor de error. El
 * adapter es el punto que axios ya tiene previsto para "esta peticion la
 * resuelve otro".
 */
export function instalarCache(api) {
  api.interceptors.request.use((config) => {
    if (!cacheable(config)) return config;

    const clave = claveDe(config);
    const guardada = almacen.get(clave);

    if (guardada && guardada.expira > Date.now()) {
      config.adapter = (cfg) => Promise.resolve({ ...guardada.respuesta, config: cfg, cached: true });
      return config;
    }
    if (guardada) almacen.delete(clave);

    const cursando = enVuelo.get(clave);
    if (cursando) {
      // Misma peticion ya viajando: esta se cuelga de aquella. Si la primera
      // falla, esta falla igual -- que es lo correcto: son la misma consulta, y
      // el reintento tras renovar el token las repesca a las dos.
      config.adapter = (cfg) => cursando.then((r) => ({ ...r, config: cfg, cached: true }));
      return config;
    }

    // Primera de su clase: se anota como en vuelo para que las siguientes se
    // enganchen. Pero el viaje NO se lanza aqui.
    //
    // POR QUE PEREZOSO Y NO `original(config)` A SECAS
    //
    //   Este interceptor corre ANTES que el que pone la cabecera Authorization
    //   -- axios ejecuta los de peticion en orden inverso al registro --, asi
    //   que disparar la peticion en esta linea la manda SIN TOKEN. Sale un 401,
    //   el interceptor de respuesta lo toma por sesion caducada y arranca la
    //   renovacion; con suerte funciona y con menos suerte echa al usuario al
    //   login. En cualquier caso, cada lectura de la aplicacion pasaria dos
    //   veces por el backend.
    //
    //   La promesa se crea ahora (para poder deduplicar) pero se resuelve
    //   cuando axios invoca el adapter, que es el final de la cadena y ya trae
    //   la cabecera puesta.
    //
    //   El adapter se resuelve con axios.getAdapter porque desde axios 1.x
    //   `defaults.adapter` NO es una funcion sino la lista de candidatos por
    //   nombre -- ["xhr","http","fetch"] --; llamarlo directamente revienta con
    //   "adapter is not a function".
    let lanzar;
    const viaje = new Promise((cumplir, fallar) => {
      lanzar = (configFinal) => {
        const original = axios.getAdapter(api.defaults.adapter);
        Promise.resolve(original(configFinal)).then(cumplir, fallar);
      };
    });
    let lanzada = false;
    enVuelo.set(clave, viaje);

    viaje
      .then((respuesta) => {
        almacen.set(clave, {
          expira: Date.now() + ttlDe(config.url) * 1000,
          // Solo lo que un componente puede llegar a mirar. Guardar `request`
          // (un XMLHttpRequest) mantendria vivo el objeto del navegador.
          respuesta: {
            data: respuesta.data,
            status: respuesta.status,
            statusText: respuesta.statusText,
            headers: respuesta.headers,
          },
        });
      })
      .catch(() => {
        // Un error no se cachea. Ademas del caso obvio -- que el siguiente
        // intento tiene que volver a preguntar --, aqui es imprescindible: un
        // 401 dispara la renovacion del token y el reintento de la misma
        // peticion. Si la respuesta fallida se hubiera guardado, el reintento
        // leeria el 401 de memoria y la sesion no se recuperaria nunca.
      })
      .finally(() => {
        enVuelo.delete(clave);
      });

    config.adapter = (configFinal) => {
      if (!lanzada) {
        lanzada = true;
        lanzar(configFinal);
      }
      return viaje.then((r) => ({ ...r, config: configFinal }));
    };
    return config;
  });

  api.interceptors.response.use(
    (respuesta) => {
      const metodo = String(respuesta.config?.method || '').toLowerCase();
      if (['post', 'put', 'patch', 'delete'].includes(metodo)) {
        invalidar(respuesta.config.url);
      }
      return respuesta;
    },
    (error) => Promise.reject(error)
  );

  return api;
}
