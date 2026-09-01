import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tiresApi, vehiclesApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, ArrowRight, Loader2, RotateCw, X, Repeat, CircleDot } from 'lucide-react';
import { toast } from 'sonner';
import TruckSchema from '../components/tires/TruckSchema';
import { getRenderConfig } from '../components/tires/tireSchema';

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

const RotateTiresPage = () => {
  const { vehicleId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vehicle, setVehicle] = useState(null);
  const [tires, setTires] = useState([]);

  // Selection + pending operations
  const [selectedOrigin, setSelectedOrigin] = useState(null); // { position, tire }
  const [pendingOps, setPendingOps] = useState([]); // [{ id, type, changes, desc }]

  // Form fields
  const [rotationOdometer, setRotationOdometer] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState('');

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
      setRotationOdometer(vehicleRes.data?.odometer?.toString() || '0');
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

  const getTireByPosition = (positionCode) =>
    tires.find((t) => t.current_position === positionCode);

  // All positions involved in a pending operation are locked to avoid conflicts.
  const lockedPositions = new Set(
    pendingOps.flatMap((op) =>
      op.changes.flatMap((c) => [c.from_position, c.to_position])
    )
  );

  const handlePositionClick = (position) => {
    const posCode = position.code;

    if (lockedPositions.has(posCode)) {
      toast.error('Esa posición ya forma parte de un cambio pendiente');
      return;
    }

    // Step 1: choose the origin (must have a mounted tire)
    if (!selectedOrigin) {
      const tire = getTireByPosition(posCode);
      if (!tire) {
        toast.error('Primero selecciona una llanta montada (origen)');
        return;
      }
      setSelectedOrigin({ position, tire });
      return;
    }

    // Clicking the same position again cancels the selection
    if (posCode === selectedOrigin.position.code) {
      setSelectedOrigin(null);
      return;
    }

    // Step 2: choose the destination
    const destTire = getTireByPosition(posCode);
    const origin = selectedOrigin;

    if (destTire) {
      // Swap: both tires exchange positions
      const op = {
        id: `op-${Date.now()}`,
        type: 'swap',
        changes: [
          {
            tire_id: origin.tire.id,
            from_position: origin.position.code,
            to_position: posCode,
          },
          {
            tire_id: destTire.id,
            from_position: posCode,
            to_position: origin.position.code,
          },
        ],
        desc: `Intercambio ${origin.position.label} ↔ ${position.label} (${origin.tire.serial} ↔ ${destTire.serial})`,
      };
      setPendingOps((prev) => [...prev, op]);
    } else {
      // Move to an empty position
      const op = {
        id: `op-${Date.now()}`,
        type: 'move',
        changes: [
          {
            tire_id: origin.tire.id,
            from_position: origin.position.code,
            to_position: posCode,
          },
        ],
        desc: `Mover ${origin.tire.serial} de ${origin.position.label} → ${position.label}`,
      };
      setPendingOps((prev) => [...prev, op]);
    }

    setSelectedOrigin(null);
  };

  const removeOp = (id) => {
    setPendingOps((prev) => prev.filter((op) => op.id !== id));
  };

  const buildReason = () => {
    const parts = ['Rotación en el mismo vehículo'];
    if (date) parts.push(`Fecha: ${date}`);
    if (cost) parts.push(`Costo: S/ ${cost}`);
    return parts.join(' · ');
  };

  const handleConfirm = async () => {
    if (pendingOps.length === 0) {
      toast.error('Agrega al menos un cambio de posición');
      return;
    }
    setSaving(true);
    try {
      const changes = pendingOps.flatMap((op) =>
        op.changes.map((c) => ({
          tire_id: c.tire_id,
          from_position: c.from_position,
          to_position: c.to_position,
        }))
      );
      await tiresApi.rotate({
        vehicle_id: vehicleId,
        changes,
        odometer: parseInt(rotationOdometer, 10) || vehicle?.odometer || 0,
        reason: buildReason(),
      });
      toast.success('Rotación realizada exitosamente');
      navigate(backTo);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al realizar la rotación');
    }
    setSaving(false);
  };

  const config = getRenderConfig(vehicle);
  const isTracto = vehicle?.vehicle_type === 'tracto';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-marca-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="rotate-tires-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(backTo)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Rotar Llantas
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

      {/* Instructions / selection banner */}
      <Card className={selectedOrigin ? 'bg-marca-50 border-marca-300' : 'bg-white'}>
        <CardContent className="py-4">
          {selectedOrigin ? (
            <div className="flex items-center gap-3 text-sm">
              <RotateCw className="w-5 h-5 text-marca-500 animate-spin" />
              <span className="font-medium text-slate-800">
                Origen seleccionado:{' '}
                <Badge variant="outline" className="font-mono">
                  {selectedOrigin.position.label}
                </Badge>{' '}
                ({selectedOrigin.tire.serial}). Ahora elige la posición de destino.
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setSelectedOrigin(null)}
              >
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Haz click en una llanta montada (origen) y luego en la posición de destino
              para armar la rotación. Si el destino ya tiene llanta, se registrará un
              intercambio.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Truck schema */}
        <Card className="bg-white lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
              Esquema de Llantas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TruckSchema
              config={config}
              isTracto={isTracto}
              getTireByPosition={getTireByPosition}
              getTireStatus={computeTireStatus}
              onPositionClick={handlePositionClick}
            />
          </CardContent>
        </Card>

        {/* Pending changes + form */}
        <div className="space-y-6">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Cambios Pendientes ({pendingOps.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingOps.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <Repeat className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">Aún no hay cambios</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {pendingOps.map((op) => (
                    <li
                      key={op.id}
                      className="flex items-center gap-2 p-2 rounded-sm border border-slate-200 bg-slate-50"
                    >
                      {op.type === 'swap' ? (
                        <Repeat className="w-4 h-4 text-marca-500 shrink-0" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="text-xs text-slate-700 flex-1">{op.desc}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => removeOp(op.id)}
                        data-testid={`remove-change-${op.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Datos de la Rotación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="input-label">Medición de rotación (odómetro)</Label>
                <Input
                  type="number"
                  value={rotationOdometer}
                  onChange={(e) => setRotationOdometer(e.target.value)}
                  className="rounded-sm"
                  data-testid="rotation-odometer-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Fecha</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-sm"
                  data-testid="rotation-date-input"
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
                  data-testid="rotation-cost-input"
                />
              </div>
              <Button
                className="btn-action w-full"
                onClick={handleConfirm}
                disabled={pendingOps.length === 0 || saving}
                data-testid="confirm-rotation-btn"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CircleDot className="w-4 h-4 mr-2" />
                )}
                Confirmar Rotación
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RotateTiresPage;
