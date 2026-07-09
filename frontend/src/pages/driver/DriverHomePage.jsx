import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tripsApi, alertsApi, vehiclesApi, maintenanceApi } from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Truck,
  Route,
  Fuel,
  FileText,
  AlertTriangle,
  ChevronRight,
  Clock,
  MapPin,
  Package,
  Loader2,
  CheckCircle,
  Play,
  Wrench,
  Gauge,
  PlusCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const DriverHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTrip, setActiveTrip] = useState(null);
  const [scheduledTrips, setScheduledTrips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [myVehicle, setMyVehicle] = useState(null);
  const [maintStatus, setMaintStatus] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tripsRes, alertsRes, vehiclesRes] = await Promise.all([
        tripsApi.getAll({ driver_id: user?.id }),
        alertsApi.getAll({ resolved: false }),
        vehiclesApi.getAll().catch(() => ({ data: [] })),
      ]);

      const trips = tripsRes.data;
      const currentTrip = trips.find(t => t.status === 'en_curso');
      setActiveTrip(currentTrip);
      setScheduledTrips(trips.filter(t => t.status === 'programado').slice(0, 3));
      setAlerts(alertsRes.data.slice(0, 3));

      // Unidad del chofer: preferir el tracto del viaje activo; si no, el vehículo asignado.
      const vehicleList = vehiclesRes.data || [];
      const tracto =
        (currentTrip && vehicleList.find(v => v.id === currentTrip.tracto_id)) ||
        vehicleList.find(v => v.assigned_driver_id === user?.id && v.vehicle_type === 'tracto') ||
        vehicleList.find(v => v.assigned_driver_id === user?.id);
      setMyVehicle(tracto || null);

      // Estado de mantenimiento preventivo de la unidad (silencioso si no hay plan).
      if (tracto) {
        try {
          const st = await maintenanceApi.getStatus(tracto.id);
          setMaintStatus(st.data);
        } catch (e) {
          setMaintStatus(null);
        }
      } else {
        setMaintStatus(null);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const quickActions = [
    { icon: FileText, label: 'Checklist', path: '/driver/checklist', gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' },
    { icon: Fuel, label: 'Combustible', path: '/driver/fuel', gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' },
    { icon: AlertTriangle, label: 'Reportar', path: '/driver/issues', gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' },
    { icon: Truck, label: 'Mi Viaje', path: '/driver/trip', gradient: 'linear-gradient(135deg, var(--brand-color) 0%, color-mix(in srgb, var(--brand-color) 70%, #b91c1c) 100%)' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-fade-in">
      {/* Greeting Hero Card */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 text-white smooth-appear card-3d"
        style={{
          backgroundImage:
            'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, color-mix(in srgb, var(--brand-color) 30%, #1e293b) 100%)',
        }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-12 -right-8 w-48 h-48 rounded-full blur-3xl opacity-30 float-animation"
            style={{ background: 'var(--brand-color)' }}
          />
          <div className="absolute top-3 right-4 w-12 h-12 rounded-xl border border-white/15 slow-spin" />
        </div>
        <div className="relative z-10">
          <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-300/80">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </p>
          <h1 className="font-heading text-2xl font-black uppercase tracking-tight mt-1">
            Hola, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            {activeTrip ? 'Tienes un viaje activo en curso.' : scheduledTrips.length > 0 ? `${scheduledTrips.length} viaje(s) programado(s).` : 'Sin viajes asignados hoy.'}
          </p>
        </div>
      </div>

      {/* Active Trip Banner */}
      {activeTrip ? (
        <Card
          className="text-white overflow-hidden border-0 smooth-appear smooth-appear-1 card-3d glow-on-hover"
          style={{
            backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          }}
        >
          <CardContent className="p-4 relative">
            <div
              aria-hidden
              className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-30 float-animation"
              style={{ background: '#60a5fa' }}
            />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="pill-info bg-white/20 text-white border-white/20">
                  <Play className="w-3 h-3 fill-current" />
                  VIAJE ACTIVO
                </span>
                <span className="pill-gradient bg-white/20 text-white border-white/20 font-mono">
                  {activeTrip.tracto_plate}
                </span>
              </div>

              <h3 className="font-heading font-black text-xl mb-1 tracking-tight">
                {activeTrip.client_name || 'Sin cliente'}
              </h3>
              <p className="text-blue-100 text-sm mb-3">
                {activeTrip.cargo_description || 'Sin descripción'}
              </p>

              <div className="flex items-center gap-4 text-sm text-blue-100 mb-4">
                <div className="flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  {activeTrip.cargo_weight ? `${activeTrip.cargo_weight} kg` : '-'}
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {activeTrip.route_name || 'Sin ruta'}
                </div>
              </div>

              <Button
                className="w-full bg-white text-blue-700 hover:bg-blue-50 rounded-lg btn-shine tap-scale font-semibold"
                onClick={() => navigate('/driver/trip')}
              >
                Ver Detalles del Viaje
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-light border-dashed border-slate-200 smooth-appear smooth-appear-1">
          <CardContent className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 icon-3d float-animation bg-slate-100">
              <Truck className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-heading font-bold text-slate-700 uppercase tracking-tight">Sin Viaje Activo</h3>
            <p className="text-sm text-slate-500 mt-1">
              {scheduledTrips.length > 0
                ? `Tienes ${scheduledTrips.length} viaje(s) programado(s)`
                : 'No tienes viajes asignados'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions - large gradient grid 2x2 feel via 4 cols */}
      <div className="smooth-appear smooth-appear-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
          Acciones Rápidas
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action, idx) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="group relative overflow-hidden flex flex-col items-start p-4 rounded-2xl text-white shadow-lg tap-scale card-3d touch-target text-left"
              style={{ backgroundImage: action.gradient }}
            >
              <div
                aria-hidden
                className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/15 blur-2xl group-hover:scale-125 transition-transform duration-500"
              />
              <div className="relative w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3 icon-3d">
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <span className="relative text-sm font-bold tracking-tight">{action.label}</span>
              <ChevronRight className="relative w-4 h-4 mt-1 opacity-70 group-hover:translate-x-1 transition-transform" />
            </button>
          ))}
        </div>
      </div>

      {/* Mantenimiento de tu unidad */}
      {myVehicle && (
        <div className="smooth-appear smooth-appear-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
            Mantenimiento de tu Unidad
          </h2>
          {maintStatus && maintStatus.km_remaining != null ? (
            <Card
              className={`border ${
                maintStatus.km_remaining <= 0
                  ? 'bg-red-50 border-red-200'
                  : maintStatus.due_soon
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      maintStatus.km_remaining <= 0
                        ? 'bg-red-100 text-red-600'
                        : maintStatus.due_soon
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Gauge className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {maintStatus.km_remaining <= 0 ? (
                      <p className="font-bold text-red-700">Servicio de mantenimiento vencido</p>
                    ) : (
                      <p
                        className={`font-bold ${
                          maintStatus.due_soon ? 'text-orange-700' : 'text-slate-800'
                        }`}
                      >
                        Faltan {Number(maintStatus.km_remaining).toLocaleString('es-PE')} km para el mantenimiento
                      </p>
                    )}
                    <p className="text-xs text-slate-500 truncate">
                      {maintStatus.plan_name ? `Plan: ${maintStatus.plan_name}` : 'Plan preventivo'}
                      {maintStatus.next_service_km != null &&
                        ` · Próximo servicio a ${Number(maintStatus.next_service_km).toLocaleString('es-PE')} km`}
                    </p>
                  </div>
                  {maintStatus.due_soon && (
                    <Badge className="bg-orange-500 text-white flex-shrink-0">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Pronto
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-3 rounded-lg tap-scale"
                  onClick={() => navigate('/driver/issues')}
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Agregar Observación
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white border-slate-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-700">Sin plan de mantenimiento asignado</p>
                  <p className="text-xs text-slate-500">Reporta cualquier novedad de tu unidad</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg tap-scale flex-shrink-0"
                  onClick={() => navigate('/driver/issues')}
                >
                  <PlusCircle className="w-4 h-4 mr-1" />
                  Observación
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Resumen de tu unidad */}
      {(myVehicle || activeTrip) && (
        <div className="smooth-appear smooth-appear-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
            Resumen de tu Unidad
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-white border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Truck className="w-4 h-4" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Tracto</span>
                </div>
                <p className="font-mono font-black text-lg text-slate-900">
                  {myVehicle?.plate || activeTrip?.tracto_plate || '-'}
                </p>
                {myVehicle && (
                  <p className="text-xs text-slate-500 truncate">
                    {myVehicle.brand} {myVehicle.model}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Package className="w-4 h-4" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Carreta</span>
                </div>
                <p className="font-mono font-black text-lg text-slate-900">
                  {activeTrip?.carreta_plate || '-'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {activeTrip?.carreta_plate ? 'En viaje activo' : 'Sin carreta acoplada'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Scheduled Trips */}
      {scheduledTrips.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
            Próximos Viajes
          </h2>
          <div className="space-y-3">
            {scheduledTrips.map((trip) => (
              <Card key={trip.id} className="bg-white tap-scale hover:shadow-md transition-all cursor-pointer" onClick={() => navigate('/driver/trip')}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 icon-3d"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-color) 20%, #ffffff) 0%, color-mix(in srgb, var(--brand-color) 8%, #ffffff) 100%)',
                      color: 'var(--brand-color)',
                    }}
                  >
                    <Route className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 truncate">
                      {trip.client_name || 'Sin cliente'}
                    </h4>
                    <p className="text-sm text-slate-500 truncate">
                      {trip.cargo_description}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(trip.scheduled_date), "dd/MM HH:mm")}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
            Alertas
          </h2>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <Card 
                key={alert.id} 
                className={`${
                  alert.severity === 'critical' 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <AlertTriangle className={`w-5 h-5 ${
                    alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                  }`} />
                  <p className="text-sm text-slate-700 flex-1">{alert.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Help Section */}
      <Card
        className="text-white border-0 overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        }}
      >
        <CardContent className="p-4 flex items-center justify-between relative">
          <div
            aria-hidden
            className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-25"
            style={{ background: 'var(--brand-color)' }}
          />
          <div className="relative">
            <h3 className="font-bold">¿Necesitas ayuda?</h3>
            <p className="text-sm text-slate-400">Contacta a tu supervisor</p>
          </div>
          <Button variant="outline" className="relative bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white tap-scale btn-shine rounded-lg">
            Llamar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverHomePage;
