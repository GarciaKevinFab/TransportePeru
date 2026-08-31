import React from 'react';
import { Truck, CheckCircle2 } from 'lucide-react';

/**
 * El panel de marca de las pantallas de acceso: la mitad izquierda con el
 * degradado, las formas flotantes, el titular y la lista de puntos.
 *
 * Vivia COPIADO dentro del login, y el registro tenia otra estructura
 * distinta -cabecera fina y columna de texto plano-, asi que las dos puertas
 * del producto parecian de productos diferentes. Al extraerlo, login y
 * registro comparten la misma concha y solo cambia el mensaje: el login
 * recibe a quien vuelve, el registro convence a quien llega.
 *
 * Se oculta en movil (hidden lg:flex): en pantalla chica el formulario es lo
 * unico que importa, y este panel entero seria un scroll de adorno antes de
 * poder escribir.
 */
const PanelMarca = ({ marca = 'FletePro', titulo, descripcion, puntos = [] }) => (
  <div
    className="hidden lg:flex relative flex-1 flex-col justify-between p-12 text-white overflow-hidden"
    style={{
      backgroundImage:
        'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, color-mix(in srgb, var(--brand-color) 35%, #1e293b) 100%)',
    }}
  >
    {/* Trama de puntos */}
    <div
      aria-hidden
      className="absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    />
    {/* Resplandores */}
    <div
      aria-hidden
      className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-30 float-animation"
      style={{ background: 'var(--brand-color)' }}
    />
    <div
      aria-hidden
      className="absolute -bottom-40 -left-20 w-[420px] h-[420px] rounded-full blur-3xl opacity-20 float-rotate"
      style={{ background: 'var(--brand-color)' }}
    />
    {/* Formas y particulas */}
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      <div
        className="absolute top-[18%] right-[14%] w-32 h-32 rounded-3xl border border-white/10 slow-spin"
        style={{ backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 100%)' }}
      />
      <div
        className="absolute top-[55%] right-[8%] w-20 h-20 rounded-full border border-white/10 slow-spin-reverse"
        style={{ backgroundImage: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-color) 18%, transparent) 0%, transparent 100%)' }}
      />
      <div
        className="absolute bottom-[22%] right-[28%] w-14 h-14 rounded-xl border border-white/15 float-rotate"
        style={{ backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 100%)' }}
      />
      <div className="absolute top-[30%] left-[10%] w-1.5 h-1.5 rounded-full bg-white/40 float-animation" />
      <div className="absolute top-[60%] left-[18%] w-1 h-1 rounded-full bg-white/30 float-animation" style={{ animationDelay: '1.2s' }} />
      <div className="absolute top-[75%] left-[40%] w-2 h-2 rounded-full bg-white/25 float-animation" style={{ animationDelay: '2.4s' }} />
      <div className="absolute top-[20%] left-[55%] w-1 h-1 rounded-full bg-white/35 float-animation" style={{ animationDelay: '0.6s' }} />
    </div>

    {/* Marca, que vuelve al inicio */}
    <div className="relative z-10 logo-appear">
      <a href="/" className="flex items-center gap-3 group">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center icon-3d glow-brand-soft transition-transform"
          style={{ backgroundColor: 'var(--brand-color)' }}
        >
          <Truck className="w-7 h-7 text-white" />
        </div>
        <span className="font-heading text-xl font-black tracking-tight uppercase">{marca}</span>
      </a>
    </div>

    {/* Titular y puntos */}
    <div className="relative z-10 max-w-lg login-card-enter">
      <h2 className="font-heading text-5xl xl:text-6xl font-black tracking-tight leading-[1.05] uppercase">
        {titulo}
      </h2>
      {descripcion && (
        <p className="mt-6 text-slate-300 text-lg leading-relaxed">{descripcion}</p>
      )}
      {puntos.length > 0 && (
        <ul className="mt-8 space-y-3">
          {puntos.map((punto) => (
            <li key={punto} className="flex items-center gap-3 text-slate-200">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--brand-color)' }} />
              <span className="text-sm">{punto}</span>
            </li>
          ))}
        </ul>
      )}
    </div>

    {/* Pie legal */}
    <div className="relative z-10 text-slate-400 text-xs">
      &copy; 2026 {marca} &mdash;{' '}
      <a href="/privacidad" className="underline underline-offset-4 hover:text-orange-500">Privacidad</a>{' '}
      &middot;{' '}
      <a href="/terminos" className="underline underline-offset-4 hover:text-orange-500">T&eacute;rminos</a>
    </div>
  </div>
);

export default PanelMarca;
