import React, { useState, useEffect } from 'react';
import { dashboardApi, alertsApi, vehiclesApi, tripsApi } from '../services/api';
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
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  RefreshCw,
  Fuel,
  CircleDot,
  MapPin,
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

  const fetchData = async () => {
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
  };

  useEffect(() => {
    fetchData();
  }, []);

  const KPICard = ({ title, value, subtitle, icon: Icon, trend, color = 'orange', onClick }) => (
    <Card 
      className={`kpi-card card-hover transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`} 
      style={{ borderLeftColor: `var(--${color})` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="kpi-label">{title}</p>
          <p className="kpi-value">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-sm flex items-center justify-center bg-${color}-100`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-4">
          {trend >= 0 ? (
            <TrendingUp className="w-4 h-4 text-green-600" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-600" />
          )}
          <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Math.abs(trend)}%
          </span>
          <span className="text-sm text-slate-500">vs mes anterior</span>
        </div>
      )}
    </Card>
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
      case 'en_curso': return 'bg-blue-100 text-blue-800';
      case 'completado': return 'bg-green-100 text-green-800';
      case 'programado': return 'bg-yellow-100 text-yellow-800';
      case 'cancelado': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // ============== DRIVER DASHBOARD ==============
  if (isChofer) {
    const activeTrip = driverTrips.find(t => t.status === 'en_curso');
    const scheduledTrips = driverTrips.filter(t => t.status === 'programado');
    const completedTrips = driverTrips.filter(t => t.status === 'completado');

    return (
      <div className="space-y-6" data-testid="dashboard-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
              Hola, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-slate-500 mt-1">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <Button variant="outline" onClick={fetchData} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </Button>
        </div>

        {/* Active Trip Banner */}
        {activeTrip && (
          <Card className="bg-blue-600 text-white">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                    <Route className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm font-bold uppercase">Viaje Activo</p>
                    <p className="font-heading text-2xl font-bold">{activeTrip.client_name || 'Sin cliente'}</p>
                    <p className="text-blue-200">{activeTrip.cargo_description || 'Sin descripción'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="bg-white text-blue-600 hover:bg-blue-50"
                    onClick={() => navigate('/driver/checklist')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ver Checklist
                  </Button>
                  <Button 
                    className="bg-orange-500 hover:bg-orange-600 text-white"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            title="Viajes Completados"
            value={completedTrips.length}
            subtitle="este mes"
            icon={CheckCircle}
            color="green"
          />
          <KPICard
            title="Viajes Programados"
            value={scheduledTrips.length}
            subtitle="próximos"
            icon={Calendar}
            color="blue"
          />
          <KPICard
            title="Viaje Activo"
            value={activeTrip ? 'Sí' : 'No'}
            subtitle={activeTrip?.client_name || '-'}
            icon={Route}
            color="orange"
          />
        </div>

        {/* Scheduled Trips */}
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
              Mis Próximos Viajes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduledTrips.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <Calendar className="w-12 h-12 mb-2" />
                <p>No tienes viajes programados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledTrips.slice(0, 5).map((trip) => (
                  <div
                    key={trip.id}
                    className="flex items-center gap-3 p-4 bg-slate-50 rounded-sm hover:bg-slate-100 transition-colors"
                  >
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <Truck className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800">{trip.client_name || 'Sin cliente'}</p>
                      <p className="text-sm text-slate-500">{trip.cargo_description}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
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
        <Card className="bg-slate-900 text-white">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-heading text-xl font-bold uppercase tracking-wide">
                  Acciones Rápidas
                </h3>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="btn-action"
                  onClick={() => navigate('/driver/checklist')}
                  data-testid="quick-checklist-btn"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Checklist
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-600 text-white hover:bg-slate-800"
                  onClick={() => navigate('/driver/fuel')}
                >
                  <Fuel className="w-4 h-4 mr-2" />
                  Combustible
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-600 text-white hover:bg-slate-800"
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
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin ? 'Vista general del sistema' : 
             isOperaciones ? 'Gestión de operaciones y viajes' :
             isFlota ? 'Control de flota y vehículos' :
             isMantenimiento ? 'Gestión de mantenimiento' :
             isContabilidad ? 'Control financiero' :
             isAlmacen ? 'Gestión de inventario' :
             'Panel de control'}
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </Button>
      </div>

      {/* Primary KPIs - Role-based */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Admin/Owner sees everything */}
        {(isAdmin || isFlota) && (
          <KPICard
            title="Vehículos Disponibles"
            value={kpis?.vehicles?.available || 0}
            subtitle={`de ${kpis?.vehicles?.total || 0} totales`}
            icon={Truck}
            color="orange"
            onClick={() => navigate('/vehicles')}
          />
        )}
        
        {(isAdmin || isOperaciones) && (
          <KPICard
            title="Viajes Activos"
            value={kpis?.trips?.active || 0}
            subtitle={`${kpis?.trips?.completed || 0} completados`}
            icon={Route}
            color="blue"
            onClick={() => navigate('/trips')}
          />
        )}
        
        {(isAdmin || isOperaciones || isFlota) && (
          <KPICard
            title="Alertas Activas"
            value={kpis?.alerts?.total || 0}
            subtitle={`${kpis?.alerts?.critical || 0} críticas`}
            icon={AlertTriangle}
            color="red"
          />
        )}
        
        {(isAdmin || isFlota) && (
          <KPICard
            title="Documentos por Vencer"
            value={kpis?.documents?.expiring || 0}
            subtitle="próximos 30 días"
            icon={FileText}
            color="yellow"
            onClick={() => navigate('/documents')}
          />
        )}

        {(isMantenimiento) && (
          <>
            <KPICard
              title="OT Abiertas"
              value={kpis?.maintenance?.open_orders || 0}
              subtitle="órdenes de trabajo"
              icon={Wrench}
              color="orange"
              onClick={() => navigate('/maintenance')}
            />
            <KPICard
              title="Vehículos en Mant."
              value={kpis?.vehicles?.in_maintenance || 0}
              subtitle="en taller"
              icon={Truck}
              color="yellow"
              onClick={() => navigate('/vehicles?status=en_mantenimiento')}
            />
            <KPICard
              title="OT Críticas"
              value={kpis?.maintenance?.critical_orders || 0}
              subtitle="prioridad alta"
              icon={AlertTriangle}
              color="red"
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
              color="orange"
              onClick={() => navigate('/settlements')}
            />
            <KPICard
              title="Viajes Completados"
              value={kpis?.trips?.completed || 0}
              subtitle="este mes"
              icon={Route}
              color="green"
            />
          </>
        )}

        {(isAlmacen) && (
          <>
            <KPICard
              title="Items Bajo Stock"
              value={kpis?.inventory?.low_stock || 0}
              subtitle="requieren reposición"
              icon={Package}
              color="red"
              onClick={() => navigate('/inventory')}
            />
            <KPICard
              title="OT Pendientes"
              value={kpis?.maintenance?.open_orders || 0}
              subtitle="con consumo"
              icon={Wrench}
              color="orange"
            />
          </>
        )}
      </div>

      {/* Secondary KPIs */}
      {(isAdmin || isFlota) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Disponibilidad de Flota
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="font-heading text-4xl font-bold text-slate-900">
                  {kpis?.vehicles?.availability_rate || 0}%
                </span>
              </div>
              <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${kpis?.vehicles?.availability_rate || 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>{kpis?.vehicles?.available || 0} disponibles</span>
                <span>{kpis?.vehicles?.in_trip || 0} en viaje</span>
                <span>{kpis?.vehicles?.in_maintenance || 0} en mant.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Choferes Registrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="font-heading text-4xl font-bold text-slate-900">
                  {kpis?.drivers?.total || 0}
                </span>
                <Users className="w-6 h-6 text-slate-400 mb-2" />
              </div>
              <Button
                variant="link"
                className="p-0 h-auto mt-4 text-orange-600"
                onClick={() => navigate('/users?role=chofer')}
              >
                Ver todos los choferes
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Órdenes de Trabajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="font-heading text-4xl font-bold text-slate-900">
                  {kpis?.maintenance?.open_orders || 0}
                </span>
                <Wrench className="w-6 h-6 text-slate-400 mb-2" />
              </div>
              <p className="text-sm text-slate-500 mt-2">órdenes abiertas</p>
              <Button
                variant="link"
                className="p-0 h-auto mt-2 text-orange-600"
                onClick={() => navigate('/maintenance')}
              >
                Ver mantenimiento
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts and Activity - Role filtered */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Alerts */}
        {(isAdmin || isOperaciones || isFlota || isMantenimiento) && (
          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Alertas Recientes
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/alerts')}>
                Ver todas
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <CheckCircle className="w-12 h-12 mb-2" />
                    <p>No hay alertas activas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-start gap-3 p-3 bg-slate-50 rounded-sm hover:bg-slate-100 transition-colors"
                      >
                        <AlertTriangle
                          className={`w-5 h-5 flex-shrink-0 ${
                            alert.severity === 'critical'
                              ? 'text-red-500'
                              : alert.severity === 'warning'
                              ? 'text-yellow-500'
                              : 'text-blue-500'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {alert.message}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {format(new Date(alert.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </p>
                        </div>
                        <Badge variant={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Recent Trips */}
        {(isAdmin || isOperaciones || isContabilidad) && (
          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Viajes Recientes
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/trips')}>
                Ver todos
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                {!recentActivity?.trips?.length ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Route className="w-12 h-12 mb-2" />
                    <p>No hay viajes recientes</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.trips.map((trip) => (
                      <div
                        key={trip.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-sm hover:bg-slate-100 transition-colors cursor-pointer"
                        onClick={() => navigate(`/trips/${trip.id}`)}
                      >
                        <div className="w-10 h-10 bg-orange-100 rounded-sm flex items-center justify-center">
                          <Truck className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700">
                            {trip.client_name || 'Sin cliente'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
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
      <Card className="bg-slate-900 text-white">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-heading text-xl font-bold uppercase tracking-wide">
                Acciones Rápidas
              </h3>
              <p className="text-slate-400 mt-1">
                Accede rápidamente a las funciones más utilizadas
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {(isAdmin || isOperaciones) && (
                <Button
                  className="btn-action"
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
                  className="border-slate-600 text-white hover:bg-slate-800"
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
                  className="border-slate-600 text-white hover:bg-slate-800"
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
                  className="border-slate-600 text-white hover:bg-slate-800"
                  onClick={() => navigate('/settlements')}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Liquidaciones
                </Button>
              )}
              {(isAlmacen) && (
                <Button
                  variant="outline"
                  className="border-slate-600 text-white hover:bg-slate-800"
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
