import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, ArrowRight, Loader2, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Alta de una transportista nueva.
 *
 * El backend crea empresa y usuario dueno en una transaccion y devuelve el
 * token, asi que al terminar se entra directo al sistema recien creado sin
 * volver a escribir la contrasena que se acaba de elegir.
 *
 * Las validaciones repiten las del backend a proposito: el servidor es quien
 * manda -esto es una comodidad, no una defensa- pero avisar antes de la vuelta
 * al servidor evita que alguien descubra que su RUC no tenia 11 digitos
 * despues de haber llenado seis campos.
 */

// Fuera del componente: definido dentro, React lo trataria como un tipo nuevo
// en cada render y remontaria los inputs, que pierden el foco a cada tecla.
const Campo = ({ etiqueta, campo, valor, onChange, tipo = 'text', placeholder, ...resto }) => (
  <div>
    <label htmlFor={campo} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
      {etiqueta}
    </label>
    <input
      id={campo}
      type={tipo}
      value={valor}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-orange-500/60 focus:bg-white/[0.07]"
      {...resto}
    />
  </div>
);

const SignupPage = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [datos, setDatos] = useState({
    company_name: '', ruc: '', name: '', email: '', password: '', phone: '',
  });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const set = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  const validar = () => {
    if (datos.company_name.trim().length < 2) return 'Falta el nombre de la empresa';
    if (datos.ruc.replace(/\D/g, '').length !== 11) return 'El RUC debe tener 11 dígitos';
    if (datos.name.trim().length < 2) return 'Falta tu nombre';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email.trim())) return 'El correo no es válido';
    if (datos.password.length < 8) return 'La contraseña necesita al menos 8 caracteres';
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
    const r = await signup({ ...datos, ruc: datos.ruc.replace(/\D/g, '') });
    setEnviando(false);
    if (r.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setError(r.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      <header className="border-b border-white/5">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500">
              <Truck className="h-5 w-5 text-white" />
            </span>
            <span className="font-heading text-lg font-black uppercase tracking-tight">FlotaPro</span>
          </Link>
          <Link to="/login" className="text-sm text-slate-300 transition hover:text-white">
            Ya tengo cuenta
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-14 px-6 py-14 lg:grid-cols-[1fr_460px] lg:py-20">
        {/* Lo que se lleva, para que el formulario no sea un salto al vacio */}
        <div className="hidden lg:block">
          <h1 className="font-heading text-4xl font-black leading-tight tracking-tight">
            14 días para probarlo
            <span className="block text-slate-500">con tu flota de verdad.</span>
          </h1>
          <p className="mt-6 max-w-md leading-relaxed text-slate-400">
            Sin tarjeta y sin compromiso. Cargas tus unidades y tus choferes, y
            si no te sirve, no pagas nada.
          </p>
          <ul className="mt-9 space-y-4">
            {[
              'Todos los módulos durante la prueba',
              'Tus datos, aislados del resto de empresas',
              'App del chofer con modo sin señal',
              'Al terminar eliges plan: desde S/ 0',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-slate-300">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          <h2 className="font-heading text-2xl font-black tracking-tight">Crea tu cuenta</h2>
          <p className="mt-1 text-sm text-slate-400">Empiezas con 14 días de prueba.</p>

          <form onSubmit={enviar} className="mt-7 space-y-5" noValidate>
            <Campo etiqueta="Empresa" campo="company_name" valor={datos.company_name}
                   onChange={set('company_name')} placeholder="Transportes del Sur S.A.C."
                   autoComplete="organization" />
            <Campo etiqueta="RUC" campo="ruc" valor={datos.ruc} onChange={set('ruc')}
                   placeholder="20123456789" inputMode="numeric" maxLength={11} />
            <Campo etiqueta="Tu nombre" campo="name" valor={datos.name} onChange={set('name')}
                   placeholder="Ana Quispe" autoComplete="name" />
            <Campo etiqueta="Correo" campo="email" tipo="email" valor={datos.email}
                   onChange={set('email')} placeholder="ana@transportes.pe" autoComplete="email" />
            <Campo etiqueta="Contraseña" campo="password" tipo="password" valor={datos.password}
                   onChange={set('password')} placeholder="Mínimo 8 caracteres"
                   autoComplete="new-password" />
            <Campo etiqueta="Teléfono (opcional)" campo="phone" valor={datos.phone}
                   onChange={set('phone')} placeholder="+51 987 654 321" autoComplete="tel" />

            {error && (
              <p role="alert"
                 className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3.5 font-bold text-white transition hover:bg-orange-400 disabled:opacity-60"
            >
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
              {enviando ? 'Creando tu cuenta...' : 'Empezar gratis'}
              {!enviando && <ArrowRight className="h-4 w-4" />}
            </button>

            <p className="text-center text-xs text-slate-500">
              Sin tarjeta. Puedes dejarlo cuando quieras.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
};

export default SignupPage;
