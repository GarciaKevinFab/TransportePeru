import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useWhatsAppVentas, enlaceWhatsApp } from '../hooks/useWhatsAppVentas';
import { PROVEEDOR } from '../config/proveedor';

/**
 * Lo que la administracion de una transportista pregunta antes de contratar,
 * en el orden en que compra: probar, elegir y pagar, el comprobante, como
 * salir, y que pasa con sus datos si no sigue.
 *
 * Todo es autoservicio, sin pasos manuales de por medio. Cada frase
 * esta comprobada contra el codigo y tiene que seguir siendolo:
 *
 *   - 14 dias sin tarjeta: el alta crea la empresa en `trial` (server.py).
 *   - Factura a tu RUC: el checkout pide boleta o factura y, con RUC,
 *     comprobantes.guardar_datos completa la razon social con el padron de
 *     SUNAT (sunat_padron.py).
 *   - Cancelar: POST /api/suscripcion/cancelar desde /suscripcion; se conserva
 *     el acceso hasta el fin del periodo pagado (suscripciones.py).
 *   - Prueba vencida sin pago: `prueba_vencida` corta la ESCRITURA y deja leer
 *     (_exigir_suscripcion_al_dia en server.py). NO pasa sola al plan Gratis.
 */

const PASOS = [
  {
    titulo: 'Pruébalo 14 días gratis, sin tarjeta',
    texto: 'Creas la cuenta de tu empresa y cargas tu flota completa, sin límite de vehículos durante la prueba.',
  },
  {
    titulo: 'Al terminar eliges tu plan y pagas en línea',
    texto: 'Desde tu cuenta, con el resumen del pedido y el total con IGV a la vista.',
  },
  {
    titulo: 'Boleta o factura electrónica a tu RUC',
    texto: 'Escribes tu RUC y completamos la razón social con el padrón de SUNAT. Recibes un comprobante por cada cobro.',
  },
  {
    titulo: 'Sin contrato: cancelas cuando quieras desde tu cuenta',
    texto: 'Se detiene el cobro automático y mantienes el acceso hasta el fin del mes ya pagado.',
  },
  {
    titulo: 'Si no eliges plan, tus datos se quedan',
    texto: 'La cuenta pasa a solo consulta: ves todo lo que cargaste, y para seguir registrando activas un plan.',
  },
];

/**
 * "¿Dudas? Escríbenos por WhatsApp", pequeno. Solo si el backend tiene
 * WHATSAPP_VENTAS: sin numero no se pinta nada.
 */
export const DudasWhatsApp = ({ mensaje, className = '' }) => {
  const numero = useWhatsAppVentas();
  if (!numero) return null;
  return (
    <a
      href={enlaceWhatsApp(numero, mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="dudas-whatsapp"
      className={`inline-flex min-h-11 items-center gap-1.5 text-sm text-grafito-400 transition hover:text-white ${className}`}
    >
      <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      ¿Dudas? Escríbenos por WhatsApp
    </a>
  );
};

/** El bloque junto a los precios. CTA principal: empezar gratis. */
export const ComoSeContrata = ({ className = '' }) => (
  <section
    aria-labelledby="como-se-contrata"
    className={`rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-10 ${className}`}
    data-testid="como-se-contrata"
  >
    <h3 id="como-se-contrata" className="font-heading text-xl font-bold tracking-tight">
      Cómo se contrata
    </h3>
    <ol className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">
      {PASOS.map(({ titulo, texto }, i) => (
        <li key={titulo} className="flex gap-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-marca-500/10 text-sm font-bold text-marca-400">
            {i + 1}
          </span>
          <div>
            <p className="font-bold leading-snug text-grafito-100">{titulo}</p>
            <p className="mt-1 text-sm leading-relaxed text-grafito-400">{texto}</p>
          </div>
        </li>
      ))}
    </ol>
    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
      <Link
        to="/registro"
        className="cta inline-flex min-h-12 items-center gap-2 rounded-full bg-marca-500 px-7 py-3.5 font-bold text-white hover:bg-marca-400"
      >
        Empieza gratis <ArrowRight className="h-4 w-4" />
      </Link>
      <DudasWhatsApp mensaje="Hola, tengo una consulta sobre los planes de CargoXprez." />
    </div>
    <p className="mt-6 text-xs text-grafito-600">
      Te vende y te factura {PROVEEDOR.razonSocial}, RUC {PROVEEDOR.ruc}.
    </p>
  </section>
);
