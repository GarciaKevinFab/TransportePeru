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
 * EL HALO NO ES ADORNO. El logotipo tiene contornos y camion negros sobre
 * fondo transparente; el sitio es casi negro. Sin esa sombra clara, la mitad
 * del dibujo desaparece contra el fondo. Se hace con un filtro CSS y no
 * retocando el archivo, para que el asset siga siendo la marca tal cual se
 * registro.
 *
 * Lleva el nombre dentro, asi que sustituye tambien al texto: poner
 * "CargoXprez" al lado seria decirlo dos veces.
 */
const HALO = 'drop-shadow(0 0 1px rgba(255,255,255,.75)) drop-shadow(0 1px 3px rgba(255,255,255,.25))';

const LogoMarca = ({ className = 'h-12 w-auto', halo = true }) => (
  <img
    src="/cargoxprez.png"
    alt={PROVEEDOR.producto}
    className={className}
    style={halo ? { filter: HALO } : undefined}
  />
);

export default LogoMarca;
