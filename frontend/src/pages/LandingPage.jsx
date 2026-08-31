import React from 'react';
import { Link } from 'react-router-dom';
import {
  Truck, Route as RouteIcon, Fuel, Wrench, CircleDot, FileText,
  ShieldCheck, Smartphone, MessageCircle, ScanLine, Building2,
  ArrowRight, Check,
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
    titulo: 'Operacion',
    icono: RouteIcon,
    texto: 'Viajes, viaticos, combustible y caja. La liquidacion de flete sale con lo que ya cargaron el chofer y el taller, en vez de rearmarse en una hoja de calculo a fin de mes.',
  },
  {
    n: '02',
    titulo: 'Flota',
    icono: Wrench,
    texto: 'Vehiculos, unidades, llantas e inventario. Cada llanta lleva su historial: montaje, rotacion, inspecciones con profundidad, reencauche y baja, con su costo por kilometro.',
  },
  {
    n: '03',
    titulo: 'Cumplimiento',
    icono: ShieldCheck,
    texto: 'Documentos con sus vencimientos, incidentes, guias de transportista y facturas electronicas para SUNAT, y detracciones. Un documento vencido bloquea la salida antes de que sea una multa.',
  },
];

const MODULOS = [
  { icono: RouteIcon, nombre: 'Viajes y rutas', texto: 'Programacion, enganches y cierre con liquidacion.' },
  { icono: Fuel, nombre: 'Combustible', texto: 'Vales, cargas y consumo por unidad.' },
  { icono: CircleDot, nombre: 'Llantas', texto: 'Esquema por eje, inspecciones, rotacion y reencauche.' },
  { icono: Wrench, nombre: 'Mantenimiento', texto: 'Ordenes de trabajo, planes preventivos e indisponibilidad.' },
  { icono: FileText, nombre: 'Documentos', texto: 'Vencimientos, alertas y bloqueos operativos.' },
  { icono: Building2, nombre: 'SUNAT', texto: 'Guias de transportista, facturas y detracciones.' },
];

const DIFERENCIAS = [
  {
    icono: Smartphone,
    titulo: 'El chofer carga desde el celular, con o sin senal',
    texto: 'Checklist previo al viaje, gastos, incidentes y fotos. Si no hay cobertura se guarda y sube despues, que en carretera es la mitad del tiempo.',
  },
  {
    icono: MessageCircle,
    titulo: 'Tambien por WhatsApp',
    texto: 'El chofer manda la foto de la factura por WhatsApp y entra al sistema. Sin instalar nada y sin capacitacion.',
  },
  {
    icono: ScanLine,
    titulo: 'Las facturas se leen solas',
    texto: 'La foto de una factura o una guia se convierte en datos: monto, RUC y fecha, sin teclear.',
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
    limite: 'Hasta 3 vehiculos',
    para: 'Para empezar y ver si encaja.',
    incluye: ['Viajes y liquidaciones', 'Llantas y mantenimiento', 'Documentos y vencimientos', 'App del chofer'],
    cta: 'Empezar gratis',
    destacado: false,
  },
  {
    nombre: 'Pro',
    precio: 'S/ 199',
    periodo: '/mes',
    limite: 'Hasta 20 vehiculos',
    para: 'Para la flota que ya factura todos los dias.',
    incluye: ['Todo lo del plan Gratis', 'SUNAT: guias y facturas', 'Detracciones', 'Bot de WhatsApp', 'Lectura de facturas', 'Reportes y costo por kilometro'],
    cta: 'Empezar gratis',
    destacado: true,
  },
  {
    nombre: 'Empresa',
    precio: 'A medida',
    periodo: '',
    limite: 'Sin limite de vehiculos',
    para: 'Para varias sedes o mas de una razon social.',
    incluye: ['Todo lo del plan Pro', 'Varias empresas en una cuenta', 'Integraciones a medida', 'Soporte dedicado'],
    cta: 'Hablemos',
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

const LandingPage = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
    <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500">
            <Truck className="h-5 w-5 text-white" />
          </span>
          <span className="font-heading text-lg font-black uppercase tracking-tight">
            {PRODUCTO}
          </span>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#como-funciona" className="text-sm text-slate-300 transition hover:text-white">Como funciona</a>
          <a href="#modulos" className="text-sm text-slate-300 transition hover:text-white">Modulos</a>
          <a href="#planes" className="text-sm text-slate-300 transition hover:text-white">Planes</a>
          <Link to="/login" className="text-sm text-slate-300 transition hover:text-white">Entrar</Link>
        </div>

        <Link
          to="/registro"
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-400"
        >
          Empezar <ArrowRight className="h-4 w-4" />
        </Link>
      </nav>
    </header>

    <Seccion className="pt-20 md:pt-28">
      <Etiqueta>Gestion de flota para transportistas del Peru</Etiqueta>

      <h1 className="font-heading max-w-4xl text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
        Tu flota ya genera los datos.
        <span className="block text-slate-500">El problema es que viven</span>
        <span className="block">en seis cuadernos distintos.</span>
      </h1>

      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-slate-400">
        Viajes, combustible, llantas, mantenimiento y documentos en un solo
        sitio. El chofer carga desde el celular, la liquidacion sale sola y el
        SOAT vencido te avisa antes de que lo pare la policia.
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
          Ver como funciona
        </a>
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        14 dias de prueba. Sin tarjeta.
      </p>
    </Seccion>

    <Seccion id="como-funciona" className="border-t border-white/5">
      <h2 className="font-heading max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
        Operar, mantener, cumplir.
      </h2>
      <p className="mt-5 max-w-2xl text-slate-400">
        Las tres cosas que hacen que un camion salga hoy y siga saliendo el mes
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
            <h3 className="font-heading text-2xl font-bold tracking-tight">{titulo}</h3>
            <p className="mt-3 leading-relaxed text-slate-400">{texto}</p>
          </div>
        ))}
      </div>
    </Seccion>

    <Seccion id="modulos" className="border-t border-white/5 bg-slate-900/40">
      <h2 className="font-heading max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
        Todo lo que hoy esta en un cuaderno.
      </h2>

      <div className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map(({ icono: Icono, nombre, texto }) => (
          <div key={nombre} className="border-t border-white/10 pt-5">
            <Icono className="h-5 w-5 text-orange-500" />
            <h3 className="mt-3 font-bold">{nombre}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{texto}</p>
          </div>
        ))}
      </div>
    </Seccion>

    <Seccion className="border-t border-white/5">
      <h2 className="font-heading max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
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
      <h2 className="font-heading max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
        Un viaje mal liquidado cuesta mas.
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
            <h3 className="font-heading text-2xl font-black tracking-tight">{p.nombre}</h3>
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
              to="/registro"
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
    </Seccion>

    <Seccion className="border-t border-white/5">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-10 text-center md:p-16">
        <h2 className="font-heading mx-auto max-w-2xl text-4xl font-black tracking-tight md:text-5xl">
          Tu proximo viaje puede estar aca dentro.
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
        <p className="mt-5 text-sm text-slate-500">14 dias de prueba. Sin tarjeta.</p>
      </div>
    </Seccion>

    <footer className="border-t border-white/5 px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-orange-500" />
          <span className="font-bold text-slate-300">{PRODUCTO}</span>
        </div>
        <span>&copy; {new Date().getFullYear()} Star Insights IT</span>
        <Link to="/login" className="transition hover:text-white">Entrar</Link>
      </div>
    </footer>
  </div>
);

export default LandingPage;
