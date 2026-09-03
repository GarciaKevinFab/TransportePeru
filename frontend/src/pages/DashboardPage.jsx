import React, { useState, useEffect, useCallback } from 'react';
import { dashboardApi, alertsApi, tripsApi } from '../services/api';
import PanelGraficas from '../components/PanelGraficas';
import TarjetaMetrica from '../components/TarjetaMetrica';
import EncabezadoPagina from '../components/EncabezadoPagina';
import { EsqueletoPanel } from '../components/Esqueletos';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Truck,
  Users,
  Route,
  AlertTriangle,
  FileText,
  Wrench,
  Clock,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Fuel,
  Calendar,
  DollarSign,
  Package,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [recentActivity, setRecentActivity] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [driverTrips, setDriverTrips] = useState([]);

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  const isOperaciones = user?.role === 'operaciones';
  const isFlota = user?.role === 'flota';
  const isMantenimiento = user?.role === 'mantenimiento';
  const isContabilidad = user?.role === 'contabilidad';
  const isAlmacen = user?.role === 'almacen';
  const isChofer = user?.role === 'chofer';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (isChofer) {
        // Driver-specific data
        const tripsRes = await tripsApi.getAll({ driver_id: user.id });
        setDriverTrips(tripsRes.data);
      } else {
        // Admin/Staff data
        const [kpisRes, activityRes, alertsRes] = await Promise.all([
          dashboardApi.getKPIs(),
          dashboardApi.getRecentActivity(),
          alertsApi.getAll({ resolved: false }),
        ]);
        setKpis(kpisRes.data);
        setRecentActivity(activityRes.data);
        setAlerts(alertsRes.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setLoading(false);
  }, [isChofer, user]);

  // La sesion ya esta resuelta cuando esta pagina se monta (ProtectedRoute
  // espera a que AuthContext termine de cargar), asi que `user` -y con el
  // isChofer y la identidad de fetchData- no cambia mientras la pagina vive:
  // esto sigue siendo una sola carga al montar, como con el array vacio.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* La tarjeta de metrica es una para toda la aplicacion (TarjetaMetrica).
     Aqui solo se decide el TONO, que dice que significa el numero: rojo es
     peligro y nada mas, ambar lo que va a vencer, verde lo que va bien,
     grafito un conteo sin juicio. La marca vive en la navegacion y los
     botones; en una tarjeta la volveria indistinguible de una alarma. */
  const KPICard = ({ title, value, subtitle, icon, trend, tono = 'neutro', onClick, stagger = 1 }) => (
    <TarjetaMetrica
      titulo={title}
      valor={value}
      detalle={subtitle}
      icono={icon}
      tono={tono}
      onClick={onClick}
      tendencia={trend}
      className={`card-enter card-stagger-${Math.min(stagger, 8)}`}
      data-testid={`kpi-${title?.toLowerCase?.().replace(/\s+/g, '-')}`}
    />
  );

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'warning';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'en_curso': return 'bg-grafito-200 text-grafito-800';
      case 'completado': return 'bg-green-100 text-green-800';
      case 'programado': return 'bg-yellow-100 text-yellow-800';
      case 'cancelado': return 'bg-red-100 text-red-800';
      default: return 'bg-grafito-100 text-grafito-800';
    }
  };

  if (loading) {
    return <EsqueletoPanel />;
  }

  // ============== DRIVER DASHBOARD ==============
  if (isChofer) {
    const activeTrip = driverTrips.find(t => t.status === 'en_curso');
    const scheduledTrips = driverTrips.filter(t => t.status === 'programado');
    const completedTrips = driverTrips.filter(t => t.status === 'completado');

    return (
      <div className="space-y-6 page-fade-in" data-testid="dashboard-page">
        <EncabezadoPagina
          titulo={<>Hola, {user?.name?.split(' ')[0]}</>}
          subtitulo={format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          acciones={(
            <Button variant="outline" onClick={fetchData} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </Button>
          )}
        />

        {/* Active Trip Banner */}
        {activeTrip && (
          <Card className="border-0 bg-grafito-900 text-white">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color) 22%, transparent)', color: 'var(--brand-color)' }}
                  >
                    <Route className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-grafito-300 text-sm font-bold uppercase tracking-wider">Viaje Activo</p>
                    <p className="font-heading text-2xl font-bold">{activeTrip.client_name || 'Sin cliente'}</p>
                    <p className="text-grafito-300">{activeTrip.cargo_description || 'Sin descripción'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white"
                    onClick={() => navigate('/driver/checklist')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ver Checklist
                  </Button>
                  <Button
                    className="bg-marca-500 hover:bg-marca-600 text-white"
                    onClick={() => navigate('/driver/fuel')}
                  >
                    <Fuel className="w-4 h-4 mr-2" />
                    Cargar Combustible
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Driver KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 section-enter section-stagger-1">
          <KPICard
            title="Viajes Completados"
            value={completedTrips.length}
            subtitle="este mes"
            icon={CheckCircle}
            tono="ok"
            stagger={1}
          />
          <KPICard
            title="Viajes Programados"
            value={scheduledTrips.length}
            subtitle="próximos"
            icon={Calendar}
            tono="neutro"
            stagger={2}
          />
          <KPICard
            title="Viaje Activo"
            value={activeTrip ? 'Si' : 'No'}
            subtitle={activeTrip?.client_name || '-'}
            icon={Route}
            tono="neutro"
            stagger={3}
          />
        </div>

        {/* Scheduled Trips */}
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
              Mis Próximos Viajes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduledTrips.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-grafito-400">
                <Calendar className="w-12 h-12 mb-2" />
                <p>No tienes viajes programados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledTrips.slice(0, 5).map((trip) => (
                  <div
                    key={trip.id}
                    className="flex items-center gap-3 p-4 bg-grafito-50 rounded-sm hover:bg-grafito-100 transition-colors"
                  >
                    <div className="w-12 h-12 bg-marca-100 rounded-full flex items-center justify-center">
                      <Truck className="w-6 h-6 text-marca-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-grafito-800">{trip.client_name || 'Sin cliente'}</p>
                      <p className="text-sm text-grafito-500">{trip.cargo_description}</p>
                      <div className="flex items-center gap-2 text-xs text-grafito-400 mt-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(trip.scheduled_date), "dd/MM/yyyy HH:mm", { locale: es })}
                      </div>
                    </div>
                    <Badge className={getStatusColor(trip.status)}>
                      {trip.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions for Driver */}
        <Card className="bg-grafito-900 text-white section-enter section-stagger-3">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-heading text-xl font-bold uppercase tracking-wide">
                  Acciones Rapidas
                </h3>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="btn-action btn-press touch-target"
                  onClick={() => navigate('/driver/checklist')}
                  data-testid="quick-checklist-btn"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Checklist
                </Button>
                <Button
                  variant="outline"
                  className="bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white btn-press touch-target transition-colors duration-200"
                  onClick={() => navigate('/driver/fuel')}
                >
                  <Fuel className="w-4 h-4 mr-2" />
                  Combustible
                </Button>
                <Button
                  variant="outline"
                  className="bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white btn-press touch-target transition-colors duration-200"
                  onClick={() => navigate('/driver/issues')}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Reportar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============== ADMIN/STAFF DASHBOARD ==============
  return (
    <div className="space-y-6 page-fade-in" data-testid="dashboard-page">
      {/* Hero Section */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white smooth-appear"
        style={{
          // El logotipo es 40% negro y solo 5% rojo: el rojo es el ACENTO, no
          // el fondo. Con la mezcla al 35% que habia (heredada de cuando la
          // marca era naranja) el panel entero quedaba lavado de rojo y la
          // pantalla de inicio parecia una alarma. Al 16% el grafito manda y
          // el rojo se queda como brasa en la esquina, que es la proporcion
          // que tiene la marca.
          backgroundImage:
            'linear-gradient(135deg, #0b0908 0%, #191614 52%, #2a2725 78%, color-mix(in srgb, var(--brand-color) 14%, #221f1d) 100%)',
        }}
      >
        {/* Decorative shapes */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-16 -right-10 w-72 h-72 rounded-full blur-3xl opacity-30 float-animation"
            style={{ background: 'var(--brand-color)' }}
          />
          <div
            className="absolute -bottom-20 left-20 w-60 h-60 rounded-full blur-3xl opacity-20 float-rotate"
            style={{ background: 'var(--brand-color)' }}
          />
          <div className="absolute top-6 right-8 w-20 h-20 rounded-2xl border border-white/10 slow-spin hidden sm:block" />
          <div className="absolute bottom-6 right-32 w-12 h-12 rounded-full border border-white/15 slow-spin-reverse hidden sm:block" />
          {/* Dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-grafito-300/80">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
            </p>
            <h1 className="font-heading text-3xl sm:text-4xl font-black uppercase tracking-tight mt-1">
              Hola, <span className="gradient-text">{user?.name?.split(' ')[0] || 'Equipo'}</span>
            </h1>
            <p className="text-grafito-300 mt-2 max-w-xl text-sm sm:text-base">
              {isAdmin ? 'Vista general de tu operación: flota, viajes, alertas y vencimientos.' :
               isOperaciones ? 'Gestiona las operaciones y viajes del día.' :
               isFlota ? 'Controla el estado de tu flota y documentación.' :
               isMantenimiento ? 'Coordina órdenes de trabajo y mantenimiento.' :
               isContabilidad ? 'Revisa liquidaciones, viáticos y facturación.' :
               isAlmacen ? 'Gestiona inventario y consumos.' :
               'Panel de control de tu operación.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl glass-dark-strong">
              <Truck className="w-5 h-5" style={{ color: 'var(--brand-color)' }} />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-grafito-400 font-semibold">Flota</p>
                <p className="font-heading font-bold text-lg leading-none">{kpis?.vehicles?.total || 0}</p>
              </div>
            </div>
            <Button
              onClick={fetchData}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md tap-scale btn-shine rounded-lg gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Primary KPIs - Role-based */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 section-enter section-stagger-1">
        {/* Admin/Owner sees everything */}
        {(isAdmin || isFlota) && (
          <KPICard
            title="Vehículos Disponibles"
            value={kpis?.vehicles?.available || 0}
            subtitle={`de ${kpis?.vehicles?.total || 0} totales`}
            icon={Truck}
            tono="marca"
            onClick={() => navigate('/vehicles')}
            stagger={1}
          />
        )}

        {(isAdmin || isOperaciones) && (
          <KPICard
            title="Viajes Activos"
            value={kpis?.trips?.active || 0}
            subtitle={`${kpis?.trips?.completed || 0} completados`}
            icon={Route}
            tono="neutro"
            onClick={() => navigate('/trips')}
            stagger={2}
          />
        )}

        {(isAdmin || isOperaciones || isFlota) && (
          <KPICard
            title="Alertas Activas"
            value={kpis?.alerts?.total || 0}
            subtitle={`${kpis?.alerts?.critical || 0} críticas`}
            icon={AlertTriangle}
            tono="alerta"
            stagger={3}
          />
        )}

        {(isAdmin || isFlota) && (
          <KPICard
            title="Documentos por Vencer"
            value={kpis?.documents?.expiring || 0}
            subtitle="próximos 30 días"
            icon={FileText}
            tono="aviso"
            onClick={() => navigate('/documents')}
            stagger={4}
          />
        )}

        {(isMantenimiento) && (
          <>
            <KPICard
              title="OT Abiertas"
              value={kpis?.maintenance?.open_orders || 0}
              subtitle="ordenes de trabajo"
              icon={Wrench}
              tono="neutro"
              onClick={() => navigate('/maintenance')}
              stagger={1}
            />
            <KPICard
              title="Vehículos en Mant."
              value={kpis?.vehicles?.in_maintenance || 0}
              subtitle="en taller"
              icon={Truck}
              tono="aviso"
              onClick={() => navigate('/vehicles?status=en_mantenimiento')}
              stagger={2}
            />
            <KPICard
              title="OT Críticas"
              value={kpis?.maintenance?.critical_orders || 0}
              subtitle="prioridad alta"
              icon={AlertTriangle}
              tono="alerta"
              stagger={3}
            />
          </>
        )}

        {(isContabilidad) && (
          <>
            <KPICard
              title="Liquidaciones Pend."
              value={kpis?.settlements?.pending || 0}
              subtitle="por revisar"
              icon={DollarSign}
              tono="neutro"
              onClick={() => navigate('/settlements')}
              stagger={1}
            />
            <KPICard
              title="Viajes Completados"
              value={kpis?.trips?.completed || 0}
              subtitle="este mes"
              icon={Route}
              tono="ok"
              stagger={2}
            />
          </>
        )}

        {(isAlmacen) && (
          <>
            <KPICard
              title="Items Bajo Stock"
              value={kpis?.inventory?.low_stock || 0}
              subtitle="requieren reposicion"
              icon={Package}
              tono="alerta"
              onClick={() => navigate('/inventory')}
              stagger={1}
            />
            <KPICard
              title="OT Pendientes"
              value={kpis?.maintenance?.open_orders || 0}
              subtitle="con consumo"
              icon={Wrench}
              tono="neutro"
              stagger={2}
            />
          </>
        )}
      </div>

      {/* Secondary KPIs */}
      {(isAdmin || isFlota) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 section-enter section-stagger-2">
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
                Disponibilidad de Flota
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="font-heading text-4xl font-bold text-grafito-900">
                  {kpis?.vehicles?.availability_rate || 0}%
                </span>
              </div>
              <div className="mt-4 h-2 bg-grafito-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${kpis?.vehicles?.availability_rate || 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-grafito-500 mt-2">
                <span>{kpis?.vehicles?.available || 0} disponibles</span>
                <span>{kpis?.vehicles?.in_trip || 0} en viaje</span>
                <span>{kpis?.vehicles?.in_maintenance || 0} en mant.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
                Choferes Registrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="font-heading text-4xl font-bold text-grafito-900">
                  {kpis?.drivers?.total || 0}
                </span>
                <Users className="w-6 h-6 text-grafito-400 mb-2" />
              </div>
              <Button
                variant="link"
                className="p-0 h-auto mt-4 text-marca-600"
                onClick={() => navigate('/users?role=chofer')}
              >
                Ver todos los choferes
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
                Órdenes de Trabajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="font-heading text-4xl font-bold text-grafito-900">
                  {kpis?.maintenance?.open_orders || 0}
                </span>
                <Wrench className="w-6 h-6 text-grafito-400 mb-2" />
              </div>
              <p className="text-sm text-grafito-500 mt-2">órdenes abiertas</p>
              <Button
                variant="link"
                className="p-0 h-auto mt-2 text-marca-600"
                onClick={() => navigate('/maintenance')}
              >
                Ver mantenimiento
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tendencia. Va DESPUES de los contadores y antes de las listas: los
          numeros dicen como esta la flota hoy, esto dice hacia donde va, y las
          listas son el detalle. Solo para quien decide sobre la operacion; a un
          chofer no le sirve de nada. */}
      {(isAdmin || isOperaciones || isFlota) && (
        <div className="section-enter section-stagger-3">
          <PanelGraficas />
        </div>
      )}

      {/* Alerts and Activity - Role filtered */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 section-enter section-stagger-3">
        {/* Critical Alerts */}
        {(isAdmin || isOperaciones || isFlota || isMantenimiento) && (
          <Card className="bg-white rounded-xl border-grafito-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest flex items-center gap-2">
                Alertas Recientes
                {alerts.some(a => a.severity === 'critical') && (
                  <span className="pulse-alert inline-block w-2 h-2 rounded-full bg-red-500" />
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/alerts')}>
                Ver todas
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-grafito-400">
                    <CheckCircle className="w-12 h-12 mb-2" />
                    <p className="text-sm">No hay alertas activas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.map((alert) => {
                      const sevColor =
                        alert.severity === 'critical' ? '#dc2626'
                        : alert.severity === 'warning' ? '#ca8a04'
                        : '#55514c';
                      const sevClass =
                        alert.severity === 'critical' ? 'severity-critical'
                        : alert.severity === 'warning' ? 'severity-warning'
                        : 'severity-info';
                      return (
                        <div
                          key={alert.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border border-grafito-200/70 bg-white hover:bg-grafito-50 hover:shadow-md transition-all duration-200 tap-scale ${sevClass}`}
                        >
                          <div
                            className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${sevColor} 12%, transparent)`,
                              color: sevColor,
                            }}
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-grafito-800 truncate">
                              {alert.message}
                            </p>
                            <p className="text-xs text-grafito-500 mt-1">
                              {format(new Date(alert.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                            </p>
                          </div>
                          <Badge
                            variant={getSeverityColor(alert.severity)}
                            className={alert.severity === 'critical' ? 'pulse-alert' : ''}
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Recent Trips */}
        {(isAdmin || isOperaciones || isContabilidad) && (
          <Card className="bg-white rounded-xl border-grafito-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
                Viajes Recientes
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/trips')}>
                Ver todos
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                {!recentActivity?.trips?.length ? (
                  <div className="flex flex-col items-center justify-center h-full text-grafito-400">
                    <Route className="w-12 h-12 mb-2" />
                    <p className="text-sm">No hay viajes recientes</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentActivity.trips.map((trip) => (
                      <div
                        key={trip.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-grafito-200/70 bg-white hover:bg-grafito-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer tap-scale"
                        onClick={() => navigate(`/trips/${trip.id}`)}
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--brand-color) 12%, transparent)',
                            color: 'var(--brand-color)',
                          }}
                        >
                          <Truck className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-grafito-800 truncate">
                            {trip.client_name || 'Sin cliente'}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-grafito-500 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {format(new Date(trip.scheduled_date), "dd/MM/yyyy", { locale: es })}
                          </div>
                        </div>
                        <Badge className={getStatusColor(trip.status)}>
                          {trip.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions - Role based */}
      <Card
        className="text-white section-enter section-stagger-4 relative overflow-hidden border-0"
        style={{
          backgroundImage:
            'linear-gradient(135deg, #191614 0%, #2a2725 62%, color-mix(in srgb, var(--brand-color) 15%, #262321) 100%)',
        }}
      >
        <div
          aria-hidden
          className="absolute -bottom-16 -right-10 w-72 h-72 rounded-full blur-3xl opacity-25 float-animation"
          style={{ background: 'var(--brand-color)' }}
        />
        <CardContent className="py-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-heading text-xl font-bold uppercase tracking-wide">
                Acciones Rápidas
              </h3>
              <p className="text-grafito-400 mt-1">
                Accede rápidamente a las funciones más utilizadas
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {(isAdmin || isOperaciones) && (
                <Button
                  className="btn-action btn-press touch-target"
                  onClick={() => navigate('/trips/new')}
                  data-testid="quick-new-trip-btn"
                >
                  <Route className="w-4 h-4 mr-2" />
                  Nuevo Viaje
                </Button>
              )}
              {(isAdmin || isFlota) && (
                <Button
                  variant="outline"
                  className="bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white btn-press touch-target transition-colors duration-200"
                  onClick={() => navigate('/vehicles/new')}
                  data-testid="quick-new-vehicle-btn"
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Nuevo Vehículo
                </Button>
              )}
              {(isAdmin || isMantenimiento) && (
                <Button
                  variant="outline"
                  className="bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white btn-press touch-target transition-colors duration-200"
                  onClick={() => navigate('/maintenance/new')}
                  data-testid="quick-new-ot-btn"
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Nueva OT
                </Button>
              )}
              {(isContabilidad) && (
                <Button
                  variant="outline"
                  className="bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white btn-press touch-target transition-colors duration-200"
                  onClick={() => navigate('/settlements')}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Liquidaciones
                </Button>
              )}
              {(isAlmacen) && (
                <Button
                  variant="outline"
                  className="bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white btn-press touch-target transition-colors duration-200"
                  onClick={() => navigate('/inventory')}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Inventario
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
