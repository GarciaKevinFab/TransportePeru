import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { setAuthToken } from '../services/api';

/**
 * Recoge la sesion que viene del host de la marca.
 *
 * Quien entra por fletepro.sisac.pe acaba aqui, en el dominio de SU empresa,
 * con un codigo de un solo uso en la URL. Hace falta este rodeo porque
 * localStorage es por origen: los tokens que guardo el login viven en el otro
 * dominio y aqui no existen. El codigo se canjea contra el backend, que
 * comprueba que este host sea el de la empresa a la que se emitio.
 *
 * La pantalla es deliberadamente sosa: en el mejor de los casos se ve menos de
 * un segundo. Lo unico que importa es que, si falla, diga que hacer.
 */
const EntrarPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  // El canje gasta el codigo, asi que no puede correr dos veces. En React 18
  // con StrictMode los efectos se montan dos veces en desarrollo, y sin este
  // guardia el segundo intento fallaria con "enlace ya usado" sobre un canje
  // que en realidad salio bien.
  const yaCanjeado = useRef(false);

  useEffect(() => {
    const codigo = params.get('c');
    if (!codigo) {
      setError('El enlace no trae codigo.');
      return;
    }
    if (yaCanjeado.current) return;
    yaCanjeado.current = true;

    api
      .post('/auth/canjear', { codigo })
      .then((res) => {
        localStorage.setItem('access_token', res.data.access_token);
        localStorage.setItem('refresh_token', res.data.refresh_token);
        setAuthToken(res.data.access_token);
        // replace: el enlace lleva el codigo, y ya esta gastado. Dejarlo en el
        // historial solo consigue que el boton de atras muestre un error.
        navigate('/dashboard', { replace: true });
      })
      .catch((e) => {
        setError(e.response?.data?.detail || 'No se pudo completar el acceso.');
      });
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
      <div className="text-center max-w-sm">
        {error ? (
          <>
            <p className="text-slate-900 dark:text-slate-100 font-semibold mb-2">
              No se pudo entrar
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-5">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="rounded-md bg-orange-500 px-4 py-2 text-white font-semibold hover:bg-orange-600"
            >
              Ir al acceso
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 mx-auto mb-4 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-600 dark:text-slate-400 text-sm">Entrando...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default EntrarPage;
