import React, { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import api, { suscripcionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PROVEEDOR } from '../config/proveedor';
import { Lock, ShieldCheck, ArrowLeft, Loader2, CreditCard, Clock, LogIn } from 'lucide-react';
import LogoMarca from '../components/LogoMarca';
import { Preguntas, PREGUNTAS_COMPRA } from '../components/landing/Comparativa';

/**
 * Checkout publico del plan Pro: resumen del pedido y boton de pago.
 *
 * COMO SE PAGA
 *
 *   Con Mercado Pago Suscripciones. La suscripcion es de una EMPRESA, asi que
 *   para pagar hace falta sesion de su dueno o administrador. El backend crea
 *   la suscripcion y devuelve el `init_point`; el navegador se va a Mercado
 *   Pago, donde se teclea la tarjeta. Nada de la tarjeta pasa por aqui.
 *
 *   Lo que se ve al volver NO es lo que decide si esta pagado: eso lo escribe
 *   el webhook firmado. La pagina /suscripcion pregunta hasta que llega.
 *
 * LOS TRES CASOS
 *
 *   - Con sesion y Mercado Pago disponible para esa cuenta: boleta o factura,
 *     DNI/RUC, y "Pagar con Mercado Pago".
 *   - Sin sesion y Mercado Pago abierto a todos (produccion): entrar o crear
 *     la cuenta primero.
 *   - Lo demas (modo simulado, o un correo que no es de prueba en modo
 *     prueba): el pedido de siempre, registrado y sin ningun cargo.
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

const GESTORES = ['owner', 'admin'];

const Campo = ({ etiqueta, children }) => (
  <div>
    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-grafito-400">
      {etiqueta}
    </label>
    {children}
  </div>
);

const inputCls =
  'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-grafito-100 placeholder:text-grafito-400 outline-none transition focus:border-marca-500/60 focus:bg-white/[0.07]';

const CheckoutPage = () => {
  const [params] = useSearchParams();
  const planKey = (params.get('plan') || 'pro').toLowerCase();
  const { user, isAuthenticated, loading } = useAuth();

  // null = todavia no se sabe; 'mercadopago' | 'entrar' | 'pedido'
  const [via, setVia] = useState(null);
  const [datos, setDatos] = useState({ razon_social: '', ruc: '', email: '', telefono: '' });
  const [factura, setFactura] = useState({ comprobante: 'boleta', documento: '', nombre: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [orden, setOrden] = useState(null);

  const esGestor = isAuthenticated && GESTORES.includes(user?.role);

  useEffect(() => {
    if (loading) return;
    let vivo = true;
    (async () => {
      try {
        if (esGestor) {
          const { data } = await suscripcionApi.get();
          if (!vivo) return;
          if (data.facturacion) {
            setFactura({
              comprobante: data.facturacion.tipo || 'boleta',
              documento: data.facturacion.documento || '',
              nombre: data.facturacion.nombre || '',
            });
          }
          setVia(data.mercadopago_disponible ? 'mercadopago' : 'pedido');
          return;
        }
        const { data } = await api.get('/checkout/config');
        if (vivo) setVia(data.mercadopago_publico ? 'entrar' : 'pedido');
      } catch {
        // Sin saber el modo, el camino seguro es el que no cobra.
        if (vivo) setVia('pedido');
      }
    })();
    return () => { vivo = false; };
  }, [loading, esGestor]);

  // El plan Gratis no se compra: se empieza. Y "Empresa" se cotiza a medida.
  if (planKey === 'gratis') return <Navigate to="/registro" replace />;
  const plan = PLANES_COMPRABLES[planKey] || PLANES_COMPRABLES.pro;
  const codigoPlan = planKey in PLANES_COMPRABLES ? planKey : 'pro';

  const set = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  const pagarConMercadoPago = async (e) => {
    e.preventDefault();
    const doc = factura.documento.replace(/\D/g, '');
    if (factura.comprobante === 'factura' && doc.length !== 11) {
      setError('Para factura escribe el RUC de 11 dígitos.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const { data } = await suscripcionApi.suscribirse({
        plan: codigoPlan,
        comprobante: factura.comprobante,
        documento: doc,
        nombre: factura.nombre.trim(),
      });
      // A Mercado Pago. No se vuelve atras con el historial: el retorno llega
      // por back_url a /suscripcion.
      window.location.assign(data.init_point);
    } catch (err) {
      setError(err.response?.data?.detail || 'No pudimos abrir el pago. Inténtalo de nuevo.');
      setEnviando(false);
    }
  };

  const validarPedido = () => {
    if (datos.razon_social.trim().length < 2) return 'Falta la razón social o tu nombre';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email.trim())) return 'El correo no es válido';
    if (datos.ruc && datos.ruc.replace(/\D/g, '').length !== 11) return 'El RUC debe tener 11 dígitos';
    return null;
  };

  const registrarPedido = async (e) => {
    e.preventDefault();
    const problema = validarPedido();
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const r = await api.post('/checkout/ordenes', {
        plan: codigoPlan,
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

  const avisoError = error && (
    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300" role="alert">
      {error}
    </p>
  );

  const pieProveedor = (
    <p className="text-center text-[11px] leading-relaxed text-grafito-600">
      Contratas con {PROVEEDOR.razonSocial} — RUC {PROVEEDOR.ruc}.{' '}
      <Link to="/terminos" className="underline underline-offset-2 hover:text-grafito-400">
        Términos
      </Link>{' '}
      y{' '}
      <Link to="/privacidad" className="underline underline-offset-2 hover:text-grafito-400">
        privacidad
      </Link>.
    </p>
  );

  const formularioMercadoPago = (
    <form onSubmit={pagarConMercadoPago} className="mt-5 space-y-4" noValidate>
      <Campo etiqueta="Comprobante">
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {['boleta', 'factura'].map((tipo) => (
            <button
              key={tipo}
              type="button"
              role="radio"
              aria-checked={factura.comprobante === tipo}
              onClick={() => setFactura((f) => ({ ...f, comprobante: tipo }))}
              className={`rounded-lg border px-4 py-3 text-sm font-bold capitalize transition ${
                factura.comprobante === tipo
                  ? 'border-marca-500 bg-marca-500/10 text-white'
                  : 'border-white/10 bg-white/5 text-grafito-400 hover:text-grafito-200'
              }`}
              data-testid={`checkout-${tipo}`}
            >
              {tipo}
            </button>
          ))}
        </div>
      </Campo>
      <Campo etiqueta={factura.comprobante === 'factura' ? 'RUC *' : 'DNI o RUC (opcional)'}>
        <input
          className={inputCls}
          value={factura.documento}
          onChange={(e) => setFactura((f) => ({ ...f, documento: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
          placeholder={factura.comprobante === 'factura' ? '20123456789' : '12345678'}
          inputMode="numeric"
          data-testid="checkout-documento-input"
        />
      </Campo>
      <Campo etiqueta="Nombre o razón social">
        <input
          className={inputCls}
          value={factura.nombre}
          onChange={(e) => setFactura((f) => ({ ...f, nombre: e.target.value }))}
          placeholder="Con RUC la completamos con el padrón de SUNAT"
        />
      </Campo>
      {avisoError}
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-marca-500 px-6 py-3.5 font-bold text-white transition hover:bg-marca-400 disabled:opacity-60"
        data-testid="checkout-pagar-btn"
      >
        {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
        Pagar con Mercado Pago · S/ {plan.precio.toFixed(2)}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-grafito-400">
        <ShieldCheck className="h-4 w-4 shrink-0 text-grafito-400" />
        Dejas tu tarjeta en el sitio de Mercado Pago. Se cobra cada mes y cancelas cuando quieras desde tu cuenta.
      </p>
      {pieProveedor}
    </form>
  );

  const entrarPrimero = (
    <div className="mt-5 space-y-4">
      <p className="text-sm leading-relaxed text-grafito-400">
        La suscripción es de tu empresa, así que se paga desde tu cuenta. Entra con tu
        usuario de dueño o administrador, o crea la cuenta gratis: tienes 14 días de
        prueba y puedes pagar cuando quieras.
      </p>
      <Link
        to="/login"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-marca-500 px-6 py-3.5 font-bold text-white transition hover:bg-marca-400"
        data-testid="checkout-entrar-btn"
      >
        <LogIn className="h-5 w-5" />
        Entrar para pagar
      </Link>
      <Link
        to="/registro"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 font-bold text-white transition hover:bg-white/5"
      >
        Crear mi cuenta gratis
      </Link>
      {pieProveedor}
    </div>
  );

  const formularioPedido = (
    <form onSubmit={registrarPedido} className="mt-5 space-y-4" noValidate>
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
          <input className={inputCls} value={datos.telefono} onChange={set('telefono')} placeholder="+51 987 654 321" />
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
      {avisoError}
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-marca-500 px-6 py-3.5 font-bold text-white transition hover:bg-marca-400 disabled:opacity-60"
        data-testid="checkout-pagar-btn"
      >
        {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
        Continuar al pago · S/ {plan.precio.toFixed(2)}
      </button>
      <p className="text-center text-xs text-grafito-400">
        El pago en línea todavía no está activo: registramos tu pedido y te escribimos
        para completarlo. No se hace ningún cargo.
      </p>
      {pieProveedor}
    </form>
  );

  return (
    <div className="min-h-screen bg-grafito-950 text-grafito-100 antialiased">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="flex items-center">
          <LogoMarca className="h-14 w-auto" />
        </Link>
        <span className="flex items-center gap-1.5 text-xs text-grafito-400">
          <Lock className="h-3.5 w-3.5" />
          Compra segura
        </span>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 pb-20 pt-4 md:pt-8">
        {!orden ? (
          <>
            <Link to="/#planes" className="inline-flex items-center gap-1.5 text-sm text-grafito-400 transition hover:text-grafito-200">
              <ArrowLeft className="h-4 w-4" />
              Volver a los planes
            </Link>
            <h1 className="font-heading mt-4 text-3xl font-black tracking-tight md:text-4xl">
              Finalizar compra
            </h1>

            <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.1fr]">
              <section
                aria-label="Resumen del pedido"
                className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-7"
                data-testid="resumen-pedido"
              >
                <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-grafito-400">
                  Tu pedido
                </h2>
                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-heading text-lg font-bold">{plan.nombre}</p>
                    <p className="mt-1 text-sm leading-relaxed text-grafito-400">{plan.detalle}</p>
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
                  <p className="mt-2 text-xs text-grafito-400">
                    Precio en soles. Incluye IGV. Suscripción mensual: se cobra cada mes y
                    la cancelas cuando quieras. Emitimos boleta o factura por cada cobro.
                  </p>
                </div>
                <p className="mt-5 text-xs text-grafito-400">
                  ¿Solo quieres probar? El{' '}
                  <Link to="/registro" className="text-marca-400 underline-offset-2 hover:underline">
                    plan Gratis
                  </Link>{' '}
                  no pide tarjeta.
                </p>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-grafito-400">
                  {via === 'mercadopago' ? 'Datos del comprobante' : via === 'entrar' ? 'Tu cuenta' : 'Datos de facturación'}
                </h2>
                {via === null && (
                  <p className="mt-6 flex items-center gap-2 text-sm text-grafito-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparando el pago…
                  </p>
                )}
                {via === 'mercadopago' && formularioMercadoPago}
                {via === 'entrar' && entrarPrimero}
                {via === 'pedido' && formularioPedido}
              </section>
            </div>

            {/* Las dudas de quien esta a punto de pagar, respondidas aqui mismo
                en vez de mandarlo a preguntar: las mismas de la portada. */}
            <section aria-labelledby="preguntas-compra" className="mt-12">
              <h2 id="preguntas-compra" className="font-heading text-xl font-bold tracking-tight">
                Antes de pagar
              </h2>
              <Preguntas items={PREGUNTAS_COMPRA} />
            </section>
          </>
        ) : (
          <div className="mx-auto max-w-xl" data-testid="checkout-orden-ok">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-marca-500/10">
                <Clock className="h-7 w-7 text-marca-400" />
              </span>
              <h1 className="font-heading mt-5 text-2xl font-black tracking-tight">
                Pedido N° {orden.numero} registrado
              </h1>
              <p className="mt-3 leading-relaxed text-grafito-400">
                {orden.descripcion} — S/ {Number(orden.monto).toFixed(2)} {orden.moneda}
              </p>
              <p className="mt-6 rounded-xl border border-dashed border-white/15 p-5 text-sm leading-relaxed text-grafito-400">
                Te escribiremos a <strong className="text-grafito-200">{datos.email.trim()}</strong>{' '}
                para completar el pago y activar tu plan.{' '}
                <strong className="text-grafito-200">No se ha realizado ningún cargo.</strong>
              </p>
              <Link
                to="/"
                className="mt-7 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 font-bold text-white transition hover:bg-white/5"
              >
                Volver al inicio
              </Link>
            </div>
            <p className="mt-5 text-center text-xs text-grafito-400">
              ¿Algún problema con tu compra? Escríbenos o usa el{' '}
              <Link to="/reclamaciones" className="text-marca-400 underline-offset-2 hover:underline">
                Libro de Reclamaciones
              </Link>.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default CheckoutPage;
