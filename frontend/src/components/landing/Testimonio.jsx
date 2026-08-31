import React from 'react';
import { Quote } from 'lucide-react';

/**
 * Testimonio de cliente.
 *
 * ESTA VACIO A PROPOSITO Y NO PINTA NADA HASTA QUE HAYA UNA FRASE REAL.
 *
 * Un testimonio inventado es la forma mas barata de perder una venta: quien lo
 * lee no puede comprobarlo, pero el cliente al que se lo atribuyes si, y el
 * prospecto que pregunta "¿puedo hablar con ellos?" lo descubre en un minuto.
 * Con un solo cliente la tentacion es maxima y el riesgo tambien.
 *
 * PARA ACTIVARLO: rellena TESTIMONIO con lo que la persona haya dicho de
 * verdad, tal cual, y con su permiso para publicarlo. La seccion aparece sola.
 *
 *     const TESTIMONIO = {
 *       frase: 'Antes cerraba la liquidacion el domingo...',
 *       nombre: 'Nombre Apellido',
 *       cargo: 'Gerente de operaciones',
 *       empresa: 'Nombre de la empresa',   // omitelo si no dieron permiso
 *     };
 *
 * La frase se cita literal. Pulirla para que suene mejor la convierte en algo
 * que esa persona no dijo, que es justo el problema que esto evita.
 */
const TESTIMONIO = null;

const Testimonio = () => {
  if (!TESTIMONIO || !TESTIMONIO.frase) return null;

  const { frase, nombre, cargo, empresa } = TESTIMONIO;

  return (
    <figure className="mx-auto max-w-3xl">
      <Quote className="h-8 w-8 text-orange-500/70" aria-hidden="true" />
      <blockquote className="font-heading mt-6 text-2xl font-bold leading-snug tracking-tight text-slate-100 md:text-3xl">
        «{frase}»
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3 text-sm">
        <span className="h-px w-8 bg-orange-500" aria-hidden="true" />
        <span className="text-slate-300">
          <strong className="font-semibold text-slate-100">{nombre}</strong>
          {cargo && <span className="text-slate-400"> · {cargo}</span>}
          {empresa && <span className="text-slate-400"> · {empresa}</span>}
        </span>
      </figcaption>
    </figure>
  );
};

export default Testimonio;
