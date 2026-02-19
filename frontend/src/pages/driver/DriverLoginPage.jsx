import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Truck, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const DriverLoginPage = () => {
  const navigate = useNavigate();
  const { loginDriver } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dni, setDni] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dni || !pin) {
      toast.error('Ingrese DNI y PIN');
      return;
    }

    setLoading(true);
    try {
      await loginDriver(dni, pin);
      toast.success('¡Bienvenido!');
      navigate('/driver');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'DNI o PIN incorrecto');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4">
      {/* Back to admin login */}
      <Button
        variant="ghost"
        className="absolute top-4 left-4 text-white"
        onClick={() => navigate('/login')}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Admin
      </Button>

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Truck className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">TransportePeru</h1>
        <p className="text-slate-400 text-sm">App del Chofer</p>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-sm bg-white/95 backdrop-blur shadow-2xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl font-bold text-slate-900">
            Iniciar Sesión
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-700">DNI</Label>
              <Input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                placeholder="12345678"
                className="text-center text-lg font-mono h-12"
                data-testid="driver-dni-input"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="text-center text-2xl tracking-widest h-12"
                data-testid="driver-pin-input"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg"
              disabled={loading || dni.length !== 8 || pin.length !== 6}
              data-testid="driver-login-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'INGRESAR'
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-4">
            Contacte a su supervisor si olvidó su PIN
          </p>
        </CardContent>
      </Card>

      {/* Version */}
      <p className="text-slate-500 text-xs mt-8">v1.5.0 • Chofer App</p>
    </div>
  );
};

export default DriverLoginPage;
