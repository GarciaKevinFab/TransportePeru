import React, { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { PROVEEDOR } from '../config/proveedor';
import { Lock, ShieldCheck, ArrowLeft, Loader2, CheckCircle, CreditCard, Clock } from 'lucide-react';
import LogoMarca from '../components/LogoMarca';

/**
 * Checkout publico del plan Pro: resumen del pedido, datos de facturacion y
 * pago con tarjeta.
 *
 * Existe por dos razones que son la misma: quien quiere pagar necesita DONDE,
 * e Izipay valida el comercio mirando la web -sin carrito, checkout o boton de
 * pago no activan la pasarela-.
 *
 * COMO ES EL PAGO
 *
 *   El formulario de tarjeta lo pinta Izipay dentro de #izipay-form a partir
 *   de un formToken que pide el backend. Los datos de la tarjeta NO pasan por
 *   nuestro servidor ni por este componente en ningun momento: van del
 *   navegador a Izipay.
 *
 *   Y lo que se ve aqui al terminar NO es lo que decide si esta pagado. Eso lo
 *   escribe el webhook que Izipay manda al backend; esta pantalla pregunta por
 *   el estado del pedido hasta que ese aviso llega. Si el navegador se cierra
 *   antes, el cobro se registra igual.
 *
 * MIENTRAS IZIPAY NO ACTIVE EL COMERCIO
 *
 *   El backend responde 503 al pedir el formToken y aqui se muestra el aviso
 *   honesto: el pedido queda registrado y no se hizo ningun cargo. Es el mismo
 *   camino que si un dia la pasarela se cae, y por eso no es un caso especial
 *   sino el respaldo normal.
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

// El cliente JavaScript de Izipay (plataforma micuentaweb). Se cargan a mano y
// no con una etiqueta en index.html para no pedirle estos ficheros a todo el
// que entra en la web: solo hacen falta en el paso de pago.
const IZIPAY_SDK = 'https://static.micuentaweb.pe/static/js/krypton-client/V4.0/stable/kr-payment-form.min.js';
const IZIPAY_TEMA_JS = 'https://static.micuentaweb.pe/static/js/krypton-client/V4.0/ext/neon.js';
const IZIPAY_TEMA_CSS = 'https://static.micuentaweb.pe/static/js/krypton-client/V4.0/ext/neon-reset.min.css';

const cargarRecurso = (etiqueta, atributos) =>
  new Promise((resolve, reject) => {
    // Marcado con data-izipay para no volver a inyectarlo si la persona
    // reintenta el pago: dos veces el mismo SDK deja dos formularios.
    const yaEsta = document.head.querySelector(`${etiqueta}[data-izipay="${atributos['data-izipay']}"]`);
    if (yaEsta) return resolve();
    const el = document.createElement(etiqueta);
    Object.entries(atributos).forEach(([k, v]) => el.setAttribute(k, v));
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('No se pudo cargar el formulario de pago'));
    document.head.appendChild(el);
  });

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
  // null = todavia no se sabe; 'tarjeta' = el formulario de Izipay esta
  // montado; 'pendiente' = la pasarela no esta activa; 'confirmando',
  // 'pagado' y 'rechazado' = despues de enviar la tarjeta.
  const [pasarela, setPasarela] = useState(null);
  const [avisoPasarela, setAvisoPasarela] = useState('');

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

  /* Pregunta por el estado del pedido hasta que el webhook de Izipay lo mueva.
     Se consulta al backend y no se cree lo que dice el navegador: el resultado
     que vale es el que Izipay firmo contra el servidor. */
  const esperarConfirmacion = async (ordenId) => {
    for (let intento = 0; intento < 10; intento += 1) {
      try {
        const r = await api.get(`/checkout/ordenes/${ordenId}`);
        if (r.data.estado === 'pagado') {
          setPasarela('pagado');
          return;
        }
        if (r.data.estado === 'rechazado') {
          setPasarela('rechazado');
          return;
        }
      } catch {
        // Un fallo de red aqui no cambia nada: el cobro ya esta hecho o no, y
        // el correo de Izipay llega igual. Se reintenta y, si no, se queda en
        // "confirmando", que es la verdad.
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  const montarFormularioDeTarjeta = async (ordenCreada) => {
    try {
      const { data } = await api.post(`/checkout/ordenes/${ordenCreada.id}/pago`);
      await cargarRecurso('link', { rel: 'stylesheet', href: IZIPAY_TEMA_CSS, 'data-izipay': 'css' });
      await cargarRecurso('script', {
        src: IZIPAY_SDK,
        'kr-public-key': data.public_key,
        'kr-language': 'es-ES',
        'data-izipay': 'sdk',
      });
      await cargarRecurso('script', { src: IZIPAY_TEMA_JS, 'data-izipay': 'tema' });

      const KR = window.KR;
      if (!KR) throw new Error('No se pudo cargar el formulario de pago');
      await KR.setFormConfig({ formToken: data.form_token, 'kr-language': 'es-ES' });
      KR.onSubmit(() => {
        // Se devuelve false para que Izipay no redirija: la confirmacion la
        // damos aqui, preguntando al backend por el aviso firmado.
        setPasarela('confirmando');
        esperarConfirmacion(ordenCreada.id);
        return false;
      });
      await KR.renderElements('#izipay-form');
      setPasarela('tarjeta');
    } catch (err) {
      // 503 = la pasarela todavia no esta activa. Cualquier otro fallo se
      // trata igual, y a proposito: el pedido ya esta guardado, asi que lo
      // honesto es decir que se completara por correo y no perder la venta.
      setAvisoPasarela(err.response?.data?.detail || '');
      setPasarela('pendiente');
    }
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
      await montarFormularioDeTarjeta(r.data);
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
        <Link to="/" className="flex items-center">
          <LogoMarca className="h-14 w-auto" />
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
                  {/* A quien se le paga, en la misma pantalla del cobro. En el
                      cargo de la tarjeta aparecera esta razon social, no la
                      marca: verla antes evita el desconcierto -y la
                      reclamacion- de no reconocer el cobro en el estado de
                      cuenta. */}
                  <p className="text-center text-[11px] leading-relaxed text-slate-600">
                    Contratas con {PROVEEDOR.razonSocial} — RUC {PROVEEDOR.ruc}.{' '}
                    <Link to="/terminos" className="underline underline-offset-2 hover:text-slate-400">
                      Términos
                    </Link>{' '}
                    y{' '}
                    <Link to="/privacidad" className="underline underline-offset-2 hover:text-slate-400">
                      privacidad
                    </Link>.
                  </p>
                </form>
              </section>
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-xl" data-testid="checkout-orden-ok">
            {/* El pedido ya existe con su numero. Lo que se pinta debajo
                depende de como acabo el cobro. */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
              {pasarela === 'pagado' ? (
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green-500/10">
                  <CheckCircle className="h-7 w-7 text-green-400" />
                </span>
              ) : pasarela === 'confirmando' ? (
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-500/10">
                  <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
                </span>
              ) : (
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-500/10">
                  <Clock className="h-7 w-7 text-orange-400" />
                </span>
              )}

              <h1 className="font-heading mt-5 text-2xl font-black tracking-tight">
                {pasarela === 'pagado'
                  ? `¡Listo! Pedido N° ${orden.numero} pagado`
                  : `Pedido N° ${orden.numero} registrado`}
              </h1>
              <p className="mt-3 leading-relaxed text-slate-400">
                {orden.descripcion} — S/ {Number(orden.monto).toFixed(2)} {orden.moneda}
              </p>

              {pasarela === 'pagado' && (
                <>
                  <p className="mt-4 leading-relaxed text-slate-400">
                    Tu plan quedó activo y te enviamos el comprobante a{' '}
                    <strong className="text-slate-200">{datos.email.trim()}</strong>.
                  </p>
                  <Link
                    to="/login"
                    className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3 font-bold text-white transition hover:bg-orange-400"
                  >
                    Entrar a mi cuenta
                  </Link>
                </>
              )}

              {pasarela === 'confirmando' && (
                <p className="mt-4 leading-relaxed text-slate-400">
                  Estamos confirmando el pago con el banco. Puede tardar unos segundos;
                  no cierres esta página.
                </p>
              )}

              {pasarela === 'rechazado' && (
                <p className="mt-4 leading-relaxed text-red-300">
                  El banco rechazó el pago y no se hizo ningún cargo. Puedes intentarlo
                  con otra tarjeta desde{' '}
                  <Link to="/comprar?plan=pro" className="underline underline-offset-2">
                    la página de compra
                  </Link>.
                </p>
              )}

              {pasarela === 'pendiente' && (
                <p className="mt-6 rounded-xl border border-dashed border-white/15 p-5 text-sm leading-relaxed text-slate-400">
                  {avisoPasarela || 'El pago con tarjeta aún no está disponible.'}{' '}
                  Te escribiremos a <strong className="text-slate-200">{datos.email.trim()}</strong>{' '}
                  para completar el pago y activar tu plan.{' '}
                  <strong className="text-slate-200">No se ha realizado ningún cargo.</strong>
                </p>
              )}

              {/* Donde Izipay pinta el formulario de tarjeta. Se mantiene
                  siempre en el arbol -aunque este vacio- porque el SDK lo
                  busca por id al montar, y un contenedor que aparece despues
                  llega tarde. */}
              <div id="izipay-form" className={pasarela === 'tarjeta' ? 'mt-6 text-left' : 'hidden'} />

              {pasarela === null && (
                <p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparando el pago…
                </p>
              )}

              {pasarela !== 'pagado' && (
                <Link
                  to="/"
                  className="mt-7 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 font-bold text-white transition hover:bg-white/5"
                >
                  Volver al inicio
                </Link>
              )}
            </div>

            <p className="mt-5 text-center text-xs text-slate-500">
              ¿Algún problema con tu compra? Escríbenos o usa el{' '}
              <Link to="/reclamaciones" className="text-orange-400 underline-offset-2 hover:underline">
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
