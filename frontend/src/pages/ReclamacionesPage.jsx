import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Truck, ArrowLeft, BookOpen, Loader2, CheckCircle, Send } from 'lucide-react';

/**
 * Libro de Reclamaciones virtual.
 *
 * No es una cortesia: la Ley 29571 (Codigo de Proteccion y Defensa del
 * Consumidor) obliga a todo proveedor que vende al consumidor final a tener un
 * Libro de Reclamaciones, y el D.S. 101-2022-PCM permite -y para el comercio
 * electronico exige- que sea virtual y accesible desde la propia web. La
 * pasarela de pago tambien lo revisa antes de activar el comercio.
 *
 * La ley pide cosas concretas que el formulario respeta al pie de la letra:
 * distinguir RECLAMO de QUEJA (no son lo mismo y el consumidor tiene derecho a
 * saberlo), identificar al consumidor, permitir que un apoderado firme por un
 * menor de edad, describir el bien contratado, y separar el detalle de los
 * hechos del pedido concreto. Al enviar, el servidor asigna un correlativo:
 * ese codigo es la prueba de que la hoja se presento y es lo que INDECOPI pide
 * si la cosa escala.
 *
 * La concha visual es la del checkout a proposito: misma marca, mismo fondo,
 * mismas tarjetas. Quien llega aqui viene molesto; que la pagina se vea parte
 * del mismo sitio evita la sensacion de haber caido en un formulario muerto.
 */

const TIPOS_DOCUMENTO = ['DNI', 'CE', 'RUC', 'Pasaporte'];

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

// La fecha llega del servidor en ISO ("2026-08-31T23:04:12.285074+00:00"), que
// es lo correcto para viajar y lo peor posible para leer. Aqui se pinta en la
// hora de quien reclama: es la fecha que va a citar si acude a INDECOPI.
const formatearFecha = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const ESTADO_INICIAL = {
  tipo: 'RECLAMO',
  nombre: '',
  documento_tipo: 'DNI',
  documento_numero: '',
  email: '',
  telefono: '',
  direccion: '',
  es_menor_edad: false,
  apoderado: '',
  bien_contratado: 'servicio',
  descripcion_bien: '',
  monto_reclamado: '',
  detalle: '',
  pedido: '',
};

const ReclamacionesPage = () => {
  const [datos, setDatos] = useState(ESTADO_INICIAL);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [hoja, setHoja] = useState(null);

  const set = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  const validar = () => {
    if (datos.nombre.trim().length < 3) return 'Falta tu nombre completo';
    if (datos.documento_numero.trim().length < 6) return 'Falta el número de documento';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email.trim())) return 'El correo no es válido';
    if (datos.telefono.trim().length < 6) return 'Falta un teléfono de contacto';
    // El apoderado no es opcional cuando el consumidor es menor: sin el, la
    // hoja no tiene quien la firme y no vale.
    if (datos.es_menor_edad && datos.apoderado.trim().length < 3)
      return 'Si eres menor de edad, indica el nombre de tu padre, madre o apoderado';
    if (datos.detalle.trim().length < 10) return 'Cuéntanos qué pasó en el detalle del reclamo';
    if (datos.pedido.trim().length < 5) return 'Indica qué pides concretamente';
    return null;
  };

  const enviar = async (e) => {
    e.preventDefault();
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const r = await api.post('/reclamaciones', {
        tipo: datos.tipo,
        nombre: datos.nombre.trim(),
        documento_tipo: datos.documento_tipo,
        documento_numero: datos.documento_numero.trim(),
        email: datos.email.trim(),
        telefono: datos.telefono.trim(),
        direccion: datos.direccion.trim() || null,
        es_menor_edad: datos.es_menor_edad,
        apoderado: datos.es_menor_edad ? datos.apoderado.trim() : null,
        bien_contratado: datos.bien_contratado,
        descripcion_bien: datos.descripcion_bien.trim() || null,
        // El monto es opcional y va como numero: un campo de texto vacio
        // enviado como "" haria fallar la validacion del servidor.
        monto_reclamado: datos.monto_reclamado ? Number(datos.monto_reclamado) : null,
        detalle: datos.detalle.trim(),
        pedido: datos.pedido.trim(),
      });
      setHoja(r.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo registrar la hoja. Inténtalo de nuevo.');
    }
    setEnviando(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* Barra minima, como en el checkout: logo de vuelta y nada mas. */}
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500">
            <Truck className="h-5 w-5 text-white" />
          </span>
          <span className="font-heading text-lg font-black tracking-tight">FLETEPRO</span>
        </Link>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <BookOpen className="h-3.5 w-3.5" />
          Libro de Reclamaciones
        </span>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 pb-20 pt-4 md:pt-8">
        {!hoja ? (
          <>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Link>
            <h1 className="font-heading mt-4 text-3xl font-black tracking-tight md:text-4xl">
              Libro de Reclamaciones
            </h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-slate-400">
              Conforme a la Ley 29571, Código de Protección y Defensa del
              Consumidor. Aquí registras por escrito un reclamo o una queja
              sobre FletePro, servicio de <strong className="text-slate-200">Star Insights IT</strong>.
              Al enviarlo recibes un código de hoja: guárdalo.
            </p>

            <form onSubmit={enviar} className="mt-8 space-y-6" noValidate>
              {/* 1. Tipo. La ley exige que el consumidor pueda elegir, y que se
                  le explique la diferencia: un reclamo obliga a responder sobre
                  el servicio, una queja es sobre el trato recibido. */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-slate-400">
                  1. Tipo de hoja
                </h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    ['RECLAMO', 'Reclamo', 'Disconformidad con el servicio contratado.'],
                    ['QUEJA', 'Queja', 'Malestar con la atención recibida.'],
                  ].map(([valor, titulo, explicacion]) => (
                    <label
                      key={valor}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        datos.tipo === valor
                          ? 'border-orange-500/60 bg-orange-500/10'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="tipo"
                          value={valor}
                          checked={datos.tipo === valor}
                          onChange={set('tipo')}
                          className="h-4 w-4 accent-orange-500"
                        />
                        <span className="font-heading font-bold">{titulo}</span>
                      </span>
                      <span className="mt-1.5 block pl-7 text-sm text-slate-400">
                        {explicacion}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              {/* 2. Identificacion del consumidor. */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-slate-400">
                  2. Quién reclama
                </h2>
                <div className="mt-5 space-y-4">
                  <Campo etiqueta="Nombre completo *">
                    <input
                      className={inputCls}
                      value={datos.nombre}
                      onChange={set('nombre')}
                      placeholder="María Quispe Ramos"
                      data-testid="reclamo-nombre-input"
                    />
                  </Campo>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo etiqueta="Tipo de documento *">
                      <select
                        className={inputCls}
                        value={datos.documento_tipo}
                        onChange={set('documento_tipo')}
                      >
                        {TIPOS_DOCUMENTO.map((t) => (
                          <option key={t} value={t} className="bg-slate-900">
                            {t}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo etiqueta="Número de documento *">
                      <input
                        className={inputCls}
                        value={datos.documento_numero}
                        onChange={set('documento_numero')}
                        placeholder="45678912"
                        inputMode="numeric"
                      />
                    </Campo>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo etiqueta="Correo *">
                      <input
                        type="email"
                        className={inputCls}
                        value={datos.email}
                        onChange={set('email')}
                        placeholder="tucorreo@ejemplo.pe"
                        data-testid="reclamo-email-input"
                      />
                    </Campo>
                    <Campo etiqueta="Teléfono *">
                      <input
                        className={inputCls}
                        value={datos.telefono}
                        onChange={set('telefono')}
                        placeholder="+51 987 654 321"
                      />
                    </Campo>
                  </div>
                  <Campo etiqueta="Dirección (opcional)">
                    <input
                      className={inputCls}
                      value={datos.direccion}
                      onChange={set('direccion')}
                      placeholder="Av. Los Transportistas 123, Lima"
                    />
                  </Campo>

                  <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <input
                      type="checkbox"
                      checked={datos.es_menor_edad}
                      onChange={(e) =>
                        setDatos((d) => ({ ...d, es_menor_edad: e.target.checked }))
                      }
                      className="mt-0.5 h-4 w-4 accent-orange-500"
                    />
                    <span className="text-sm text-slate-300">
                      Soy menor de edad
                      <span className="mt-0.5 block text-slate-500">
                        La hoja debe ir firmada por tu padre, madre o apoderado.
                      </span>
                    </span>
                  </label>

                  {datos.es_menor_edad && (
                    <Campo etiqueta="Padre, madre o apoderado *">
                      <input
                        className={inputCls}
                        value={datos.apoderado}
                        onChange={set('apoderado')}
                        placeholder="Nombre completo del apoderado"
                      />
                    </Campo>
                  )}
                </div>
              </section>

              {/* 3. Identificacion del bien contratado. La ley lo pide para que
                  la hoja no quede en una queja abstracta sin objeto. */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-slate-400">
                  3. Sobre qué reclamas
                </h2>
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo etiqueta="Producto o servicio *">
                      <select
                        className={inputCls}
                        value={datos.bien_contratado}
                        onChange={set('bien_contratado')}
                      >
                        <option value="servicio" className="bg-slate-900">Servicio</option>
                        <option value="producto" className="bg-slate-900">Producto</option>
                      </select>
                    </Campo>
                    <Campo etiqueta="Monto reclamado en S/ (opcional)">
                      <input
                        className={inputCls}
                        value={datos.monto_reclamado}
                        onChange={(e) =>
                          setDatos((d) => ({
                            ...d,
                            monto_reclamado: e.target.value.replace(/[^\d.]/g, ''),
                          }))
                        }
                        placeholder="199.00"
                        inputMode="decimal"
                      />
                    </Campo>
                  </div>
                  <Campo etiqueta="Descripción (opcional)">
                    <input
                      className={inputCls}
                      value={datos.descripcion_bien}
                      onChange={set('descripcion_bien')}
                      placeholder="Plan Pro de FletePro, contratado el 12 de agosto"
                    />
                  </Campo>
                </div>
              </section>

              {/* 4. Detalle y pedido. Van separados porque la ley distingue los
                  hechos de lo que el consumidor pide, y responder sin saber que
                  se pide no cierra nada. */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-slate-400">
                  4. Detalle y pedido
                </h2>
                <div className="mt-5 space-y-4">
                  <Campo etiqueta="Detalle de lo ocurrido *">
                    <textarea
                      rows={5}
                      className={`${inputCls} resize-y`}
                      value={datos.detalle}
                      onChange={set('detalle')}
                      placeholder="Cuenta qué pasó, cuándo y con quién hablaste."
                      data-testid="reclamo-detalle-input"
                    />
                  </Campo>
                  <Campo etiqueta="Qué pides concretamente *">
                    <textarea
                      rows={4}
                      className={`${inputCls} resize-y`}
                      value={datos.pedido}
                      onChange={set('pedido')}
                      placeholder="Por ejemplo: la devolución del cobro duplicado del mes de agosto."
                      data-testid="reclamo-pedido-input"
                    />
                  </Campo>
                </div>
              </section>

              {error && (
                <p
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {/* Aviso obligatorio: el plazo de respuesta y que la hoja no
                  sustituye ni bloquea la via de INDECOPI. Va junto al boton
                  para que se lea antes de enviar, no despues. */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm leading-relaxed text-slate-400">
                <p>
                  La respuesta se enviará a tu correo en un plazo máximo de{' '}
                  <strong className="text-slate-200">15 días hábiles</strong>.
                </p>
                <p className="mt-2">
                  Presentar este reclamo no impide acudir a{' '}
                  <strong className="text-slate-200">INDECOPI</strong> ni a otras
                  vías de solución de controversias.
                </p>
              </div>

              <button
                type="submit"
                disabled={enviando}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3.5 font-bold text-white transition hover:bg-orange-400 disabled:opacity-60"
                data-testid="reclamo-enviar-btn"
              >
                {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                Enviar hoja de reclamación
              </button>
            </form>
          </>
        ) : (
          /* Confirmacion. El codigo es el correlativo de la hoja y va en grande
             porque es lo unico que la persona necesita conservar: sin el no
             puede acreditar ante INDECOPI que presento el reclamo. */
          <div
            className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center"
            data-testid="reclamo-ok"
          >
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green-500/10">
              <CheckCircle className="h-7 w-7 text-green-400" />
            </span>
            <h1 className="font-heading mt-5 text-2xl font-black tracking-tight">
              Hoja registrada
            </h1>
            <p className="mt-3 leading-relaxed text-slate-400">
              Guarda este código. Es el número de tu hoja de reclamación y es lo
              que te pedirán si acudes a INDECOPI.
            </p>
            <p
              className="font-heading mt-6 select-all break-all rounded-xl border border-orange-500/30 bg-orange-500/10 px-6 py-5 text-3xl font-black tracking-tight text-orange-300"
              data-testid="reclamo-codigo"
            >
              {hoja.codigo}
            </p>
            <p className="mt-5 text-sm leading-relaxed text-slate-400">
              Registrada el <strong className="text-slate-200">{formatearFecha(hoja.fecha)}</strong>. Enviamos una
              copia a <strong className="text-slate-200">{datos.email.trim()}</strong> y te
              responderemos en un plazo máximo de{' '}
              <strong className="text-slate-200">{hoja.plazo_habiles} días hábiles</strong>.
            </p>
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

export default ReclamacionesPage;
