// Lo que jsdom no trae y la portada usa. Lo carga react-scripts antes de cada
// prueba (craco test).
import { TextEncoder, TextDecoder } from 'util';

if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
}
