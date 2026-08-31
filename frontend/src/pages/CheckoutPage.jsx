import React, { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Truck, Lock, ShieldCheck, ArrowLeft, Loader2, CheckCircle, CreditCard } from 'lucide-react';

/**
 * Checkout publico del plan Pro: resumen del pedido, datos de facturacion y
 * boton de pago.
 *
 * Existe por dos razones que son la misma: quien quiere pagar necesita DONDE,
 * e Izipay valida el comercio mirando la web -sin carrito, checkout o boton de
 * pago no activan la pasarela-. El boton registra la orden en el backend
 * (numero de pedido real) y deja montado el paso de pago donde ira el widget
 * de Izipay cuando el comercio quede activado.
 *
 * El monto NO viaja desde aqui: el navegador manda solo el plan y el servidor
 * pone el precio. Lo que se pinta es informativo.
 */

const PLANES_COMPRABLES = {
  pro: {
    nombre: 'Plan Pro',
    detalle: 'Hasta 20 vehículos · SUNAT: guías y facturas · Detracciones · Bot de WhatsApp · Reportes',
    precio: 199.0,
    periodo: 'al mes',
  },
};

const Campo = ({ etiqueta, children }) => (
  <div>
    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
      {etiqueta}
    </label>
    {children}
  </div>
);

const inputCls =
  'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-orange-500/60 focus:bg-white/[0.07]';

const CheckoutPage = () => {
  const [params] = useSearchParams();
  const planKey = (params.get('plan') || 'pro').toLowerCase();

  const [datos, setDatos] = useState({ razon_social: '', ruc: '', email: '', telefono: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [orden, setOrden] = useState(null);

  // El plan Gratis no se compra: se empieza. Y "Empresa" se cotiza a medida.
  if (planKey === 'gratis') return <Navigate to="/registro" replace />;
  const plan = PLANES_COMPRABLES[planKey] || PLANES_COMPRABLES.pro;

  const set = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  const validar = () => {
    if (datos.razon_social.trim().length < 2) return 'Falta la razón social o tu nombre';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email.trim())) return 'El correo no es válido';
    if (datos.ruc && datos.ruc.replace(/\D/g, '').length !== 11) return 'El RUC debe tener 11 dígitos';
    return null;
  };

  const pagar = async (e) => {
    e.preventDefault();
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const r = await api.post('/checkout/ordenes', {
        plan: planKey in PLANES_COMPRABLES ? planKey : 'pro',
        razon_social: datos.razon_social.trim(),
        ruc: datos.ruc.replace(/\D/g, '') || null,
        email: datos.email.trim(),
        telefono: datos.telefono.trim() || null,
      });
      setOrden(r.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo registrar el pedido. Inténtalo de nuevo.');
    }
    setEnviando(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* Barra minima: logo de vuelta a la landing y el candado. En un
          checkout, cuanta menos navegacion, mejor. */}
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500">
            <Truck className="h-5 w-5 text-white" />
          </span>
          <span className="font-heading text-lg font-black tracking-tight">FLETEPRO</span>
        </Link>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Lock className="h-3.5 w-3.5" />
          Compra segura
        </span>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 pb-20 pt-4 md:pt-8">
        {!orden ? (
          <>
            <Link to="/#planes" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-200">
              <ArrowLeft className="h-4 w-4" />
              Volver a los planes
            </Link>
            <h1 className="font-heading mt-4 text-3xl font-black tracking-tight md:text-4xl">
              Finalizar compra
            </h1>

            <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.1fr]">
              {/* Resumen del pedido (el carrito) */}
              <section
                aria-label="Resumen del pedido"
                className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-7"
                data-testid="resumen-pedido"
              >
                <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-slate-400">
                  Tu pedido
                </h2>
                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-heading text-lg font-bold">{plan.nombre}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{plan.detalle}</p>
                  </div>
                  <p className="font-heading whitespace-nowrap text-lg font-bold">
                    S/ {plan.precio.toFixed(2)}
                  </p>
                </div>
                <div className="mt-6 border-t border-white/10 pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold">Total {plan.periodo}</span>
                    <span className="font-heading text-2xl font-black tracking-tight">
                      S/ {plan.precio.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Precio en soles. Incluye IGV. Se renueva cada mes y puedes cancelar cuando quieras.
                  </p>
                </div>
                <p className="mt-5 text-xs text-slate-500">
                  ¿Solo quieres probar? El{' '}
                  <Link to="/registro" className="text-orange-400 underline-offset-2 hover:underline">
                    plan Gratis
                  </Link>{' '}
                  no pide tarjeta.
                </p>
              </section>

              {/* Datos + boton de pago */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-slate-400">
                  Datos de facturación
                </h2>
                <form onSubmit={pagar} className="mt-5 space-y-4" noValidate>
                  <Campo etiqueta="Razón social o nombre *">
                    <input
                      className={inputCls}
                      value={datos.razon_social}
                      onChange={set('razon_social')}
                      placeholder="Transportes del Sur S.A.C."
                      data-testid="checkout-razon-input"
                    />
                  </Campo>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo etiqueta="RUC (opcional)">
                      <input
                        className={inputCls}
                        value={datos.ruc}
                        onChange={(e) => setDatos((d) => ({ ...d, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                        placeholder="20123456789"
                        inputMode="numeric"
                      />
                    </Campo>
                    <Campo etiqueta="Teléfono (opcional)">
                      <input
                        className={inputCls}
                        value={datos.telefono}
                        onChange={set('telefono')}
                        placeholder="+51 987 654 321"
                      />
                    </Campo>
                  </div>
                  <Campo etiqueta="Correo *">
                    <input
                      type="email"
                      className={inputCls}
                      value={datos.email}
                      onChange={set('email')}
                      placeholder="facturacion@tuempresa.pe"
                      data-testid="checkout-email-input"
                    />
                  </Campo>

                  {error && (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300" role="alert">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={enviando}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3.5 font-bold text-white transition hover:bg-orange-400 disabled:opacity-60"
                    data-testid="checkout-pagar-btn"
                  >
                    {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                    Pagar S/ {plan.precio.toFixed(2)}
                  </button>
                  <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                    Pago con tarjeta procesado por Izipay sobre conexión cifrada.
                  </p>
                </form>
              </section>
            </div>
          </>
        ) : (
          /* Paso de pago: la orden ya existe con su numero. Aqui se montara el
             formulario de Izipay cuando el comercio quede activado; mientras,
             se dice la verdad en vez de fingir un cobro. */
          <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center" data-testid="checkout-orden-ok">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green-500/10">
              <CheckCircle className="h-7 w-7 text-green-400" />
            </span>
            <h1 className="font-heading mt-5 text-2xl font-black tracking-tight">
              Pedido N° {orden.numero} registrado
            </h1>
            <p className="mt-3 leading-relaxed text-slate-400">
              {orden.descripcion} — S/ {Number(orden.monto).toFixed(2)} {orden.moneda}
            </p>
            {/* Contenedor del widget de pago. Izipay montara aqui su formulario
                de tarjeta; el id es el punto de anclaje acordado. */}
            <div id="izipay-form" className="mt-6 rounded-xl border border-dashed border-white/15 p-5 text-sm leading-relaxed text-slate-400">
              Estamos activando el pago con tarjeta vía <strong className="text-slate-200">Izipay</strong>.
              Tu pedido quedó registrado y te escribiremos a{' '}
              <strong className="text-slate-200">{datos.email.trim()}</strong> para completar el pago
              y activar tu plan. No se ha realizado ningún cargo.
            </div>
            <Link
              to="/"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 font-bold text-white transition hover:bg-white/5"
            >
              Volver al inicio
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default CheckoutPage;
