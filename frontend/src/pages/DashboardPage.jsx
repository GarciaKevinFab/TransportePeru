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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [recentActivity, setRecentActivity] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kpisRes, activityRes, alertsRes] = await Promise.all([
        dashboardApi.getKPIs(),
        dashboardApi.getRecentActivity(),
        alertsApi.getAll({ resolved: false }),
      ]);
      setKpis(kpisRes.data);
      setRecentActivity(activityRes.data);
      setAlerts(alertsRes.data.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const KPICard = ({ title, value, subtitle, icon: Icon, trend, color = 'orange' }) => (
    <Card className="kpi-card card-hover transition-all duration-200" style={{ borderLeftColor: `var(--${color})` }}>
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

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            Vista general del sistema de gestión de flota
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Vehículos Disponibles"
          value={kpis?.vehicles?.available || 0}
          subtitle={`de ${kpis?.vehicles?.total || 0} totales`}
          icon={Truck}
          color="orange"
        />
        <KPICard
          title="Viajes Activos"
          value={kpis?.trips?.active || 0}
          subtitle={`${kpis?.trips?.completed || 0} completados`}
          icon={Route}
          color="blue"
        />
        <KPICard
          title="Alertas Activas"
          value={kpis?.alerts?.total || 0}
          subtitle={`${kpis?.alerts?.critical || 0} críticas`}
          icon={AlertTriangle}
          color="red"
        />
        <KPICard
          title="Documentos por Vencer"
          value={kpis?.documents?.expiring || 0}
          subtitle="próximos 30 días"
          icon={FileText}
          color="yellow"
        />
      </div>

      {/* Secondary KPIs */}
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

      {/* Alerts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Alerts */}
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

        {/* Recent Trips */}
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
      </div>

      {/* Quick Actions */}
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
              <Button
                className="btn-action"
                onClick={() => navigate('/trips/new')}
                data-testid="quick-new-trip-btn"
              >
                <Route className="w-4 h-4 mr-2" />
                Nuevo Viaje
              </Button>
              <Button
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-800"
                onClick={() => navigate('/vehicles/new')}
                data-testid="quick-new-vehicle-btn"
              >
                <Truck className="w-4 h-4 mr-2" />
                Nuevo Vehículo
              </Button>
              <Button
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-800"
                onClick={() => navigate('/maintenance/new')}
                data-testid="quick-new-ot-btn"
              >
                <Wrench className="w-4 h-4 mr-2" />
                Nueva OT
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
