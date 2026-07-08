import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tripsApi } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Truck,
  Route,
  MapPin,
  Package,
  Clock,
  User,
  Phone,
  FileText,
  Play,
  CheckCircle,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Fuel,
  Camera,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const DriverTripPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [kmStart, setKmStart] = useState('');
  const [kmEnd, setKmEnd] = useState('');

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const res = await tripsApi.getAll({ driver_id: user?.id });
      setTrips(res.data);
      setActiveTrip(res.data.find(t => t.status === 'en_curso'));
    } catch (error) {
      toast.error('Error al cargar viajes');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user?.id) {
      fetchTrips();
    }
  }, [user?.id]);

  const handleStartTrip = async () => {
    if (!selectedTrip) return;
    const km = parseInt(kmStart, 10);
    if (isNaN(km) || km < 0) {
      toast.error('Ingresa el kilometraje del odómetro');
      return;
    }
    setSaving(true);
    try {
      await tripsApi.start(selectedTrip.id, { km_start: km });
      toast.success('¡Viaje iniciado!');
      setShowStartDialog(false);
      setSelectedTrip(null);
      setKmStart('');
      fetchTrips();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar viaje');
    }
    setSaving(false);
  };

  const handleCompleteTrip = async () => {
    if (!selectedTrip) return;
    const km = parseInt(kmEnd, 10);
    if (isNaN(km) || km < 0) {
      toast.error('Ingresa el kilometraje del odómetro');
      return;
    }
    if (selectedTrip.km_start != null && km < selectedTrip.km_start) {
      toast.error(`El odómetro final debe ser mayor o igual a ${selectedTrip.km_start} km`);
      return;
    }
    setSaving(true);
    try {
      await tripsApi.complete(selectedTrip.id, { km_end: km, notes });
      toast.success('¡Viaje completado!');
      setShowCompleteDialog(false);
      setSelectedTrip(null);
      setNotes('');
      setKmEnd('');
      fetchTrips();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al completar viaje');
    }
    setSaving(false);
  };

  const getStatusBadge = (status) => {
    const classes = {
      programado: 'pill-warning',
      en_curso: 'pill-info',
      completado: 'pill-success',
      cancelado: 'pill-danger',
    };
    const labels = {
      programado: 'Programado',
      en_curso: 'En Curso',
      completado: 'Completado',
      cancelado: 'Cancelado',
    };
    return <span className={classes[status] || 'pill-gradient'}>{labels[status]}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const scheduledTrips = trips.filter(t => t.status === 'programado');
  const completedTrips = trips.filter(t => t.status === 'completado').slice(0, 5);

  return (
    <div className="space-y-6 page-fade-in">
      <h1 className="font-heading text-2xl font-black uppercase tracking-tight text-slate-900">Mis Viajes</h1>

      {/* Active Trip */}
      {activeTrip && (
        <Card
          className="text-white overflow-hidden border-0 smooth-appear card-3d glow-on-hover"
          style={{
            backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          }}
        >
          <CardContent className="p-4 relative">
            <div
              aria-hidden
              className="absolute -top-12 -right-10 w-44 h-44 rounded-full blur-3xl opacity-30 float-animation"
              style={{ background: '#60a5fa' }}
            />
            <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="pill-info bg-white/20 text-white border-white/20">
                <Play className="w-3 h-3 fill-current" />
                EN CURSO
              </span>
              <span className="text-sm font-mono px-2.5 py-1 rounded-md bg-white/15 border border-white/15">{activeTrip.tracto_plate}</span>
            </div>

            <h3 className="font-heading font-black text-xl mb-2 tracking-tight">
              {activeTrip.client_name || 'Sin cliente'}
            </h3>
            
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="flex items-center gap-2 text-blue-100">
                <Package className="w-4 h-4" />
                <span>{activeTrip.cargo_description || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-blue-100">
                <MapPin className="w-4 h-4" />
                <span>{activeTrip.cargo_weight ? `${activeTrip.cargo_weight} kg` : '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                className="bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm tap-scale rounded-lg"
                onClick={() => navigate('/driver/checklist')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Checklist
              </Button>
              <Button
                className="bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm tap-scale rounded-lg"
                onClick={() => navigate('/driver/fuel')}
              >
                <Fuel className="w-4 h-4 mr-2" />
                Combustible
              </Button>
            </div>

            <Button
              className="w-full mt-3 text-white tap-scale btn-shine rounded-lg font-semibold"
              style={{ backgroundImage: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' }}
              onClick={() => {
                setSelectedTrip(activeTrip);
                setShowCompleteDialog(true);
              }}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Finalizar Viaje
            </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheduled Trips */}
      {scheduledTrips.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
            Viajes Programados
          </h2>
          <div className="space-y-3">
            {scheduledTrips.map((trip, idx) => (
              <Card key={trip.id} className={`bg-white smooth-appear smooth-appear-${Math.min(idx + 1, 6)} card-3d`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-slate-800">
                        {trip.client_name || 'Sin cliente'}
                      </h4>
                      <p className="text-sm text-slate-500">
                        {trip.cargo_description}
                      </p>
                    </div>
                    {getStatusBadge(trip.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-500 mb-3">
                    <div className="flex items-center gap-1">
                      <Truck className="w-4 h-4" />
                      {trip.tracto_plate}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(new Date(trip.scheduled_date), "dd/MM HH:mm")}
                    </div>
                  </div>

                  <Button
                    className="w-full btn-action btn-shine tap-scale rounded-lg"
                    onClick={() => {
                      setSelectedTrip(trip);
                      setShowStartDialog(true);
                    }}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Iniciar Viaje
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No trips message */}
      {!activeTrip && scheduledTrips.length === 0 && (
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="p-8 text-center">
            <Truck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="font-bold text-slate-700 mb-2">Sin Viajes Asignados</h3>
            <p className="text-sm text-slate-500">
              No tienes viajes programados en este momento
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent completed trips */}
      {completedTrips.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
            Viajes Completados
          </h2>
          <div className="space-y-2">
            {completedTrips.map((trip) => (
              <Card key={trip.id} className="bg-white">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-800 text-sm truncate">
                      {trip.client_name || 'Sin cliente'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {format(new Date(trip.completed_at || trip.scheduled_date), "dd/MM/yyyy")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Start Trip Dialog */}
      <Dialog open={showStartDialog} onOpenChange={(open) => { if (!open) setKmStart(''); setShowStartDialog(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Iniciar Viaje</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="font-bold text-slate-800">{selectedTrip?.client_name}</p>
              <p className="text-sm text-slate-600">{selectedTrip?.cargo_description}</p>
            </div>
            <div className="space-y-2">
              <Label>Odómetro inicial (km) *</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={kmStart}
                onChange={(e) => setKmStart(e.target.value)}
                placeholder="Ej. 125000"
                data-testid="driver-km-start-input"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span>Asegúrate de haber completado el checklist de salida</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleStartTrip}
              disabled={saving || kmStart === ''}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Iniciar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Trip Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={(open) => { if (!open) { setKmEnd(''); setNotes(''); } setShowCompleteDialog(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Viaje</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="font-bold text-slate-800">{selectedTrip?.client_name}</p>
              <p className="text-sm text-slate-600">{selectedTrip?.cargo_description}</p>
              {selectedTrip?.km_start != null && (
                <p className="text-xs text-slate-500 mt-1">Odómetro inicial: {selectedTrip.km_start} km</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Odómetro final (km) *</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={kmEnd}
                onChange={(e) => setKmEnd(e.target.value)}
                placeholder="Ej. 125850"
                data-testid="driver-km-end-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Notas de finalización</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones del viaje..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-green-500 hover:bg-green-600"
              onClick={handleCompleteTrip}
              disabled={saving || kmEnd === ''}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finalizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverTripPage;
