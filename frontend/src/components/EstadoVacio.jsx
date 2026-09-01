import React from 'react';
import { Button } from './ui/button';
import { ArrowRight, Plus } from 'lucide-react';

/**
 * Estado vacio con guia. Sustituye al icono gris con "No se encontraron X".
 *
 * La diferencia importa mas de lo que parece: una tabla vacia es LA PRIMERA
 * PANTALLA que ve una empresa recien registrada. "No se encontraron vehiculos"
 * suena a error de busqueda; lo que esa persona necesita oir es "aqui empieza,
 * y este es el boton". El estado vacio del arranque es onboarding, no un caso
 * borde.
 *
 * Dos variantes deliberadas:
 *  - accion  {texto, onClick}: crea aqui mismo (abre el dialogo de la pagina).
 *  - enlace  {texto, onClick}: el requisito vive en OTRA pagina (no puedes
 *    programar un viaje sin vehiculos), y se lleva a la persona alli en vez de
 *    dejarla frente a un formulario que va a fallar.
 *
 * `filtrado` cubre el caso contrario: SI hay datos pero el filtro no casa.
 * Ahi no se ofrece crear nada -crear un duplicado porque el buscador no lo
 * encontro es un clasico- sino limpiar la busqueda.
 */
const EstadoVacio = ({ icono: Icono, titulo, texto, accion, enlace, filtrado = false }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    {Icono && (
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-marca-50 dark:bg-marca-500/10">
        <Icono className="h-7 w-7 text-marca-500" />
      </div>
    )}
    <h3 className="font-heading text-lg font-bold tracking-tight text-grafito-900 dark:text-grafito-100">
      {titulo}
    </h3>
    {texto && (
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-grafito-500 dark:text-grafito-400">
        {texto}
      </p>
    )}
    {!filtrado && accion && (
      <Button className="btn-action btn-press mt-6" onClick={accion.onClick}>
        <Plus className="mr-2 h-4 w-4" />
        {accion.texto}
      </Button>
    )}
    {!filtrado && enlace && (
      <Button variant="outline" className="mt-3" onClick={enlace.onClick}>
        {enlace.texto}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    )}
  </div>
);

export default EstadoVacio;
