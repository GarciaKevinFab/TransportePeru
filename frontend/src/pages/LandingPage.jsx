import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ComparativaPlanes, Preguntas } from '../components/landing/Comparativa';
import Testimonio from '../components/landing/Testimonio';
import { Revelado, Cifra, CapturaTilt } from '../components/landing/animaciones';
import {
  Truck, Route as RouteIcon, Fuel, Wrench, CircleDot, FileText,
  ShieldCheck, Smartphone, MessageCircle, ScanLine, Building2,
  ArrowRight, Check, Menu, X,
} from 'lucide-react';

/**
 * Landing publica del producto.
 *
 * Va en la raiz y es lo primero que ve alguien que no tiene cuenta. Antes la
 * raiz redirigia a /dashboard, que sin sesion rebotaba a /login: un visitante
 * que llegaba al dominio se encontraba un formulario de acceso y ninguna
 * explicacion de que es esto.
 *
 * NOMBRE DEL PRODUCTO
 *
 *   El repo no traia ninguno: todo estaba marcado como "G&E Transporta S.A.C",
 *   que es UN INQUILINO, no el producto. Se usa FletePro por coherencia con
 *   LicitaPro, de la misma casa. Cambiarlo es tocar esta constante y nada mas.
 *
 * TEMA FIJO EN OSCURO
 *
 *   A diferencia del resto de la aplicacion, esta pagina no sigue el
 *   conmutador de tema: es una pagina de venta, se disena para una sola
 *   lectura, y quien la ve todavia no tiene preferencia guardada.
 */
const PRODUCTO = 'FletePro';

const PASOS = [
  {
    n: '01',
    titulo: 'Operación',
    icono: RouteIcon,
    texto: 'Viajes, viáticos, combustible y caja. La liquidación de flete sale con lo que ya cargaron el chofer y el taller, en vez de rearmarse en una hoja de cálculo a fin de mes.',
  },
  {
    n: '02',
    titulo: 'Flota',
    icono: Wrench,
    texto: 'Vehículos, unidades, llantas e inventario. Cada llanta lleva su historial: montaje, rotación, inspecciones con profundidad, reencauche y baja, con su costo por kilómetro.',
  },
  {
    n: '03',
    titulo: 'Cumplimiento',
    icono: ShieldCheck,
    texto: 'Documentos con sus vencimientos, incidentes, guías de transportista y facturas electronicas para SUNAT, y detracciones. Un documento vencido bloquea la salida antes de que sea una multa.',
  },
];

const MODULOS = [
  { icono: RouteIcon, nombre: 'Viajes y rutas', texto: 'Programación, enganches y cierre con liquidación.' },
  { icono: Fuel, nombre: 'Combustible', texto: 'Vales, cargas y consumo por unidad.' },
  { icono: CircleDot, nombre: 'Llantas', texto: 'Esquema por eje, inspecciones, rotación y reencauche.' },
  { icono: Wrench, nombre: 'Mantenimiento', texto: 'Órdenes de trabajo, planes preventivos e indisponibilidad.' },
  { icono: FileText, nombre: 'Documentos', texto: 'Vencimientos, alertas y bloqueos operativos.' },
  { icono: Building2, nombre: 'SUNAT', texto: 'Guias de transportista, facturas y detracciones.' },
];

const DIFERENCIAS = [
  {
    icono: Smartphone,
    titulo: 'El chofer carga desde el celular, con o sin señal',
    texto: 'Checklist previo al viaje, gastos, incidentes y fotos. Si no hay cobertura se guarda y sube después, que en carretera es la mitad del tiempo.',
  },
  {
    icono: MessageCircle,
    titulo: 'También por WhatsApp',
    texto: 'El chofer manda la foto de la factura por WhatsApp y entra al sistema. Sin instalar nada y sin capacitación.',
  },
  {
    icono: ScanLine,
    titulo: 'Las facturas se leen solas',
    texto: 'La foto de una factura o una guía se convierte en datos: monto, RUC y fecha, sin teclear.',
  },
  {
    icono: ShieldCheck,
    titulo: 'Los datos de cada empresa, separados de verdad',
    texto: 'El aislamiento no depende de que el programador no se olvide de un filtro: lo impone la base de datos. Una consulta sin empresa devuelve cero filas, no las de otro.',
  },
];

const PLANES = [
  {
    nombre: 'Gratis',
    precio: 'S/ 0',
    periodo: '',
    limite: 'Hasta 3 vehículos',
    para: 'Para empezar y ver si encaja.',
    incluye: ['Viajes y liquidaciónes', 'Llantas y mantenimiento', 'Documentos y vencimientos', 'App del chofer'],
    cta: 'Empezar gratis',
    ruta: '/registro',
    destacado: false,
  },
  {
    nombre: 'Pro',
    precio: 'S/ 199',
    periodo: '/mes',
    limite: 'Hasta 20 vehículos',
    para: 'Para la flota que ya factura todos los días.',
    incluye: ['Todo lo del plan Gratis', 'SUNAT: guías y facturas', 'Detracciones', 'Bot de WhatsApp', 'Lectura de facturas', 'Reportes y costo por kilómetro'],
    // Al checkout, no al registro: quien elige Pro viene a COMPRAR, y ahi
    // esta el resumen del pedido y el boton de pago (Izipay).
    cta: 'Elegir Pro',
    ruta: '/comprar?plan=pro',
    destacado: true,
  },
  {
    nombre: 'Empresa',
    precio: 'A medida',
    periodo: '',
    limite: 'Sin límite de vehículos',
    para: 'Para varias sedes o más de una razón social.',
    incluye: ['Todo lo del plan Pro', 'Varias empresas en una cuenta', 'Integraciones a medida', 'Soporte dedicado'],
    cta: 'Hablemos',
    ruta: '/registro',
    destacado: false,
  },
];

const Seccion = ({ id, children, className = '' }) => (
  <section id={id} className={`px-6 py-20 md:py-28 ${className}`}>
    <div className="mx-auto w-full max-w-6xl">{children}</div>
  </section>
);

const Etiqueta = ({ children }) => (
  <div className="flex items-center gap-3 mb-5">
    <span className="h-px w-8 bg-orange-500" />
    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
      {children}
    </span>
  </div>
);

const ENLACES_NAV = [
  ['#como-funciona', 'Cómo funciona'],
  ['#modulos', 'Módulos'],
  ['#planes', 'Planes'],
  ['#preguntas', 'Preguntas'],
];

/* El header vive en su propio componente porque el menu movil necesita estado.
   Hasta ahora los enlaces eran hidden md:flex Y NO HABIA HAMBURGUESA: en un
   telefono no se podia llegar a Planes ni a Entrar mas que llegando al pie.
   Para el trafico de este producto, que es mayormente movil, eso era esconder
   la navegacion justo a quien mas la usa. */
const Cabecera = () => {
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setAbierto(false)}>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500">
            <Truck className="h-5 w-5 text-white" />
          </span>
          <span className="font-heading text-lg font-black uppercase tracking-tight">
            {PRODUCTO}
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {ENLACES_NAV.map(([href, texto]) => (
            <a key={href} href={href} className="text-sm text-slate-300 transition hover:text-white">
              {texto}
            </a>
          ))}
          <Link to="/login" className="text-sm text-slate-300 transition hover:text-white">Entrar</Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/registro"
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-400 sm:px-5"
          >
            Empezar <ArrowRight className="hidden h-4 w-4 sm:block" />
          </Link>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            aria-controls="menu-movil"
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:text-white md:hidden"
          >
            {abierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {abierto && (
        <div id="menu-movil" className="border-t border-white/5 px-4 pb-4 md:hidden">
          {ENLACES_NAV.map(([href, texto]) => (
            <a
              key={href}
              href={href}
              onClick={() => setAbierto(false)}
              className="block border-b border-white/5 py-3.5 text-[15px] text-slate-200"
            >
              {texto}
            </a>
          ))}
          <Link
            to="/login"
            onClick={() => setAbierto(false)}
            className="block py-3.5 text-[15px] font-semibold text-orange-400"
          >
            Entrar al sistema
          </Link>
        </div>
      )}
    </header>
  );
};

const LandingPage = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
    <Cabecera />

    <Seccion className="pt-20 md:pt-28">
      <Etiqueta>Gestión de flota para transportistas del Perú</Etiqueta>

      <h1 className="font-heading max-w-4xl text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
        Tu flota ya genera los datos.
        <span className="block text-slate-500">El problema es que viven</span>
        <span className="block">en seis cuadernos distintos.</span>
      </h1>

      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-slate-400">
        Viajes, combustible, llantas, mantenimiento y documentos en un solo
        sitio. El chofer carga desde el celular, la liquidación sale sola y el
        SOAT vencido te avisa antes de que lo pare la policía.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link
          to="/registro"
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-7 py-3.5 font-bold text-white transition hover:bg-orange-400"
        >
          Empezar gratis <ArrowRight className="h-4 w-4" />
        </Link>
        <a
          href="#como-funciona"
          className="inline-flex items-center rounded-full border border-white/15 px-7 py-3.5 font-bold text-white transition hover:bg-white/5"
        >
          Ver cómo funciona
        </a>
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        14 días de prueba. Sin tarjeta.
      </p>
    </Seccion>

    {/* El producto, visto.
        Faltaba lo mas basico de una landing de software: ver el software. Se
        describian seis modulos sin ensenar ni una pantalla, y un plan de S/199
        no se vende de oidas.

        Las capturas son del sistema de verdad, con datos de una empresa de
        demostracion. Nunca de un cliente: las placas, los choferes y los
        viajes de G&E son datos de su operacion, y una pagina publica no es
        sitio para ellos. */}
    <Seccion id="el-producto" className="border-t border-white/5 !py-0 pb-20 md:pb-28">
      <figure className="relative -mt-6 md:-mt-10">
        {/* Resplandor detras del marco: separa la captura del fondo sin
            necesidad de un borde grueso. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-8 -top-8 bottom-10 rounded-[2rem]
                     bg-[radial-gradient(60%_60%_at_50%_0%,rgba(249,115,22,0.16),transparent_70%)] blur-2xl"
        />
        <CapturaTilt>
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 shadow-2xl shadow-black/60 ring-1 ring-white/5">
          <img
            src="/capturas/panel.webp"
            alt="Panel de FletePro: vehículos disponibles, viajes activos, alertas y documentos por vencer"
            width={1600}
            height={1000}
            loading="lazy"
            decoding="async"
            className="block w-full"
          />
        </div>
        </CapturaTilt>
        <figcaption className="mt-4 text-center text-sm text-slate-500">
          El panel al abrir el sistema: qué está en ruta, qué vence y qué está parado.
        </figcaption>
      </figure>

      <div className="mt-16 grid gap-8 md:mt-20 md:grid-cols-2">
        {[
          {
            src: '/capturas/viajes.webp',
            titulo: 'Cada viaje, con su chofer y su unidad',
            texto:
              'Programado, en curso o cerrado. Al cerrarlo, la liquidación sale con lo que ya cargaron el chofer y el taller.',
            alt: 'Listado de viajes con cliente, ruta, tracto, chofer y estado',
          },
          {
            src: '/capturas/llantas.webp',
            titulo: 'Las llantas, una por una',
            texto:
              'Serial, marca, dimensión, posición en el eje y kilómetros. Con su historial de rotación y reencauche.',
            alt: 'Gestión de llantas con inventario, posición y estado de cada llanta',
          },
        ].map((c) => (
          <Revelado key={c.src} retraso={0}>
          <figure className="group">
            <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-900/60 transition group-hover:border-white/20">
              <img
                src={c.src}
                alt={c.alt}
                width={1600}
                height={1000}
                loading="lazy"
                decoding="async"
                className="block w-full"
              />
            </div>
            <figcaption className="mt-4">
              <h3 className="font-heading text-lg font-bold tracking-tight text-slate-100">
                {c.titulo}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{c.texto}</p>
            </figcaption>
          </figure>
          </Revelado>
        ))}
      </div>
    </Seccion>

    <Seccion className="border-t border-white/5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 md:p-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-400">
          En producción, no en demostración
        </p>
        <p className="font-heading mt-5 max-w-2xl text-2xl font-bold leading-snug tracking-tight md:text-3xl">
          Una transportista peruana mueve su flota con FletePro desde marzo de 2026.
        </p>
        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
          {[
            ['6', 'unidades en operación'],
            ['19', 'llantas con su historial'],
            ['12', 'documentos con vencimiento controlado'],
            ['5', 'meses sin volver al cuaderno'],
          ].map(([cifra, texto]) => (
            <div key={texto}>
              <dt className="font-heading text-4xl font-black tracking-tight text-orange-400">
                <Cifra valor={cifra} />
              </dt>
              <dd className="mt-1.5 text-sm leading-snug text-slate-400">{texto}</dd>
            </div>
          ))}
        </dl>
        <div className="empty:hidden mt-12 border-t border-white/5 pt-10">
          <Testimonio />
        </div>
      </div>
    </Seccion>

    <Seccion id="como-funciona" className="border-t border-white/5">
      <h2 className="font-heading max-w-3xl text-3xl font-black tracking-tight md:text-4xl">
        Operar, mantener, cumplir.
      </h2>
      <p className="mt-5 max-w-2xl text-slate-400">
        Las tres cosas que hacen que un camión salga hoy y siga saliendo el mes
        que viene.
      </p>

      <div className="mt-14 grid gap-10 md:grid-cols-3">
        {PASOS.map(({ n, titulo, texto, icono: Icono }) => (
          <div key={n}>
            <div className="mb-5 flex items-center gap-3">
              <span className="text-xs font-bold tracking-[0.2em] text-orange-500">{n}</span>
              <span className="h-px flex-1 bg-white/10" />
              <Icono className="h-5 w-5 text-orange-500" />
            </div>
            <h3 className="font-heading text-xl font-bold tracking-tight">{titulo}</h3>
            <p className="mt-3 leading-relaxed text-slate-400">{texto}</p>
          </div>
        ))}
      </div>
    </Seccion>

    <Seccion id="modulos" className="border-t border-white/5 bg-slate-900/40">
      <h2 className="font-heading max-w-3xl text-3xl font-black tracking-tight md:text-4xl">
        Todo lo que hoy está en un cuaderno.
      </h2>

      <div className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map(({ icono: Icono, nombre, texto }, i) => (
          <Revelado key={nombre} retraso={(i % 3) * 90}>
            <div className="border-t border-white/10 pt-5">
              <Icono className="h-5 w-5 text-orange-500" />
              <h3 className="mt-3 font-bold">{nombre}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{texto}</p>
            </div>
          </Revelado>
        ))}
      </div>
    </Seccion>

    <Seccion className="border-t border-white/5">
      <h2 className="font-heading max-w-3xl text-3xl font-black tracking-tight md:text-4xl">
        Hecho para como se trabaja en carretera.
      </h2>

      <div className="mt-14 grid gap-12 md:grid-cols-2">
        {DIFERENCIAS.map(({ icono: Icono, titulo, texto }) => (
          <div key={titulo} className="flex gap-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-500/10">
              <Icono className="h-5 w-5 text-orange-400" />
            </span>
            <div>
              <h3 className="font-heading text-xl font-bold tracking-tight">{titulo}</h3>
              <p className="mt-2 leading-relaxed text-slate-400">{texto}</p>
            </div>
          </div>
        ))}
      </div>
    </Seccion>

    <Seccion id="planes" className="border-t border-white/5 bg-slate-900/40">
      <h2 className="font-heading max-w-3xl text-3xl font-black tracking-tight md:text-4xl">
        Un viaje mal liquidado cuesta más.
      </h2>
      <p className="mt-5 max-w-2xl text-slate-400">
        Empiezas gratis y sin tarjeta. Si no te sirve, no pagas nada.
      </p>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {PLANES.map((p) => (
          <div
            key={p.nombre}
            className={`flex flex-col rounded-2xl border p-8 ${
              p.destacado
                ? 'border-orange-500/50 bg-orange-500/[0.07]'
                : 'border-white/10 bg-white/[0.02]'
            }`}
          >
            {p.destacado && (
              <span className="mb-4 self-start rounded-full bg-orange-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                El mas elegido
              </span>
            )}
            <h3 className="font-heading text-xl font-bold tracking-tight">{p.nombre}</h3>
            <p className="mt-1 text-sm text-slate-400">{p.para}</p>

            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-heading text-4xl font-black tracking-tight">{p.precio}</span>
              {p.periodo && <span className="text-slate-400">{p.periodo}</span>}
            </div>
            <p className="mt-2 text-sm font-semibold text-orange-400">{p.limite}</p>

            <ul className="mt-7 space-y-3">
              {p.incluye.map((i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                  {i}
                </li>
              ))}
            </ul>

            <Link
              to={p.ruta}
              className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-bold transition ${
                p.destacado
                  ? 'bg-orange-500 text-white hover:bg-orange-400'
                  : 'border border-white/15 text-white hover:bg-white/5'
              }`}
            >
              {p.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>

      <ComparativaPlanes />
    </Seccion>

    <Seccion id="preguntas" className="border-t border-white/5">
      <h2 className="font-heading max-w-3xl text-3xl font-black tracking-tight md:text-4xl">
        Lo que todos preguntan.
      </h2>
      <Preguntas />
    </Seccion>

    <Seccion className="border-t border-white/5">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-10 text-center md:p-16">
        <h2 className="font-heading mx-auto max-w-2xl text-3xl font-black tracking-tight md:text-4xl">
          Tu próximo viaje puede estar acá dentro.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-slate-400">
          Se configura en una tarde: cargas tus unidades, tus choferes y tus
          rutas, y empiezas a operar.
        </p>
        <Link
          to="/registro"
          className="mt-9 inline-flex items-center gap-2 rounded-full bg-orange-500 px-8 py-4 font-bold text-white transition hover:bg-orange-400"
        >
          Empezar gratis <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-5 text-sm text-slate-500">14 días de prueba. Sin tarjeta.</p>
      </div>
    </Seccion>

    {/* El pie era una sola linea apretada. Con las secciones nuevas -preguntas,
        legales, recuperacion- ya hay sitio que organizar: producto, cuenta y
        legal, mas el contacto real. Es tambien el mapa del sitio para quien
        llego hasta abajo sin decidirse. */}
    <footer className="border-t border-white/5 px-6 pb-24 pt-14">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500">
                <Truck className="h-5 w-5 text-white" />
              </span>
              <span className="font-heading text-lg font-black uppercase tracking-tight text-slate-100">
                {PRODUCTO}
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Gestión de flota para transportistas del Perú. Viajes, llantas,
              mantenimiento y SUNAT en un solo sitio.
            </p>
          </div>

          {[
            ['Producto', [
              ['#como-funciona', 'Cómo funciona'],
              ['#modulos', 'Módulos'],
              ['#planes', 'Planes'],
              ['#preguntas', 'Preguntas frecuentes'],
            ]],
            ['Tu cuenta', [
              ['/login', 'Entrar'],
              ['/registro', 'Crear empresa'],
              ['/olvide', 'Recuperar contraseña'],
            ]],
            ['Legal y contacto', [
              ['/privacidad', 'Privacidad'],
              ['/terminos', 'Términos del servicio'],
              ['mailto:soporte@sisac.pe', 'soporte@sisac.pe'],
            ]],
          ].map(([titulo, enlaces]) => (
            <nav key={titulo} aria-label={titulo}>
              <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-slate-400">
                {titulo}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {enlaces.map(([href, texto]) => (
                  <li key={href}>
                    {href.startsWith('/') ? (
                      <Link to={href} className="text-sm text-slate-500 transition hover:text-white">
                        {texto}
                      </Link>
                    ) : (
                      <a href={href} className="text-sm text-slate-500 transition hover:text-white">
                        {texto}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-12 border-t border-white/5 pt-6 text-sm text-slate-600">
          &copy; {new Date().getFullYear()} Star Insights IT. Hecho en Perú.
        </p>
      </div>
    </footer>
  </div>
);

export default LandingPage;
