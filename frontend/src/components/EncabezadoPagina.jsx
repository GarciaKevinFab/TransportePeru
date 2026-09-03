import React from 'react';

/**
 * Cabecera de pagina: titulo, subtitulo y acciones.
 *
 * Veinte paginas repetian a mano el mismo bloque -un flex con el h1 en
 * Barlow mayusculas, el parrafo gris y los botones a la derecha- con
 * pequenas diferencias que nadie decidio: unas centraban los botones, otras
 * los alineaban arriba, alguna olvidaba el subtitulo. Aqui vive una sola
 * vez.
 *
 * En el telefono el titulo va arriba y las acciones ocupan la fila entera
 * repartiendose el ancho ([&>*]:flex-auto), que es lo que el dedo agradece;
 * a partir de `md` vuelven a su tamano y se van a la derecha.
 */
const EncabezadoPagina = ({ titulo, subtitulo, acciones, className = '', children, ...resto }) => (
  <header
    className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between ${className}`}
    {...resto}
  >
    <div className="min-w-0">
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-grafito-900 text-balance">
        {titulo}
      </h1>
      {subtitulo && (
        <p className="mt-1 text-grafito-500 text-pretty">{subtitulo}</p>
      )}
      {children}
    </div>
    {acciones && (
      <div className="flex flex-wrap items-center gap-2 md:shrink-0 [&>*]:flex-auto md:[&>*]:flex-none">
        {acciones}
      </div>
    )}
  </header>
);

export default EncabezadoPagina;
