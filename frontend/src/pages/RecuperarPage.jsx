import React, { useState } from 'react';
import IconoCamion from '../components/IconoCamion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, MailCheck, AlertCircle } from 'lucide-react';

/**
 * Las dos pantallas de recuperar el acceso, en un solo archivo porque son las
 * dos mitades de lo mismo: pedir el enlace y canjearlo.
 *
 * Son publicas a proposito -se usan justamente cuando no se puede entrar- y no
 * llevan nada del sistema dentro: ni menu, ni datos, ni nada que suponga una
 * sesion.
 */

const Marco = ({ children }) => (
  <div className="min-h-screen bg-grafito-950 text-grafito-100 flex items-center justify-center p-6">
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-marca-500">
          <IconoCamion className="h-6 w-6 text-white" />
        </span>
        <span className="font-heading text-2xl font-black uppercase tracking-tight">CargoXprez</span>
      </div>
      <div className="rounded-2xl border border-white/10 bg-grafito-900/60 p-6">{children}</div>
      <p className="mt-6 text-center text-sm text-grafito-400">
        <Link to="/login" className="hover:text-grafito-200 underline underline-offset-4">
          Volver al acceso
        </Link>
      </p>
    </div>
  </div>
);

/** Paso 1: pedir el enlace. */
export const OlvidePage = () => {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await authApi.olvide(email);
    } catch {
      // Da igual lo que responda: el backend contesta lo mismo exista o no la
      // cuenta, y distinguirlo aqui delataria quien esta registrado. Un fallo
      // de red tampoco cambia lo que se le puede contar al usuario.
    }
    setEnviando(false);
    setEnviado(true);
  };

  if (enviado) {
    return (
      <Marco>
        <div className="text-center">
          <MailCheck className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
          <h1 className="font-heading text-xl font-bold">Revisa tu correo</h1>
          <p className="mt-2 text-sm text-grafito-400">
            Si <strong className="text-grafito-200">{email}</strong> tiene una cuenta, le
            enviamos un enlace para crear una contraseña nueva. Caduca en 30 minutos.
          </p>
          <p className="mt-3 text-xs text-grafito-500">
            Mira también en spam. Si no llega, tu administrador puede cambiártela
            desde Usuarios.
          </p>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <h1 className="font-heading text-xl font-bold">¿Olvidaste tu contraseña?</h1>
      <p className="mt-2 text-sm text-grafito-400">
        Escribe tu correo y te mandamos un enlace para crear una nueva.
      </p>
      <form onSubmit={enviar} className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label className="text-grafito-300">Correo electrónico</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            className="bg-grafito-950/60 border-white/10"
          />
        </div>
        <Button type="submit" disabled={enviando || !email} className="w-full bg-marca-500 hover:bg-marca-600">
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enviar enlace
        </Button>
      </form>
      <p className="mt-4 text-xs text-grafito-500">
        Los choferes entran con DNI y PIN: si olvidaste el tuyo, pídeselo a tu
        empresa.
      </p>
    </Marco>
  );
};

/** Paso 2: elegir la contrasena nueva, con el codigo del enlace. */
export const RestablecerPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('t') || '';
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const corta = clave.length > 0 && clave.length < 8;
  const distintas = repetida.length > 0 && clave !== repetida;

  const guardar = async (e) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await authApi.restablecer(token, clave);
      // A /login y no directo al sistema: se acaba de cambiar la contrasena y
      // conviene que la escriba una vez, que es lo que evita salir de aqui
      // creyendo haberla cambiado cuando no.
      navigate('/login?restablecida=1', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cambiar la contraseña.');
    }
    setGuardando(false);
  };

  if (!token) {
    return (
      <Marco>
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-400" />
          <h1 className="font-heading text-xl font-bold">Enlace incompleto</h1>
          <p className="mt-2 text-sm text-grafito-400">
            Ábrelo tal cual llegó al correo, sin recortarlo.
          </p>
          <Link to="/olvide">
            <Button className="mt-5 w-full bg-marca-500 hover:bg-marca-600">
              Pedir uno nuevo
            </Button>
          </Link>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <h1 className="font-heading text-xl font-bold">Crea tu contraseña nueva</h1>
      <form onSubmit={guardar} className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label className="text-grafito-300">Nueva contraseña</Label>
          <Input
            type="password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="bg-grafito-950/60 border-white/10"
          />
          {corta && <p className="text-xs text-amber-400">Necesita al menos 8 caracteres.</p>}
        </div>
        <div className="space-y-2">
          <Label className="text-grafito-300">Repítela</Label>
          <Input
            type="password"
            required
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            className="bg-grafito-950/60 border-white/10"
          />
          {distintas && <p className="text-xs text-amber-400">No coinciden.</p>}
        </div>
        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={guardando || clave.length < 8 || clave !== repetida}
          className="w-full bg-marca-500 hover:bg-marca-600"
        >
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar y entrar
        </Button>
      </form>
    </Marco>
  );
};
