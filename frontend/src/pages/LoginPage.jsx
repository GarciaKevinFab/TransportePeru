import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import PanelMarca from '../components/PanelMarca';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Truck, User, Lock, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// El bootstrap del primer usuario (Super Admin) ahora se hace vía CLI/backend
// con X-Install-Token, no desde la UI de login (evita exponer credenciales).

const LoginPage = () => {
  const { login, error } = useAuth();
  // En <empresa>.sisac.pe, la pantalla de acceso lleva el nombre de esa
  // empresa; en el host de la marca y en local, el del producto. Estaba
  // escrito a mano como "G&E Transporta" desde que el sistema tenia un solo
  // cliente: a partir del segundo, eso es el nombre de otro en la puerta.
  const { tenant } = useTenant();
  const marca = tenant?.name || 'CargoXprez';
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex bg-slate-950 smooth-appear">
      {/* Panel de marca compartido con el registro: misma concha, distinto
          mensaje. Aqui se recibe a quien vuelve. */}
      <PanelMarca
        marca={marca}
        titulo={
          <>
            Tu flota,<br />
            <span className="gradient-text">bajo control.</span>
          </>
        }
        descripcion="Gestiona vehículos, viajes, mantenimiento y documentación en una sola plataforma diseñada para empresas de transporte."
        puntos={[
          'Control de combustible, llantas y mantenimiento',
          'Documentos SUNAT, MTC y vencimientos al día',
          'Liquidaciones y viáticos automatizados',
        ]}
      />

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="lg:hidden text-center mb-8 logo-appear">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-3 icon-3d glow-brand-soft"
              style={{ backgroundColor: 'var(--brand-color)' }}
            >
              <Truck className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-heading text-3xl font-black text-slate-100 tracking-tight uppercase">
              {marca}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Sistema de Gestión de Flota
            </p>
          </div>

          <Card className="border border-white/10 bg-slate-900/70 shadow-2xl shadow-black/50 rounded-2xl login-card-enter">
            <CardHeader className="pb-4 space-y-2">
              <CardTitle className="font-heading text-2xl font-bold tracking-tight text-slate-100">
                Bienvenido de nuevo
              </CardTitle>
              <CardDescription className="text-slate-400">
                Selecciona tu tipo de usuario para continuar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="admin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/5 border border-white/10 rounded-lg p-1 h-11">
                  <TabsTrigger
                    value="admin"
                    className="rounded-md data-[state=inactive]:text-slate-400 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm font-semibold text-sm transition-all"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Admin
                  </TabsTrigger>
                  <TabsTrigger
                    value="driver"
                    className="rounded-md data-[state=inactive]:text-slate-400 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm font-semibold text-sm transition-all"
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Chofer
                  </TabsTrigger>
                </TabsList>

                {/* Admin Login */}
                <TabsContent value="admin">
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="admin-email" className="text-xs font-semibold text-slate-300">
                        Correo Electrónico
                      </Label>
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="admin@empresa.com"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        required
                        className="rounded-md h-11 input-focus-ring transition-all duration-200 bg-slate-950/60 border-white/15 text-slate-100 placeholder:text-slate-500"
                        data-testid="admin-email-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="admin-password" className="text-xs font-semibold text-slate-300">
                        Contraseña
                      </Label>
                      <Input
                        id="admin-password"
                        type="password"
                        placeholder="••••••••"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required
                        className="rounded-md h-11 input-focus-ring transition-all duration-200 bg-slate-950/60 border-white/15 text-slate-100 placeholder:text-slate-500"
                        data-testid="admin-password-input"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full btn-action btn-press btn-shine tap-scale h-11 rounded-lg transition-all duration-200"
                      disabled={loading}
                      data-testid="admin-login-btn"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4 mr-2" />
                      )}
                      {loading ? 'Ingresando...' : 'Ingresar'}
                    </Button>
                    {/* Solo en la pestana de admin: el chofer entra con DNI y PIN, y
                        su reseteo lo hace su empresa desde Usuarios. */}
                    <p className="pt-1 text-center text-sm">
                      <a
                        href="/olvide"
                        className="text-slate-500 underline underline-offset-4 hover:text-marca-500"
                      >
                        ¿Olvidaste tu contraseña?
                      </a>
                    </p>
                  </form>
                </TabsContent>

                {/* Driver Login */}
                <TabsContent value="driver">
                  <form onSubmit={handleDriverLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="driver-dni" className="text-xs font-semibold text-slate-300">
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
                        className="rounded-md h-11 input-focus-ring transition-all duration-200 font-mono text-lg tracking-wider bg-slate-950/60 border-white/15 text-slate-100 placeholder:text-slate-500"
                        data-testid="driver-dni-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="driver-pin" className="text-xs font-semibold text-slate-300">
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
                        className="rounded-md h-11 input-focus-ring transition-all duration-200 font-mono text-lg tracking-[0.4em] text-center bg-slate-950/60 border-white/15 text-slate-100 placeholder:text-slate-500"
                        data-testid="driver-pin-input"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full btn-action btn-press btn-shine tap-scale h-11 rounded-lg transition-all duration-200"
                      disabled={loading}
                      data-testid="driver-login-btn"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Truck className="w-4 h-4 mr-2" />
                      )}
                      {loading ? 'Ingresando...' : 'Ingresar'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-sm text-slate-400">
            ¿Tu empresa aún no usa CargoXprez?{' '}
            <a
              href="/registro"
              className="font-semibold text-marca-500 underline underline-offset-4 hover:text-marca-400"
            >
              Crear cuenta gratis
            </a>
          </p>
          <p className="mt-2 text-center text-sm">
            <a href="/" className="text-slate-500 underline underline-offset-4 hover:text-slate-300">
              Volver al inicio
            </a>
          </p>

          {/* Mobile footer */}
          <p className="lg:hidden text-center text-slate-400 text-xs mt-6">
            &copy; 2026 {marca} &mdash;{' '}
            <a href="/privacidad" className="underline underline-offset-4 hover:text-marca-500">Privacidad</a>{' '}
            &middot;{' '}
            <a href="/terminos" className="underline underline-offset-4 hover:text-marca-500">Términos</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
