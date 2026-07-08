import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tiresApi, vehiclesApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ArrowLeft, Loader2, Crosshair } from 'lucide-react';
import { toast } from 'sonner';
import TruckSchema from '../components/tires/TruckSchema';
import { getRenderConfig, AXLE_TYPE_META } from '../components/tires/tireSchema';

// Compute a coarse status for a tire based on its last inspection depths.
const computeTireStatus = (tire) => {
  if (!tire) return 'empty';
  const lastInspection = tire.last_inspection;
  if (!lastInspection) return 'good';
  const minDepth = Math.min(...(lastInspection.depths || [10]));
  if (minDepth < 3) return 'critical';
  if (minDepth < 5) return 'warning';
  return 'good';
};

const AlignTiresPage = () => {
  const { vehicleId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vehicle, setVehicle] = useState(null);
  const [tires, setTires] = useState([]);

  // Form fields
  const [selectedAxle, setSelectedAxle] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const backTo = `/vehicles/${vehicleId}/tires`;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehicleRes, tiresRes] = await Promise.all([
        vehiclesApi.getById(vehicleId),
        tiresApi.getByVehicle(vehicleId),
      ]);
      setVehicle(vehicleRes.data);
      setTires(tiresRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
      navigate('/vehicles');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  const config = getRenderConfig(vehicle);
  const isTracto = vehicle?.vehicle_type === 'tracto';
  const axleOptions = config.axles;

  const getTireByPosition = (positionCode) =>
    tires.find((t) => t.current_position === positionCode);

  // Clicking a tire selects the axle it belongs to.
  const handlePositionClick = (position) => {
    const axle = axleOptions.find(
      (a) =>
        a.left.some((p) => p.code === position.code) ||
        a.right.some((p) => p.code === position.code)
    );
    if (axle) {
      setSelectedAxle(axle.name);
    } else {
      toast.error('Selecciona un eje del vehículo (los repuestos no se alinean)');
    }
  };

  const handleConfirm = async () => {
    if (!selectedAxle) {
      toast.error('Selecciona el eje a alinear');
      return;
    }
    setSaving(true);
    try {
      const notesParts = [];
      if (notes.trim()) notesParts.push(notes.trim());
      if (date) notesParts.push(`Fecha: ${date}`);
      await tiresApi.align({
        vehicle_id: vehicleId,
        axle: selectedAxle,
        workshop: workshop.trim() || null,
        cost: parseFloat(cost) || 0,
        notes: notesParts.length ? notesParts.join(' · ') : null,
      });
      toast.success('Alineación registrada exitosamente');
      navigate(backTo);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar la alineación');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="align-tires-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(backTo)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Alinear Ejes
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <Badge variant="outline" className="font-mono text-lg">
              {vehicle?.plate}
            </Badge>
            <span className="text-slate-500">
              {vehicle?.brand} {vehicle?.model} -{' '}
              {vehicle?.vehicle_type === 'tracto' ? 'Tracto' : 'Carreta'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Truck schema */}
        <Card className="bg-white lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
              Esquema de Llantas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-2">
              Haz click sobre una llanta para seleccionar su eje, o usa el selector.
            </p>
            <TruckSchema
              config={config}
              isTracto={isTracto}
              getTireByPosition={getTireByPosition}
              getTireStatus={computeTireStatus}
              onPositionClick={handlePositionClick}
            />
          </CardContent>
        </Card>

        {/* Alignment form */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
              Datos de la Alineación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="input-label">Eje *</Label>
              <Select value={selectedAxle} onValueChange={setSelectedAxle}>
                <SelectTrigger className="rounded-sm" data-testid="align-axle-select">
                  <SelectValue placeholder="Seleccionar eje" />
                </SelectTrigger>
                <SelectContent>
                  {axleOptions.map((a) => (
                    <SelectItem key={a.name} value={a.name}>
                      {a.name} ({AXLE_TYPE_META[a.type]?.label || a.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Taller (opcional)</Label>
              <Input
                value={workshop}
                onChange={(e) => setWorkshop(e.target.value)}
                placeholder="Nombre del taller"
                className="rounded-sm"
                data-testid="align-workshop-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-sm"
                data-testid="align-date-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Costo (opcional)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="rounded-sm"
                data-testid="align-cost-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Notas (opcional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones"
                className="rounded-sm"
                data-testid="align-notes-input"
              />
            </div>
            <Button
              className="btn-action w-full"
              onClick={handleConfirm}
              disabled={!selectedAxle || saving}
              data-testid="confirm-align-btn"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Crosshair className="w-4 h-4 mr-2" />
              )}
              Registrar Alineación
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AlignTiresPage;
