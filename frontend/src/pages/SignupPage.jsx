import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PanelMarca from '../components/PanelMarca';
import { Truck, ArrowRight, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen flex bg-slate-950 text-slate-100 antialiased smooth-appear">
      {/* La misma concha que el login: panel de marca a la izquierda, tarjeta a
          la derecha. Antes el registro tenia OTRA estructura -cabecera fina y
          columna de texto- y las dos puertas del producto parecian de productos
          distintos. Solo cambia el mensaje: aqui se convence a quien llega. */}
      <PanelMarca
        titulo={
          <>
            14 días para probarlo<br />
            <span className="gradient-text">con tu flota de verdad.</span>
          </>
        }
        descripcion="Sin tarjeta y sin compromiso. Cargas tus unidades y tus choferes, y si no te sirve, no pagas nada."
        puntos={[
          'Todos los módulos durante la prueba',
          'Tus datos, aislados del resto de empresas',
          'App del chofer con modo sin señal',
          'Al terminar eliges plan: desde S/ 0',
        ]}
      />

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Cabecera de marca en movil, identica a la del login */}
          <div className="lg:hidden text-center mb-8 logo-appear">
            <Link to="/" className="inline-flex flex-col items-center">
              <span
                className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-3 icon-3d glow-brand-soft"
                style={{ backgroundColor: 'var(--brand-color)' }}
              >
                <Truck className="w-8 h-8 text-white" />
              </span>
              <span className="font-heading text-3xl font-black text-slate-100 tracking-tight uppercase">
                FletePro
              </span>
            </Link>
            <p className="text-slate-400 text-sm mt-1">Sistema de Gestión de Flota</p>
          </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/50 login-card-enter">
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
              Sin tarjeta. Puedes dejarlo cuando quieras. Al crear la cuenta
              aceptas los{' '}
              <Link to="/terminos" className="text-slate-400 underline underline-offset-4 hover:text-orange-400">
                términos
              </Link>{' '}
              y la{' '}
              <Link to="/privacidad" className="text-slate-400 underline underline-offset-4 hover:text-orange-400">
                política de privacidad
              </Link>
              .
            </p>
          </form>
        </div>

          <p className="mt-6 text-center text-sm text-slate-400">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-semibold text-orange-500 underline underline-offset-4 hover:text-orange-400">
              Entrar
            </Link>
          </p>
          <p className="mt-2 text-center text-sm">
            <Link to="/" className="text-slate-500 underline underline-offset-4 hover:text-slate-300">
              Volver al inicio
            </Link>
          </p>

          <p className="lg:hidden text-center text-slate-400 text-xs mt-6">
            &copy; 2026 FletePro &mdash;{' '}
            <Link to="/privacidad" className="underline underline-offset-4 hover:text-orange-500">Privacidad</Link>{' '}
            &middot;{' '}
            <Link to="/terminos" className="underline underline-offset-4 hover:text-orange-500">Términos</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
