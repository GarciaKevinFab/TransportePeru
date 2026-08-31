import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setAuthToken, clearAuthToken } from '../services/api';
import { syncAllPending } from '../hooks/useOffline';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync the persisted token onto the shared `api` instance on mount.
  useEffect(() => {
    setAuthToken(localStorage.getItem('access_token'));
  }, []);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          setAuthToken(token);
          const response = await authApi.getMe();
          setUser(response.data);
        } catch (err) {
          console.error('Auth check failed:', err);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          clearAuthToken();
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      setError(null);
      const response = await authApi.login(credentials);
      const { access_token, refresh_token, user: userData, redirect_to } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      setAuthToken(access_token);

      // El backend manda a la casa del usuario cuando no es este origen: se
      // entro por fletepro.sisac.pe y la empresa vive en su propio subdominio.
      // Es un salto entre origenes de verdad, asi que no vale navigate() de
      // React Router: hay que soltar la pagina. Los tokens que se acaban de
      // guardar quedan en ESTE origen y no sirven alla - por eso el destino
      // lleva un codigo de un solo uso que /entrar canjea por una sesion
      // propia. Ver _destino_tras_entrar en el backend.
      if (redirect_to) {
        window.location.replace(redirect_to);
        return { success: true, user: userData, redirigiendo: true };
      }

      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.detail || 'Error al iniciar sesión';
      setError(message);
      throw err;
    }
  }, []);

  // El alta devuelve el mismo TokenResponse que el login, asi que deja la
  // sesion abierta: quien se registra entra directo a su sistema recien
  // creado, sin volver a escribir la contrasena que acaba de elegir.
  const signup = useCallback(async (datos) => {
    try {
      setError(null);
      const response = await authApi.signup(datos);
      const { access_token, refresh_token, user: userData } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      setAuthToken(access_token);

      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.detail || 'No se pudo crear la cuenta';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const loginDriver = useCallback(async (dni, pin) => {
    try {
      setError(null);
      const response = await authApi.login({ dni, pin });
      const { access_token, refresh_token, user: userData } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      setAuthToken(access_token);

      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.detail || 'DNI o PIN incorrecto';
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    clearAuthToken();
    setUser(null);
  }, []);

  // Auto-sync pending offline items on load and when coming back online
  useEffect(() => {
    if (navigator.onLine) {
      syncAllPending().catch((e) => console.error('Initial sync error:', e));
    }
    const onOnline = () => {
      syncAllPending().catch((e) => console.error('Online-event sync error:', e));
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // Token refresh on 401 is handled centrally by the `api` instance interceptor
  // in services/api.js (with an isRefreshing lock + queue). No axios-global
  // interceptor here to avoid double-refresh / race conditions.

  const value = {
    user,
    loading,
    error,
    login,
    signup,
    loginDriver,
    logout,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === 'superadmin',
    isAdmin: user?.role === 'admin' || user?.role === 'owner' || user?.role === 'superadmin',
    isDriver: user?.role === 'chofer',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
