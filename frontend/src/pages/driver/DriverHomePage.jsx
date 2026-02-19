import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tripsApi, alertsApi } from '../../services/api';
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tripsRes, alertsRes] = await Promise.all([
        tripsApi.getAll({ driver_id: user?.id }),
        alertsApi.getAll({ resolved: false }),
      ]);

      const trips = tripsRes.data;
      setActiveTrip(trips.find(t => t.status === 'en_curso'));
      setScheduledTrips(trips.filter(t => t.status === 'programado').slice(0, 3));
      setAlerts(alertsRes.data.slice(0, 3));
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
    { icon: FileText, label: 'Checklist', path: '/driver/checklist', color: 'bg-blue-500' },
    { icon: Fuel, label: 'Combustible', path: '/driver/fuel', color: 'bg-green-500' },
    { icon: AlertTriangle, label: 'Reportar', path: '/driver/issues', color: 'bg-red-500' },
    { icon: Truck, label: 'Mi Viaje', path: '/driver/trip', color: 'bg-orange-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Hola, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-slate-500 text-sm">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Active Trip Banner */}
      {activeTrip ? (
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Badge className="bg-white/20 text-white border-0">
                <Play className="w-3 h-3 mr-1" />
                VIAJE ACTIVO
              </Badge>
              <Badge className="bg-white/20 text-white border-0">
                {activeTrip.tracto_plate}
              </Badge>
            </div>
            
            <h3 className="font-bold text-lg mb-1">
              {activeTrip.client_name || 'Sin cliente'}
            </h3>
            <p className="text-blue-200 text-sm mb-3">
              {activeTrip.cargo_description || 'Sin descripción'}
            </p>

            <div className="flex items-center gap-4 text-sm text-blue-100 mb-4">
              <div className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                {activeTrip.cargo_weight ? `${activeTrip.cargo_weight} kg` : '-'}
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {activeTrip.route_name || 'Sin ruta'}
              </div>
            </div>

            <Button 
              className="w-full bg-white text-blue-600 hover:bg-blue-50"
              onClick={() => navigate('/driver/trip')}
            >
              Ver Detalles del Viaje
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="p-6 text-center">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 mb-1">Sin Viaje Activo</h3>
            <p className="text-sm text-slate-500">
              {scheduledTrips.length > 0 
                ? `Tienes ${scheduledTrips.length} viaje(s) programado(s)`
                : 'No tienes viajes asignados'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
          Acciones Rápidas
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`w-12 h-12 ${action.color} rounded-full flex items-center justify-center mb-2`}>
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-medium text-slate-700">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scheduled Trips */}
      {scheduledTrips.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
            Próximos Viajes
          </h2>
          <div className="space-y-3">
            {scheduledTrips.map((trip) => (
              <Card key={trip.id} className="bg-white" onClick={() => navigate('/driver/trip')}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Route className="w-6 h-6 text-orange-600" />
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
      <Card className="bg-slate-900 text-white">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold">¿Necesitas ayuda?</h3>
            <p className="text-sm text-slate-400">Contacta a tu supervisor</p>
          </div>
          <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-800">
            Llamar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverHomePage;
