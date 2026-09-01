import React from 'react';
import { PROVEEDOR } from '../config/proveedor';

/**
 * El logotipo de la marca registrada.
 *
 * Vive en un componente y no copiado en cada cabecera por una razon muy
 * concreta: es una marca registrada ante INDECOPI que se reivindica CON SUS
 * COLORES. Cada copia suelta es una oportunidad de que alguien la recorte, la
 * recolore o la estire distinto, y una marca usada de forma inconsistente es
 * mas dificil de defender.
 *
 * EL CONTORNO NO ES ADORNO. El logotipo esta dibujado con perfiles NEGROS
 * -las letras, el camion, las estelas-, que es lo normal en una marca pensada
 * para imprimirse sobre blanco. Sobre el grafito casi negro del sitio esos
 * perfiles no se pierden "un poco": desaparecen, y con ellos el dibujo del
 * camion y el remate de las letras. Lo que queda es una mancha.
 *
 * La solucion anterior era un desenfoque blanco detras. Tapaba el problema
 * -algo se veia- pero emborronaba el logotipo: a tamano de cabecera parecia
 * fuera de foco. Aqui se sustituye por un FILETE de un pixel, cuatro sombras
 * sin desenfoque en cruz, que es como se rotula de verdad una marca de perfil
 * negro sobre fondo oscuro: separa el contorno del fondo sin tocarlo y sin
 * ensuciar nada.
 *
 * Se hace con un filtro CSS y no retocando el archivo, para que el asset siga
 * siendo la marca tal cual se registro.
 *
 * Lleva el nombre dentro, asi que sustituye tambien al texto: poner
 * "CargoXprez" al lado seria decirlo dos veces.
 */
const FILETE = [
  'drop-shadow(1px 0 0 rgba(255,255,255,.92))',
  'drop-shadow(-1px 0 0 rgba(255,255,255,.92))',
  'drop-shadow(0 1px 0 rgba(255,255,255,.92))',
  'drop-shadow(0 -1px 0 rgba(255,255,255,.92))',
  // Una sombra propia, muy suave y hacia abajo, para que el logotipo se apoye
  // en la pagina en vez de flotar recortado sobre ella.
  'drop-shadow(0 2px 6px rgba(0,0,0,.55))',
].join(' ');

/**
 * @param {string}  className  Tamano. Siempre alto + w-auto: el logotipo es
 *                             apaisado y forzarle un ancho lo deforma.
 * @param {boolean} contorno   false cuando el logotipo va sobre fondo CLARO,
 *                             donde sus perfiles negros ya contrastan solos y
 *                             el filete blanco seria un halo sin motivo.
 */
const LogoMarca = ({ className = 'h-12 w-auto', contorno = true }) => (
  <img
    src="/cargoxprez.png"
    alt={PROVEEDOR.producto}
    className={className}
    style={contorno ? { filter: FILETE } : undefined}
  />
);

export default LogoMarca;
