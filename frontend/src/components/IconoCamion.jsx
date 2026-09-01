import React from 'react';

/**
 * El camion de la marca, como glifo.
 *
 * Es EL MISMO dibujo que el icono de la pestana y de la app instalada
 * (`public/logo.svg`), sin la baldosa roja: aqui la baldosa la pone quien lo
 * usa, porque en la aplicacion ese cuadrado va del color de cada empresa
 * -marca blanca- y no siempre del rojo de CargoXprez.
 *
 * POR QUE NO SE USA EL CAMION DE lucide. Los sitios donde la web ensena "su"
 * icono -el menu lateral, la cabecera movil, el pie de la landing- llevaban el
 * camion generico de la libreria de iconos, que no se parece al de la pestana
 * ni al del logotipo. Eran tres camiones distintos en la misma pagina. Este es
 * uno solo, y cambiarlo aqui lo cambia en todos.
 *
 * Los huecos -parabrisas y llantas- son huecos DE VERDAD, no manchas del color
 * del fondo: los contornos van en sentido horario y los huecos en antihorario,
 * asi que la regla de relleno los vacia. Es lo que permite que el glifo se
 * apoye sobre cualquier color sin que se le vea el parche.
 *
 * El recuadro es 512x512 como el del icono, y no ajustado al dibujo, para que
 * al ponerlo en una caja cuadrada -que es como se usa siempre- quede con el
 * mismo aire que en la pestana.
 */
const IconoCamion = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 512 512"
    className={className}
    fill="none"
    role="presentation"
    aria-hidden="true"
  >
    {/* El dibujo esta trazado alrededor de (230.5, 281); se recoloca para que
        quede opticamente centrado en el recuadro. Mismo ajuste que logo.svg. */}
    <g transform="translate(256 256) translate(-230.5 -281)">
      {/* Estelas de velocidad, las del logotipo. Se apagan hacia atras para no
          competir con la silueta. */}
      <g stroke="currentColor" strokeLinecap="round" strokeWidth="17">
        <line x1="26" y1="214" x2="70" y2="214" opacity=".85" />
        <line x1="26" y1="262" x2="58" y2="262" opacity=".6" />
        <line x1="26" y1="310" x2="46" y2="310" opacity=".38" />
      </g>
      <path
        fill="currentColor"
        d="M106 168 H274 A14 14 0 0 1 288 182 V300 A14 14 0 0 1 274 314 H106 A14 14 0 0 1 92 300 V182 A14 14 0 0 1 106 168 Z
           M310 168 h74 a16 16 0 0 1 13 7 l38 56 a16 16 0 0 1 3 9 v58 a16 16 0 0 1-16 16 H310 a16 16 0 0 1-16-16 V184 a16 16 0 0 1 16-16 Z
           M116 342 a52 52 0 1 1 104 0 a52 52 0 1 1-104 0 Z
           M340 342 a52 52 0 1 1 104 0 a52 52 0 1 1-104 0 Z
           M392 190 L416 234 H358 V200 A10 10 0 0 1 368 190 Z
           M147 342 a21 21 0 1 0 42 0 a21 21 0 1 0-42 0 Z
           M371 342 a21 21 0 1 0 42 0 a21 21 0 1 0-42 0 Z"
      />
    </g>
  </svg>
);

export default IconoCamion;
