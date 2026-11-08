import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, Building2, FileText, Landmark, CalendarClock, Mail } from 'lucide-react';
import { useWhatsAppVentas, enlaceWhatsApp } from '../hooks/useWhatsAppVentas';
import { useTenant } from '../context/TenantContext';
import { PROVEEDOR } from '../config/proveedor';
import { RUTAS_DE_VENTA } from '../config/seo';

/**
 * Hablar con una persona antes de pagar.
 *
 * En el Peru un gerente no deja su tarjeta en la web de alguien que no conoce:
 * quiere saber quien esta detras (razon social y RUC), que le van a dar
 * factura, que puede pagar como paga todo lo demas (orden de compra o
 * transferencia) y poder preguntarle a alguien. Esto es eso, al lado de los
 * precios. El checkout de Mercado Pago no cambia: esto es solo contacto.
 *
 * Sin WHATSAPP_VENTAS en el backend no se pinta ningun boton de WhatsApp. Lo
 * que no depende del numero (cotizacion, demo) cae al correo de soporte.
 */

export const MENSAJES = {
  general: 'Hola, quiero información sobre CargoXprez para mi empresa de transporte.',
  pro: 'Hola, me interesa el plan Pro de CargoXprez. ¿Me pueden ayudar?',
  empresa: 'Hola, quiero una cotización del plan Empresa de CargoXprez para mi flota.',
  compra: 'Hola, estoy en la página de compra del plan Pro de CargoXprez y tengo una consulta.',
  registro: 'Hola, estoy creando la cuenta de mi empresa en CargoXprez y tengo una consulta.',
  ordenCompra:
    'Hola, mi empresa paga con orden de compra o transferencia. ¿Me pueden enviar una cotización del plan Pro de CargoXprez?',
  demo: 'Hola, quiero agendar una demo de 20 minutos de CargoXprez.',
  suscripcion: 'Hola, tengo una consulta sobre la suscripción de mi empresa en CargoXprez.',
};

const MENSAJE_POR_RUTA = {
  '/comprar': MENSAJES.compra,
  '/registro': MENSAJES.registro,
};

const mailto = (asunto, cuerpo) =>
  `mailto:${PROVEEDOR.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

/** Atributos de un enlace que abre WhatsApp en otra pestana. */
const externo = { target: '_blank', rel: 'noopener noreferrer' };

/**
 * Boton "Escríbenos por WhatsApp". No pinta nada si no hay numero.
 * `className` reemplaza el estilo por defecto (pensado para fondo oscuro).
 */
export const BotonWhatsApp = ({ mensaje = MENSAJES.general, children, className, testId }) => {
  const numero = useWhatsAppVentas();
  if (!numero) return null;
  return (
    <a
      href={enlaceWhatsApp(numero, mensaje)}
      {...externo}
      data-testid={testId}
      className={
        className ||
        'cta inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#25D366]/40 px-6 py-3 font-bold text-white hover:bg-[#25D366]/10'
      }
    >
      <MessageCircle className="h-4 w-4 shrink-0 text-[#25D366]" aria-hidden="true" />
      {children || 'Escríbenos por WhatsApp'}
    </a>
  );
};

/**
 * Un enlace que va a WhatsApp si hay numero y al correo si no. Para lo que
 * tiene que funcionar siempre: pedir cotizacion, agendar la demo.
 */
const EnlaceContacto = ({ numero, mensaje, asunto, children }) => {
  const cls = 'font-semibold text-marca-400 underline-offset-2 hover:underline';
  return numero ? (
    <a href={enlaceWhatsApp(numero, mensaje)} {...externo} className={cls}>
      {children}
    </a>
  ) : (
    <a href={mailto(asunto, mensaje)} className={cls}>
      {children}
    </a>
  );
};

/**
 * Bloque de confianza para poner junto a los precios: quien vende, que
 * comprobante da y como hablar con alguien.
 */
export const BloqueConfianza = ({ className = '' }) => {
  const numero = useWhatsAppVentas();
  const via = numero ? 'por WhatsApp' : 'por correo';
  const filas = [
    {
      icono: Building2,
      titulo: `${PROVEEDOR.razonSocial} · RUC ${PROVEEDOR.ruc}`,
      texto: `Empresa peruana con domicilio en ${PROVEEDOR.ciudad}. Es quien te vende y quien te responde.`,
    },
    {
      icono: FileText,
      titulo: 'Emitimos boleta o factura electrónica',
      texto: 'Por cada cobro: boleta con tu DNI o factura con el RUC de tu empresa.',
    },
    {
      icono: Landmark,
      titulo: '¿Tu empresa paga con orden de compra o transferencia?',
      texto: (
        <>
          <EnlaceContacto
            numero={numero}
            mensaje={MENSAJES.ordenCompra}
            asunto="Cotización de CargoXprez (orden de compra o transferencia)"
          >
            Escríbenos {via}
          </EnlaceContacto>{' '}
          y te enviamos una cotización.
        </>
      ),
    },
    {
      icono: CalendarClock,
      titulo: 'Agenda una demo de 20 minutos',
      texto: (
        <>
          Te mostramos el sistema con datos de ejemplo y resolvemos tus dudas.{' '}
          <EnlaceContacto numero={numero} mensaje={MENSAJES.demo} asunto="Quiero agendar una demo de CargoXprez">
            Pídela {via}
          </EnlaceContacto>
          .
        </>
      ),
    },
  ];

  return (
    <section
      aria-label="Quién te vende y cómo contactarnos"
      className={`rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8 ${className}`}
      data-testid="bloque-confianza"
    >
      <ul className="grid gap-6 sm:grid-cols-2">
        {filas.map(({ icono: Icono, titulo, texto }) => (
          <li key={titulo} className="flex gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marca-500/10">
              <Icono className="h-5 w-5 text-marca-400" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold leading-snug text-grafito-100">{titulo}</p>
              <p className="mt-1 text-sm leading-relaxed text-grafito-400">{texto}</p>
            </div>
          </li>
        ))}
      </ul>
      {!numero && (
        <p className="mt-6 flex items-center gap-2 border-t border-white/5 pt-5 text-sm text-grafito-400">
          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
          <a href={`mailto:${PROVEEDOR.email}`} className="hover:text-white">
            {PROVEEDOR.email}
          </a>
        </p>
      )}
    </section>
  );
};

/**
 * Boton flotante de WhatsApp en las paginas publicas del host de la marca.
 *
 * No sale en el panel ni en el subdominio de un cliente: quien esta ahi ya es
 * cliente y viene a trabajar. Mientras se ve, el credito "Hecho por" de
 * index.html se muda a la izquierda (.sb-izquierda), que es lo que su propia
 * cabecera pide cuando hay un flotante de conversion en la esquina.
 */
export const WhatsAppFlotante = () => {
  const { pathname } = useLocation();
  const { tenant, loading } = useTenant();
  const numero = useWhatsAppVentas();
  const ruta = pathname.replace(/\/+$/, '') || '/';
  const visible = Boolean(numero) && !loading && !tenant && RUTAS_DE_VENTA.includes(ruta);

  useEffect(() => {
    if (!visible) return undefined;
    const credito = document.querySelector('.sb-credito');
    credito?.classList.add('sb-izquierda');
    return () => credito?.classList.remove('sb-izquierda');
  }, [visible]);

  if (!visible) return null;
  return (
    <a
      href={enlaceWhatsApp(numero, MENSAJE_POR_RUTA[ruta] || MENSAJES.general)}
      {...externo}
      aria-label="Escríbenos por WhatsApp"
      data-testid="whatsapp-flotante"
      className="fixed bottom-4 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-bold text-[#0b2e17] shadow-lg shadow-black/30 transition hover:brightness-105 print:hidden sm:bottom-6 sm:right-6"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
};
