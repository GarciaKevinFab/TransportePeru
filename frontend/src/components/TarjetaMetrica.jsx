import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * La tarjeta de metrica de toda la aplicacion (estilos en .metrica, index.css).
 *
 * Una sola forma: rotulo pequeno arriba, chip de icono a la derecha, valor
 * grande en Barlow con cifras tabulares y una linea de detalle. Sin filete
 * lateral de color ni icono fantasma detras.
 *
 * `tono` dice que SIGNIFICA el numero, no de quien es la marca:
 *   neutro  - un conteo sin juicio (vehiculos, choferes, ordenes)
 *   marca   - lo que es de la marca (la flota total, el producto)
 *   alerta  - algo que ya esta mal (alertas activas, criticas, bajo stock)
 *   aviso   - algo que va a estar mal (documentos por vencer)
 *   ok      - algo que va bien (disponibles, completados)
 *
 * Si recibe onClick se vuelve un <button>, con lo que el teclado y el lector
 * de pantalla la tratan como lo que es: un acceso a la pagina del detalle.
 */
const TarjetaMetrica = ({
  titulo,
  valor,
  detalle,
  icono: Icono,
  tono = 'neutro',
  onClick,
  tendencia,
  tendenciaTexto = 'vs mes anterior',
  className = '',
  ...resto
}) => {
  const Etiqueta = onClick ? 'button' : 'div';
  return (
    <Etiqueta
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-clic={onClick ? '' : undefined}
      className={`metrica metrica-tono-${tono} ${className}`}
      {...resto}
    >
      <div className="metrica-cabecera">
        <p className="metrica-rotulo">{titulo}</p>
        {Icono && (
          <span className="metrica-chip" aria-hidden="true">
            <Icono className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
        )}
      </div>
      <div>
        <p className="metrica-valor">{valor}</p>
        {detalle && <p className="metrica-detalle">{detalle}</p>}
      </div>
      {tendencia !== undefined && tendencia !== null && (
        <div className="flex items-center gap-2">
          <span className={tendencia >= 0 ? 'trend-up' : 'trend-down'}>
            {tendencia >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(tendencia)}%
          </span>
          <span className="text-xs text-grafito-500">{tendenciaTexto}</span>
        </div>
      )}
    </Etiqueta>
  );
};

export default TarjetaMetrica;
