import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import IconoCamion from '../../components/IconoCamion';
import { PROVEEDOR } from '../../config/proveedor';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Acceso del chofer, pensado para el telefono.
 *
 * Antes era una tarjeta blanca generica con un boton salmon sobre el fondo
 * oscuro: no se parecia en nada a la puerta del administrador, y el chofer
 * -que entra desde un celular en la cabina- se encontraba campos de 48 px y
 * un boton apagado hasta que acertaba los 14 digitos.
 *
 * Ahora comparte el lenguaje del login del sistema (grafito oscuro con la
 * trama de puntos y los resplandores de PanelMarca, tarjeta oscura, titulo
 * en Barlow, boton de marca), con lo que el telefono pide: campos de 52 px,
 * teclado numerico, el boton siempre activo con su estado de carga, y el
 * error escrito debajo del campo, no en un aviso que desaparece.
 */
const DriverLoginPage = () => {
  const navigate = useNavigate();
  const { loginDriver } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dni, setDni] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dni.length !== 8) {
      setError('Ingresa tu DNI de 8 dígitos.');
      return;
    }
    if (pin.length !== 6) {
      setError('Ingresa tu PIN de 6 dígitos.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await loginDriver(dni, pin);
      toast.success('¡Bienvenido!');
      navigate('/driver');
    } catch (err) {
      setError(err.response?.data?.detail || 'DNI o PIN incorrecto');
      setLoading(false);
    }
  };

  const campo =
    'h-[52px] rounded-xl border-white/15 bg-grafito-950/60 text-center font-mono text-xl tracking-[0.25em] text-grafito-100 placeholder:tracking-normal placeholder:text-grafito-500 focus-visible:border-brand';

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-grafito-950 text-grafito-100">
      {/* La misma concha que PanelMarca: trama de puntos y dos resplandores
          en el color de marca, sin formas que compitan con el formulario en
          una pantalla chica. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full opacity-[0.16] blur-3xl float-animation"
        style={{ background: 'var(--brand-color)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 -left-24 h-72 w-72 rounded-full opacity-[0.10] blur-3xl float-rotate"
        style={{ background: 'var(--brand-color)' }}
      />

      <header className="safe-area-top relative z-10 flex items-center px-3 pt-3">
        <Link
          to="/login"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-grafito-300 transition-colors duration-150 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Admin
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-center px-4 pb-10 pt-4">
        <div className="mx-auto w-full max-w-sm">
          <div className="text-center logo-appear">
            <div
              className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl icon-3d glow-brand-soft"
              style={{ backgroundColor: 'var(--brand-color)' }}
            >
              <IconoCamion className="h-9 w-9 text-white" />
            </div>
            <h1 className="font-heading text-3xl font-black uppercase tracking-tight text-grafito-100">
              {PROVEEDOR.producto}
            </h1>
            <p className="mt-1 text-sm text-grafito-400">App del Chofer</p>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="login-card-enter mt-8 rounded-2xl border border-white/10 bg-grafito-900/70 p-5 shadow-2xl shadow-black/50 sm:p-6"
          >
            <h2 className="font-heading text-2xl font-bold tracking-tight text-grafito-100">
              Iniciar Sesión
            </h2>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="driver-dni" className="text-xs font-semibold uppercase tracking-wider text-grafito-300">
                  DNI
                </Label>
                <Input
                  id="driver-dni"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="username"
                  maxLength={8}
                  value={dni}
                  onChange={(e) => { setDni(e.target.value.replace(/\D/g, '')); if (error) setError(''); }}
                  placeholder="12345678"
                  aria-invalid={Boolean(error) || undefined}
                  className={campo}
                  data-testid="driver-dni-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver-pin" className="text-xs font-semibold uppercase tracking-wider text-grafito-300">
                  PIN
                </Label>
                <Input
                  id="driver-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="current-password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); if (error) setError(''); }}
                  placeholder="••••••"
                  aria-invalid={Boolean(error) || undefined}
                  aria-describedby={error ? 'driver-login-error' : undefined}
                  className={`${campo} tracking-[0.5em]`}
                  data-testid="driver-pin-input"
                />
              </div>

              {error && (
                <p
                  id="driver-login-error"
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="btn-brand h-[52px] w-full rounded-xl text-base font-bold uppercase tracking-wide"
                disabled={loading}
                aria-busy={loading || undefined}
                data-testid="driver-login-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  'Ingresar'
                )}
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-grafito-400">
              Contacte a su supervisor si olvidó su PIN
            </p>
          </form>

          <p className="mt-8 text-center text-xs text-grafito-500">v1.5.0 • Chofer App</p>
        </div>
      </main>
    </div>
  );
};

export default DriverLoginPage;
