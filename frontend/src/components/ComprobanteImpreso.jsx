import React from 'react';
import { PROVEEDOR } from '../config/proveedor';

/**
 * El comprobante del pedido pagado, saliendo de una impresora.
 *
 * POR QUE clip-path Y NO transform
 *
 *   Lo primero que se probo fue mover el papel con translateY(-100%) -> 0
 *   dentro de un contenedor con overflow:hidden. En una captura fija se ve
 *   bien, pero la animacion entera esta AL REVES: lo que asoma por la ranura
 *   es el PIE del ticket y la cabecera llega la ultima. Una impresora imprime
 *   de arriba abajo.
 *
 *   Con clip-path el papel no se mueve: se descubre de arriba hacia abajo.
 *   Sale primero "COMPROBANTE", despues el numero de pedido y el total al
 *   final, que es el orden en que se imprimiria de verdad. Ademas el hueco ya
 *   esta reservado desde el primer fotograma, asi que el boton de "Entrar a mi
 *   cuenta" que hay debajo no da ningun salto mientras dura.
 *
 *   steps() y no una curva suave: una termica alimenta el papel a tirones.
 *
 * POR QUE UN <style> Y NO tailwind.config.js
 *
 *   Los keyframes son de esta pieza y de ninguna otra. Meterlos en la
 *   configuracion global obliga a leer dos ficheros para entender un
 *   componente, y deja una animacion suelta en el tema el dia que este
 *   comprobante cambie o desaparezca.
 *
 * EL IGV SE CALCULA, NO SE PIDE
 *
 *   `orden.monto` ya lo lleva dentro (ver backend/planes.py). El IGV se saca
 *   RESTANDO la base al total y no multiplicando, para que las dos cifras
 *   sumen exactamente lo que se cobro: multiplicando, 149/1.18 redondeado deja
 *   un centimo de descuadre justo en la pantalla donde el cliente compara con
 *   el cargo de su tarjeta.
 */
export default function ComprobanteImpreso({ orden }) {
  const total = Number(orden?.monto || 0);
  const base = Math.round((total / 1.18) * 100) / 100;
  const igv = Math.round((total - base) * 100) / 100;
  const dinero = (n) => n.toLocaleString('es-PE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  return (
    <div className="mx-auto mt-8 max-w-sm text-left" data-testid="comprobante-impreso">
      <style>{`
        @keyframes cx-imprimir {
          from { clip-path: inset(0 0 100% 0); }
          to   { clip-path: inset(0 0 0 0); }
        }
        .cx-papel { animation: cx-imprimir 1.8s steps(22, end) .25s both; }
        /* Quien pide menos movimiento ve el comprobante entero desde el primer
           fotograma. La informacion es la misma; lo que sobra es el espectaculo. */
        @media (prefers-reduced-motion: reduce) { .cx-papel { animation: none; } }
        .cx-dientes {
          height: 10px; background: #f7f5ef;
          filter: drop-shadow(0 14px 26px rgba(0,0,0,.5));
          -webkit-mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg)
                        bottom / 12px 100% repeat-x;
                  mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg)
                        bottom / 12px 100% repeat-x;
        }
        .cx-barras {
          height: 34px;
          background: repeating-linear-gradient(90deg,
            #23282c 0 2px, transparent 2px 4px, #23282c 4px 5px, transparent 5px 9px,
            #23282c 9px 12px, transparent 12px 13px, #23282c 13px 14px, transparent 14px 18px);
        }
      `}</style>

      {/* La impresora. El z-10 la deja por delante del papel que sale de ella. */}
      <div className="relative z-10 rounded-t-2xl border border-white/10 bg-white/[0.05] px-6 pb-2 pt-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-marca-400">
            {PROVEEDOR.producto}
          </span>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-400" aria-hidden="true" />
            Pagado
          </span>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <span className="text-sm font-bold text-grafito-200">
            Pedido N° {orden?.numero}
          </span>
          <span className="font-heading text-2xl font-black tracking-tight tabular-nums">
            S/ {dinero(total)}
          </span>
        </div>
        {/* La ranura por la que sale el papel. */}
        <div
          className="mx-[-6px] mt-4 h-[7px] rounded"
          style={{ background: '#060a08', boxShadow: 'inset 0 2px 4px rgba(0,0,0,.9)' }}
          aria-hidden="true"
        />
      </div>

      <div className="px-6">
        <div className="cx-papel">
          <div
            className="px-5 pb-4 pt-6 text-[13px] leading-[1.7]"
            style={{ background: '#f7f5ef', color: '#23282c', fontFamily: 'ui-monospace, Consolas, monospace' }}
          >
            <p className="m-0 text-center text-[12px] font-bold tracking-[0.22em]">COMPROBANTE</p>
            <p className="m-0 mb-4 text-center text-[10px] leading-snug" style={{ color: '#6b7075' }}>
              {PROVEEDOR.razonSocial}<br />RUC {PROVEEDOR.ruc}
            </p>

            <div className="flex justify-between gap-3">
              <span>Pedido</span><span className="tabular-nums">{orden?.numero}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Estado</span><span>PAGADO</span>
            </div>

            <div className="my-3 border-t border-dashed" style={{ borderColor: '#c9c5ba' }} />

            <div className="flex justify-between gap-3">
              <span>{orden?.descripcion}</span>
              <span className="tabular-nums whitespace-nowrap">{dinero(base)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>IGV 18%</span>
              <span className="tabular-nums whitespace-nowrap">{dinero(igv)}</span>
            </div>

            <div className="my-3 border-t border-dashed" style={{ borderColor: '#c9c5ba' }} />

            <div className="flex justify-between gap-3 pt-1 text-[15px] font-bold">
              <span>TOTAL {orden?.moneda || 'S/'}</span>
              <span className="tabular-nums whitespace-nowrap">{dinero(total)}</span>
            </div>

            <div className="cx-barras my-3" aria-hidden="true" />
            <p className="m-0 text-center text-[10px] tracking-[0.3em]" style={{ color: '#6b7075' }}>
              {orden?.numero}
            </p>
            <p className="m-0 mt-4 text-center text-[10px] leading-relaxed" style={{ color: '#6b7075' }}>
              Guarda este número para cualquier consulta.<br />
              <a href={`mailto:${PROVEEDOR.email}`} style={{ color: '#6b7075' }}>{PROVEEDOR.email}</a>
            </p>
          </div>
          {/* El borde de papel arrancado. Va aparte para que la mascara de los
              dientes no recorte tambien el texto del ticket. */}
          <div className="cx-dientes" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
