import { useEffect } from 'react';

/**
 * El contenido que pone el servidor dentro de #root (backend/seo_rutas.py).
 *
 * Las paginas publicas llegan con su texto ya escrito en el HTML: es lo que
 * leen los buscadores y los rastreadores de IA que no ejecutan JavaScript, y
 * lo primero que ve una persona en un movil lento. React, al montar, vacia
 * #root; si lo hiciera tal cual, entre el texto del servidor y la landing de
 * React habria un instante en blanco (o el spinner de carga).
 *
 * Para evitarlo, antes de montar React el bloque se SACA de #root y se deja a
 * la vista justo encima, con #root oculto. Cuando la pagina de React ya esta
 * pintada llama a quitarPrerender() y el cambio es de un fotograma al otro.
 *
 * Salvaguardas: si se navega a otra ruta, o si la pagina nunca avisa (un error
 * de red con un trozo del bundle), el bloque se quita igual a los 10 s.
 */
let bloque = null;

export function adoptarPrerender(root) {
  bloque = root ? root.querySelector('[data-prerender]') : null;
  if (!bloque) return false;
  root.parentNode.insertBefore(bloque, root);
  root.hidden = true;
  window.setTimeout(quitarPrerender, 10000);
  return true;
}

export function quitarPrerender() {
  if (!bloque) return;
  const root = document.getElementById('root');
  if (root) root.hidden = false;
  bloque.remove();
  bloque = null;
}

/** Para las paginas publicas: quita el bloque del servidor al pintarse. */
export function useQuitarPrerender() {
  useEffect(() => {
    quitarPrerender();
  }, []);
}
