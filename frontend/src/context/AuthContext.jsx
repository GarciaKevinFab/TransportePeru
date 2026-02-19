import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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

  // Configure axios defaults
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await axios.get(`${API_URL}/api/auth/me`);
          setUser(response.data);
        } catch (err) {
          console.error('Auth check failed:', err);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      setError(null);
      const response = await axios.post(`${API_URL}/api/auth/login`, credentials);
      const { access_token, refresh_token, user: userData } = response.data;
      
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.detail || 'Error al iniciar sesión';
      setError(message);
      throw err;
    }
  }, []);

  const loginDriver = useCallback(async (dni, pin) => {
    try {
      setError(null);
      const response = await axios.post(`${API_URL}/api/auth/login-driver`, { dni, pin });
      const { access_token, refresh_token, user: userData } = response.data;
      
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
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
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  }, []);

  const refreshToken = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return false;
    
    try {
      const response = await axios.post(`${API_URL}/api/auth/refresh`, {
        refresh_token: refresh
      });
      
      const { access_token, refresh_token: newRefresh } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', newRefresh);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      return true;
    } catch (err) {
      logout();
      return false;
    }
  }, [logout]);

  // Axios interceptor for token refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          const success = await refreshToken();
          if (success) {
            return axios(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [refreshToken]);

  const value = {
    user,
    loading,
    error,
    login,
    loginDriver,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'owner',
    isDriver: user?.role === 'chofer',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
