import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
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
  const marca = tenant?.name || 'FletePro';
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
    <div className="min-h-screen flex bg-slate-50 smooth-appear">
      {/* LEFT — Brand / Illustration panel (hidden on mobile) */}
      <div
        className="hidden lg:flex relative flex-1 flex-col justify-between p-12 text-white overflow-hidden"
        style={{
          backgroundImage:
            'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, color-mix(in srgb, var(--brand-color) 35%, #1e293b) 100%)',
        }}
      >
        {/* Decorative pattern */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Glow accent */}
        <div
          aria-hidden
          className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-30 float-animation"
          style={{ background: 'var(--brand-color)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-20 w-[420px] h-[420px] rounded-full blur-3xl opacity-20 float-rotate"
          style={{ background: 'var(--brand-color)' }}
        />

        {/* Animated geometric shapes */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[18%] right-[14%] w-32 h-32 rounded-3xl border border-white/10 slow-spin"
            style={{
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
            }}
          />
          <div
            className="absolute top-[55%] right-[8%] w-20 h-20 rounded-full border border-white/10 slow-spin-reverse"
            style={{
              backgroundImage:
                'linear-gradient(135deg, color-mix(in srgb, var(--brand-color) 18%, transparent) 0%, transparent 100%)',
            }}
          />
          <div
            className="absolute bottom-[22%] right-[28%] w-14 h-14 rounded-xl border border-white/15 float-rotate"
            style={{
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 100%)',
            }}
          />
          {/* Particle dots */}
          <div className="absolute top-[30%] left-[10%] w-1.5 h-1.5 rounded-full bg-white/40 float-animation" />
          <div className="absolute top-[60%] left-[18%] w-1 h-1 rounded-full bg-white/30 float-animation" style={{ animationDelay: '1.2s' }} />
          <div className="absolute top-[75%] left-[40%] w-2 h-2 rounded-full bg-white/25 float-animation" style={{ animationDelay: '2.4s' }} />
          <div className="absolute top-[20%] left-[55%] w-1 h-1 rounded-full bg-white/35 float-animation" style={{ animationDelay: '0.6s' }} />
        </div>

        {/* Top: Brand mark */}
        <div className="relative z-10 logo-appear">
          <div className="flex items-center gap-3 group">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center icon-3d glow-brand-soft transition-transform"
              style={{ backgroundColor: 'var(--brand-color)' }}
            >
              <Truck className="w-7 h-7 text-white" />
            </div>
            <span className="font-heading text-xl font-black tracking-tight uppercase">
              {marca}
            </span>
          </div>
        </div>

        {/* Middle: Headline */}
        <div className="relative z-10 max-w-lg login-card-enter">
          <h2 className="font-heading text-5xl xl:text-6xl font-black tracking-tight leading-[1.05] uppercase">
            Tu flota,<br />
            <span className="gradient-text">bajo control.</span>
          </h2>
          <p className="mt-6 text-slate-300 text-lg leading-relaxed">
            Gestiona vehículos, viajes, mantenimiento y documentación
            en una sola plataforma diseñada para empresas de transporte.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Control de combustible, llantas y mantenimiento',
              'Documentos SUNAT, MTC y vencimientos al día',
              'Liquidaciones y viáticos automatizados',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-slate-200">
                <CheckCircle2
                  className="w-5 h-5 flex-shrink-0"
                  style={{ color: 'var(--brand-color)' }}
                />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: Footer */}
        <div className="relative z-10 text-slate-400 text-xs">
          &copy; 2026 {marca} &mdash; by Star Insights IT
        </div>
      </div>

      {/* RIGHT — Form panel */}
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
            <h1 className="font-heading text-3xl font-black text-slate-900 tracking-tight uppercase">
              {marca}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Sistema de Gestión de Flota
            </p>
          </div>

          <Card className="glass-strong border border-white/60 shadow-2xl rounded-2xl login-card-enter">
            <CardHeader className="pb-4 space-y-2">
              <CardTitle className="font-heading text-2xl font-bold tracking-tight text-slate-900">
                Bienvenido de nuevo
              </CardTitle>
              <CardDescription className="text-slate-500">
                Selecciona tu tipo de usuario para continuar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="admin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100 rounded-lg p-1 h-11">
                  <TabsTrigger
                    value="admin"
                    className="rounded-md data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm font-semibold text-sm transition-all"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Admin
                  </TabsTrigger>
                  <TabsTrigger
                    value="driver"
                    className="rounded-md data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm font-semibold text-sm transition-all"
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Chofer
                  </TabsTrigger>
                </TabsList>

                {/* Admin Login */}
                <TabsContent value="admin">
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="admin-email" className="text-xs font-semibold text-slate-700">
                        Correo Electrónico
                      </Label>
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="admin@empresa.com"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        required
                        className="rounded-md border-slate-300 h-11 input-focus-ring transition-all duration-200"
                        data-testid="admin-email-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="admin-password" className="text-xs font-semibold text-slate-700">
                        Contraseña
                      </Label>
                      <Input
                        id="admin-password"
                        type="password"
                        placeholder="••••••••"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required
                        className="rounded-md border-slate-300 h-11 input-focus-ring transition-all duration-200"
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
                  </form>
                </TabsContent>

                {/* Driver Login */}
                <TabsContent value="driver">
                  <form onSubmit={handleDriverLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="driver-dni" className="text-xs font-semibold text-slate-700">
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
                        className="rounded-md border-slate-300 h-11 input-focus-ring transition-all duration-200 font-mono text-lg tracking-wider"
                        data-testid="driver-dni-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="driver-pin" className="text-xs font-semibold text-slate-700">
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
                        className="rounded-md border-slate-300 h-11 input-focus-ring transition-all duration-200 font-mono text-lg tracking-[0.4em] text-center"
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

          {/* Mobile footer */}
          <p className="lg:hidden text-center text-slate-400 text-xs mt-6">
            &copy; 2026 {marca} &mdash; by Star Insights IT
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
