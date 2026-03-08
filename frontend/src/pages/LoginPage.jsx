import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Truck, User, Lock, AlertCircle, Loader2, Shield } from 'lucide-react';
import { seedApi } from '../services/api';
import { toast } from 'sonner';

const LoginPage = () => {
  const { login, error } = useAuth();
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  // Admin form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  // Driver form state
  const [driverDni, setDriverDni] = useState('');
  const [driverPin, setDriverPin] = useState('');

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login({ email: adminEmail, password: adminPassword });
    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
    }
  };

  const handleDriverLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login({ dni: driverDni, pin: driverPin });
    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
    }
  };

  const handleBootstrap = async () => {
    setBootstrapping(true);
    try {
      const response = await seedApi.bootstrap();
      const creds = response.data.credentials;
      toast.success('Super Admin (Owner) creado exitosamente');
      toast.info(`Email: ${creds.email}`);
      toast.info(`Password: ${creds.password}`);
      setAdminEmail(creds.email);
      setAdminPassword(creds.password);
    } catch (err) {
      if (err.response?.data?.detail?.includes('Ya existe')) {
        toast.info('Ya existe un usuario Owner. Use sus credenciales para acceder.');
      } else {
        toast.error('Error al crear Super Admin');
      }
    }
    setBootstrapping(false);
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const response = await seedApi.seed();
      toast.success('Datos de demostración creados exitosamente');
      toast.info(`Admin: admin@transperu.com / admin123`);
      toast.info(`Chofer: DNI 12345678 / PIN 123456`);
    } catch (err) {
      if (err.response?.data?.message?.includes('already exists')) {
        toast.info('Los datos de demostración ya existen');
      } else {
        toast.error('Error al crear datos de demostración');
      }
    }
    setSeeding(false);
  };

  return (
    <div className="min-h-screen login-bg relative">
      <div className="login-overlay absolute inset-0" />
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-sm mb-4">
              <Truck className="w-10 h-10 text-white" />
            </div>
            <h1 className="font-heading text-4xl font-black text-white tracking-tight uppercase">
              G&E Transporta
            </h1>
            <p className="text-slate-400 mt-2">Sistema de Gestion de Flota</p>
          </div>

          {/* Login Card */}
          <Card className="bg-white/95 backdrop-blur border-0 shadow-2xl rounded-sm">
            <CardHeader className="pb-4">
              <CardTitle className="font-heading text-xl font-bold uppercase tracking-wide text-slate-900">
                Iniciar Sesión
              </CardTitle>
              <CardDescription>
                Selecciona tu tipo de usuario para continuar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="admin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100 rounded-sm">
                  <TabsTrigger 
                    value="admin" 
                    className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Admin
                  </TabsTrigger>
                  <TabsTrigger 
                    value="driver"
                    className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide"
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Chofer
                  </TabsTrigger>
                </TabsList>

                {/* Admin Login */}
                <TabsContent value="admin">
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-email" className="input-label">
                        Correo Electrónico
                      </Label>
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="admin@empresa.com"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        required
                        className="rounded-sm border-slate-300 focus:border-orange-500 focus:ring-orange-500"
                        data-testid="admin-email-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-password" className="input-label">
                        Contraseña
                      </Label>
                      <Input
                        id="admin-password"
                        type="password"
                        placeholder="••••••••"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required
                        className="rounded-sm border-slate-300 focus:border-orange-500 focus:ring-orange-500"
                        data-testid="admin-password-input"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full btn-action"
                      disabled={loading}
                      data-testid="admin-login-btn"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4 mr-2" />
                      )}
                      Ingresar
                    </Button>
                  </form>
                </TabsContent>

                {/* Driver Login */}
                <TabsContent value="driver">
                  <form onSubmit={handleDriverLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="driver-dni" className="input-label">
                        DNI
                      </Label>
                      <Input
                        id="driver-dni"
                        type="text"
                        placeholder="12345678"
                        value={driverDni}
                        onChange={(e) => setDriverDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        required
                        maxLength={8}
                        className="rounded-sm border-slate-300 focus:border-orange-500 focus:ring-orange-500 font-mono text-lg tracking-wider"
                        data-testid="driver-dni-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driver-pin" className="input-label">
                        PIN (6 dígitos)
                      </Label>
                      <Input
                        id="driver-pin"
                        type="password"
                        placeholder="••••••"
                        value={driverPin}
                        onChange={(e) => setDriverPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                        maxLength={6}
                        className="rounded-sm border-slate-300 focus:border-orange-500 focus:ring-orange-500 font-mono text-lg tracking-wider text-center"
                        data-testid="driver-pin-input"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full btn-action"
                      disabled={loading}
                      data-testid="driver-login-btn"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Truck className="w-4 h-4 mr-2" />
                      )}
                      Ingresar
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Setup Buttons */}
              <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
                <Button
                  type="button"
                  variant="default"
                  className="w-full rounded-sm text-xs uppercase tracking-wide bg-orange-500 hover:bg-orange-600"
                  onClick={handleBootstrap}
                  disabled={bootstrapping}
                  data-testid="bootstrap-btn"
                >
                  {bootstrapping ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4 mr-2" />
                  )}
                  Crear Super Admin (Owner)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-sm text-xs uppercase tracking-wide"
                  onClick={handleSeedData}
                  disabled={seeding}
                  data-testid="seed-data-btn"
                >
                  {seeding ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Crear Datos de Demostración
                </Button>
                <p className="text-xs text-slate-500 text-center mt-2">
                  Super Admin gestiona empresas. Demo crea datos de prueba.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-slate-400 text-sm mt-6">
            © 2026 G&E Transporta S.A.C. — by Star Insights IT
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
