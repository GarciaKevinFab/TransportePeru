import React from 'react';
import { Skeleton } from './ui/skeleton';

/**
 * Esqueletos de carga con la forma del contenido.
 *
 * Un aro girando en el centro de un hueco de 256 px dice "espera" y nada
 * mas; un esqueleto con la silueta de la tabla dice ademas "aqui va a
 * aparecer una tabla de este tamano", asi que la pagina no salta cuando
 * llegan los datos. Tres formas cubren toda la aplicacion:
 *
 *   EsqueletoTabla   - dentro de la tarjeta de una lista (filas en
 *                      escritorio, tarjetas apiladas en el telefono, que es
 *                      como se pintan las listas a ese ancho).
 *   EsqueletoPagina  - cuando la pagina entera espera: cabecera + filtros +
 *                      tabla.
 *   EsqueletoPanel   - el panel de inicio: saludo, metricas, tarjetas y
 *                      graficas.
 */
const columnasGrid = (n) => ({ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` });

export const EsqueletoTabla = ({ filas = 6, columnas = 5, className = '' }) => (
  <div className={`p-4 sm:p-5 ${className}`} role="status" aria-live="polite" aria-label="Cargando">
    {/* Telefono: tarjetas apiladas */}
    <div className="space-y-3 md:hidden">
      {Array.from({ length: Math.min(filas, 4) }).map((_, i) => (
        <div key={i} className="space-y-2.5 rounded-xl border border-grafito-200/70 p-4 dark:border-grafito-700/60">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
    {/* Escritorio: cabecera + filas */}
    <div className="hidden md:block">
      <div className="grid gap-6 border-b border-grafito-200/70 pb-3 dark:border-grafito-700/60" style={columnasGrid(columnas)}>
        {Array.from({ length: columnas }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-2/3" />
        ))}
      </div>
      <div className="divide-y divide-grafito-100 dark:divide-grafito-800">
        {Array.from({ length: filas }).map((_, f) => (
          <div key={f} className="grid items-center gap-6 py-3.5" style={columnasGrid(columnas)}>
            {Array.from({ length: columnas }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-4 ${c === 0 ? 'w-5/6' : c === columnas - 1 ? 'ml-auto w-1/3' : 'w-2/3'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
    <span className="sr-only">Cargando datos…</span>
  </div>
);

export const EsqueletoPagina = ({ filas = 6, columnas = 5 }) => (
  <div className="space-y-6" role="status" aria-label="Cargando">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg md:h-9 md:w-40" />
    </div>
    <div className="rounded-2xl border border-grafito-200/70 bg-card p-4 dark:border-grafito-700/60">
      <div className="flex flex-col gap-3 md:flex-row">
        <Skeleton className="h-11 flex-1 rounded-lg md:h-9" />
        <Skeleton className="h-11 w-full rounded-lg md:h-9 md:w-40" />
      </div>
    </div>
    <div className="rounded-2xl border border-grafito-200/70 bg-card dark:border-grafito-700/60">
      <EsqueletoTabla filas={filas} columnas={columnas} />
    </div>
  </div>
);

const EsqueletoMetrica = () => (
  <div className="metrica" aria-hidden="true">
    <div className="metrica-cabecera">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-9 w-9 rounded-[0.625rem]" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-9 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  </div>
);

export const EsqueletoPanel = () => (
  <div className="space-y-6" role="status" aria-label="Cargando el panel">
    <Skeleton className="h-36 w-full rounded-2xl sm:h-40" />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <EsqueletoMetrica key={i} />)}
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-4 rounded-2xl border border-grafito-200/70 bg-card p-6 dark:border-grafito-700/60">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-grafito-200/70 bg-card p-5 dark:border-grafito-700/60">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="mt-2 h-3 w-24" />
          <div className="mt-6 flex h-40 items-end gap-2">
            {[40, 65, 30, 80, 55, 70, 45, 90, 60, 35, 75, 50].map((h, j) => (
              <Skeleton key={j} className="flex-1" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
    <span className="sr-only">Cargando el panel…</span>
  </div>
);
