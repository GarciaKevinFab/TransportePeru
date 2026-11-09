/**
 * PostHog, cargado tarde y sin lo que pesa.
 *
 * Antes el snippet iba en index.html y arrancaba con la pagina: array.js mas
 * el grabador de sesiones y las encuestas, unos 720 KiB que competian con la
 * landing por la red de un movil (LCP de 14 s medido el 2026-11-09).
 *
 * Ahora:
 *   - Se carga con la primera interaccion (toque, tecla, scroll) o cuando el
 *     navegador queda en reposo despues de `load`, lo que llegue antes. Una
 *     visita que rebota en dos segundos no se mide, y es el precio aceptado.
 *   - Sin encuestas, nunca.
 *   - Sin grabacion de sesion en las paginas publicas. Solo se graba dentro
 *     del panel (MainLayout llama a grabarSesion()), que es donde sirve para
 *     ver en que se traba un cliente.
 *
 * La clave es la publica del proyecto (phc_...), la misma que iba en el HTML.
 */
const CLAVE = 'phc_xAvL2Iq4tFmANRE7kzbKwaSqp1HJjN7x48s3vr0CMjs';
const API_HOST = 'https://us.i.posthog.com';
const EVENTOS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

let pedida = false;
let grabar = false;

// El snippet oficial de PostHog, desminificado lo justo: crea un objeto
// `posthog` que encola las llamadas hasta que llega array.js.
function instalarStub() {
  const w = window;
  if (w.posthog && w.posthog.__SV) return;
  const e = w.posthog || [];
  w.posthog = e;
  e._i = [];
  e.init = function init(i, s, a) {
    function g(t, m) {
      let obj = t;
      let metodo = m;
      const partes = m.split('.');
      if (partes.length === 2) {
        obj = t[partes[0]];
        metodo = partes[1];
      }
      obj[metodo] = function stub(...args) {
        obj.push([metodo].concat(args));
      };
    }
    const p = document.createElement('script');
    p.type = 'text/javascript';
    p.crossOrigin = 'anonymous';
    p.async = true;
    p.src = `${s.api_host.replace('.i.posthog.com', '-assets.i.posthog.com')}/static/array.js`;
    document.head.appendChild(p);
    let u = e;
    if (a !== undefined) {
      u = e[a] = [];
    } else {
      a = 'posthog';
    }
    u.people = u.people || [];
    u.toString = (t) => `posthog${a !== 'posthog' ? `.${a}` : ''}${t ? '' : ' (stub)'}`;
    u.people.toString = () => `${u.toString(1)}.people (stub)`;
    'init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags onFeatureFlags onSessionId identify setPersonProperties group resetGroups reset get_distinct_id alias set_config startSessionRecording stopSessionRecording opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing'
      .split(' ')
      .forEach((m) => g(u, m));
    e._i.push([i, s, a]);
  };
  e.__SV = 1;
}

function arrancar() {
  if (pedida) return;
  pedida = true;
  EVENTOS.forEach((ev) => window.removeEventListener(ev, arrancar));
  instalarStub();
  window.posthog.init(CLAVE, {
    api_host: API_HOST,
    person_profiles: 'identified_only',
    disable_surveys: true,
    disable_session_recording: !grabar,
    session_recording: { recordCrossOriginIframes: true, capturePerformance: false },
  });
}

/** Programa la carga diferida. Se llama una vez, desde index.js. */
export function programarAnalitica() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return;
  EVENTOS.forEach((ev) => window.addEventListener(ev, arrancar, { once: true, passive: true }));
  const enReposo = () => {
    if (window.requestIdleCallback) window.requestIdleCallback(arrancar, { timeout: 8000 });
    else window.setTimeout(arrancar, 4000);
  };
  if (document.readyState === 'complete') enReposo();
  else window.addEventListener('load', enReposo, { once: true });
}

/** Activa la grabacion de sesion: solo dentro del panel. */
export function grabarSesion() {
  grabar = true;
  if (pedida && window.posthog && typeof window.posthog.startSessionRecording === 'function') {
    window.posthog.startSessionRecording();
  }
}
