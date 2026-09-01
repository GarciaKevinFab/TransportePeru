import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ShieldAlert, Loader2 } from 'lucide-react';

/**
 * Cambio obligatorio de contrasena.
 *
 * Se muestra EN LUGAR del sistema -no como un aviso que se puede cerrar-
 * mientras el usuario tenga force_password_change. Esa bandera la pone el
 * backend cuando la clave la eligio otra persona: un reseteo desde Usuarios, o
 * el alta de un usuario nuevo.
 *
 * Por que en lugar de, y no encima: hasta que la cambie, esa contrasena la
 * conocen dos personas. Un aviso que se puede cerrar se cierra, y la clave
 * compartida se queda ahi para siempre. Es el unico sitio del sistema donde
 * vale la pena bloquear el paso.
 *
 * No hay boton de cancelar, pero si de cerrar sesion: quien no quiera cambiarla
 * ahora tiene que poder salir, no quedarse atrapado.
 */
const CambiarPasswordPage = () => {
  const { user, logout, refrescarUsuario } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const corta = nueva.length > 0 && nueva.length < 8;
  const distintas = repetida.length > 0 && nueva !== repetida;

  const guardar = async (e) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await authApi.cambiarPassword(actual, nueva);
      // Se relee el usuario para que force_password_change baje a false y esta
      // pantalla se quite sola. Sin esto habria que recargar a mano.
      await refrescarUsuario();
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cambiar la contraseña.');
    }
    setGuardando(false);
  };

  return (
    <div className="min-h-screen bg-grafito-950 text-grafito-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-amber-500/25 bg-grafito-900/60 p-6">
          <ShieldAlert className="mb-3 h-9 w-9 text-amber-400" />
          <h1 className="font-heading text-xl font-bold">Cambia tu contraseña</h1>
          <p className="mt-2 text-sm text-grafito-400">
            La que estás usando te la puso otra persona, así que la conocen dos.
            Elige una que solo sepas tú para continuar.
          </p>

          <form onSubmit={guardar} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-grafito-300">Contraseña actual</Label>
              <Input
                type="password"
                required
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                className="bg-grafito-950/60 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-grafito-300">Nueva contraseña</Label>
              <Input
                type="password"
                required
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
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
              disabled={guardando || !actual || nueva.length < 8 || nueva !== repetida}
              className="w-full bg-marca-500 hover:bg-marca-600"
            >
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar y continuar
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-grafito-500">
          Entraste como {user?.email || user?.name}.{' '}
          <button type="button" onClick={logout} className="underline underline-offset-4 hover:text-grafito-300">
            Cerrar sesión
          </button>
        </p>
      </div>
    </div>
  );
};

export default CambiarPasswordPage;
