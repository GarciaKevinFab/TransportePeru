import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tiresApi, vehiclesApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import {
  ArrowLeft,
  Plus,
  CircleDot,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Wrench,
  RotateCw,
  Eye,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';

// Tire position configurations
const TRACTO_CONFIG = {
  axles: [
    { name: 'Eje Direccional', positions: [{ code: 'T-1L', label: '1L' }, { code: 'T-1R', label: '1R' }], dual: false },
    { name: 'Eje Tracción', positions: [
      { code: 'T-2L1', label: '2L1' }, { code: 'T-2L2', label: '2L2' },
      { code: 'T-2R1', label: '2R1' }, { code: 'T-2R2', label: '2R2' }
    ], dual: true },
  ],
  spare: [{ code: 'T-SP', label: 'Repuesto' }]
};

const CARRETA_CONFIG = {
  axles: [
    { name: 'Eje A', positions: [{ code: 'C-A-L', label: 'AL' }, { code: 'C-A-R', label: 'AR' }], dual: false },
    { name: 'Eje B', positions: [{ code: 'C-B-L', label: 'BL' }, { code: 'C-B-R', label: 'BR' }], dual: false },
    { name: 'Eje C', positions: [{ code: 'C-C-L', label: 'CL' }, { code: 'C-C-R', label: 'CR' }], dual: false },
  ],
  spare: [{ code: 'C-SP', label: 'Repuesto' }]
};

const TireSchemaPage = () => {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState(null);
  const [tires, setTires] = useState([]);
  const [availableTires, setAvailableTires] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [selectedTire, setSelectedTire] = useState(null);
  
  // Dialog states
  const [showMountDialog, setShowMountDialog] = useState(false);
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [showTireDetailsDialog, setShowTireDetailsDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Mount form
  const [mountForm, setMountForm] = useState({
    tire_id: '',
    mount_odometer: '',
  });
  
  // Inspection form
  const [inspectionForm, setInspectionForm] = useState({
    depth1: '',
    depth2: '',
    depth3: '',
    pressure: '',
    irregular_wear: false,
    wear_type: '',
    odometer: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehicleRes, tiresRes, availableRes] = await Promise.all([
        vehiclesApi.getById(vehicleId),
        tiresApi.getByVehicle(vehicleId),
        tiresApi.getAll({ status: 'nuevo' }),
      ]);
      setVehicle(vehicleRes.data);
      setTires(tiresRes.data);
      setAvailableTires(availableRes.data.filter(t => !t.current_vehicle_id));
    } catch (error) {
      toast.error('Error al cargar datos');
      navigate('/vehicles');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [vehicleId]);

  const getTireByPosition = (positionCode) => {
    return tires.find((t) => t.current_position === positionCode);
  };

  const getTireStatus = (tire) => {
    if (!tire) return 'empty';
    const lastInspection = tire.last_inspection;
    if (!lastInspection) return 'good';
    
    const minDepth = Math.min(...(lastInspection.depths || [10]));
    if (minDepth < 3) return 'critical';
    if (minDepth < 5) return 'warning';
    return 'good';
  };

  const handlePositionClick = (position) => {
    const tire = getTireByPosition(position.code);
    setSelectedPosition(position);
    
    if (tire) {
      setSelectedTire(tire);
      setShowTireDetailsDialog(true);
    } else {
      setMountForm({ tire_id: '', mount_odometer: vehicle?.odometer?.toString() || '0' });
      setShowMountDialog(true);
    }
  };

  const handleMountTire = async () => {
    if (!mountForm.tire_id || !selectedPosition) return;
    setSaving(true);
    try {
      await tiresApi.mount({
        tire_id: mountForm.tire_id,
        vehicle_id: vehicleId,
        position_code: selectedPosition.code,
        mount_odometer: parseInt(mountForm.mount_odometer) || 0,
      });
      toast.success('Llanta montada exitosamente');
      setShowMountDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al montar llanta');
    }
    setSaving(false);
  };

  const handleUnmountTire = async () => {
    if (!selectedTire) return;
    setSaving(true);
    try {
      await tiresApi.unmount(selectedTire.id, {
        odometer: vehicle?.odometer || 0,
        reason: 'Desmontaje manual',
        new_status: 'nuevo',
      });
      toast.success('Llanta desmontada');
      setShowTireDetailsDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al desmontar llanta');
    }
    setSaving(false);
  };

  const handleCreateInspection = async () => {
    if (!selectedTire) return;
    setSaving(true);
    try {
      const depths = [inspectionForm.depth1, inspectionForm.depth2, inspectionForm.depth3]
        .filter(d => d)
        .map(d => parseFloat(d));
      
      await tiresApi.createInspection({
        tire_id: selectedTire.id,
        vehicle_id: vehicleId,
        position_code: selectedTire.current_position,
        depths,
        pressure: parseFloat(inspectionForm.pressure) || 0,
        irregular_wear: inspectionForm.irregular_wear,
        wear_type: inspectionForm.wear_type || null,
        odometer: parseInt(inspectionForm.odometer) || vehicle?.odometer || 0,
        notes: inspectionForm.notes || null,
      });
      toast.success('Inspección registrada');
      setShowInspectionDialog(false);
      setInspectionForm({
        depth1: '', depth2: '', depth3: '', pressure: '',
        irregular_wear: false, wear_type: '', odometer: '', notes: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear inspección');
    }
    setSaving(false);
  };

  const openInspectionDialog = () => {
    setInspectionForm({
      ...inspectionForm,
      odometer: vehicle?.odometer?.toString() || '0',
    });
    setShowTireDetailsDialog(false);
    setShowInspectionDialog(true);
  };

  const config = vehicle?.vehicle_type === 'tracto' ? TRACTO_CONFIG : CARRETA_CONFIG;

  const TirePosition = ({ position }) => {
    const tire = getTireByPosition(position.code);
    const status = getTireStatus(tire);
    
    const statusStyles = {
      good: 'bg-green-100 border-green-500 text-green-700 hover:bg-green-200',
      warning: 'bg-yellow-100 border-yellow-500 text-yellow-700 hover:bg-yellow-200',
      critical: 'bg-red-100 border-red-500 text-red-700 hover:bg-red-200 pulse-alert',
      empty: 'bg-slate-100 border-slate-300 text-slate-400 border-dashed hover:bg-slate-200',
    };

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handlePositionClick(position)}
              className={`tire-position ${statusStyles[status]} transition-all duration-200`}
              data-testid={`tire-${position.code}`}
            >
              {tire ? (
                <div className="text-center">
                  <CircleDot className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-[10px] font-bold">{position.label}</span>
                </div>
              ) : (
                <div className="text-center">
                  <Plus className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-[10px]">{position.label}</span>
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {tire ? (
              <div className="text-xs">
                <p className="font-bold">{tire.serial}</p>
                <p>{tire.brand} {tire.model}</p>
                <p>{tire.dimension}</p>
                {tire.last_inspection && (
                  <p>Prof: {Math.min(...tire.last_inspection.depths).toFixed(1)}mm</p>
                )}
              </div>
            ) : (
              <p>Posición vacía - Click para montar</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tire-schema-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/vehicles')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Llantas del Vehículo
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <Badge variant="outline" className="font-mono text-lg">
              {vehicle?.plate}
            </Badge>
            <span className="text-slate-500">
              {vehicle?.brand} {vehicle?.model} - {vehicle?.vehicle_type === 'tracto' ? 'Tracto' : 'Carreta'}
            </span>
          </div>
        </div>
      </div>

      {/* Tire Schema */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
            Esquema de Llantas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8">
            {/* Vehicle representation */}
            <div className="relative">
              {/* Chassis representation */}
              <div className="bg-slate-200 rounded-lg px-8 py-4 relative">
                {vehicle?.vehicle_type === 'tracto' && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-20 h-8 bg-slate-300 rounded-t-lg flex items-center justify-center">
                    <Truck className="w-6 h-6 text-slate-600" />
                  </div>
                )}
                
                <div className="space-y-8">
                  {config.axles.map((axle, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <span className="text-xs font-bold text-slate-500 mb-2">{axle.name}</span>
                      <div className="flex justify-center gap-24">
                        {/* Left side */}
                        <div className={`flex ${axle.dual ? 'gap-1' : ''}`}>
                          {axle.positions
                            .filter((_, i) => i < (axle.dual ? 2 : 1))
                            .map((pos) => (
                              <TirePosition key={pos.code} position={pos} />
                            ))}
                        </div>
                        
                        {/* Axle line */}
                        <div className="w-16 h-1 bg-slate-400 self-center" />
                        
                        {/* Right side */}
                        <div className={`flex ${axle.dual ? 'gap-1' : ''}`}>
                          {axle.positions
                            .filter((_, i) => i >= (axle.dual ? 2 : 1))
                            .map((pos) => (
                              <TirePosition key={pos.code} position={pos} />
                            ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Spare Tire */}
            {config.spare && (
              <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-300">
                <span className="text-xs font-bold text-slate-500 mb-2 block text-center">Llanta de Repuesto</span>
                <div className="flex justify-center gap-4">
                  {config.spare.map((pos) => (
                    <TirePosition key={pos.code} position={pos} />
                  ))}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex gap-6 mt-8">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-100 border-2 border-green-500" />
                <span className="text-xs text-slate-600">Buena condición</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-100 border-2 border-yellow-500" />
                <span className="text-xs text-slate-600">Requiere atención</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-100 border-2 border-red-500" />
                <span className="text-xs text-slate-600">Crítico</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-100 border-2 border-slate-300 border-dashed" />
                <span className="text-xs text-slate-600">Sin llanta</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tires List */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
            Llantas Montadas ({tires.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tires.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CircleDot className="w-12 h-12 mx-auto mb-2" />
              <p>No hay llantas montadas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tires.map((tire) => {
                const status = getTireStatus(tire);
                return (
                  <div
                    key={tire.id}
                    className={`p-4 rounded-sm border-l-4 ${
                      status === 'critical'
                        ? 'border-l-red-500 bg-red-50'
                        : status === 'warning'
                        ? 'border-l-yellow-500 bg-yellow-50'
                        : 'border-l-green-500 bg-green-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono font-bold text-slate-900">{tire.serial}</p>
                        <p className="text-sm text-slate-600">{tire.brand} {tire.model}</p>
                        <p className="text-xs text-slate-500">{tire.dimension}</p>
                      </div>
                      <Badge variant="outline">{tire.current_position}</Badge>
                    </div>
                    {tire.last_inspection && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <span>Prof: {Math.min(...tire.last_inspection.depths).toFixed(1)}mm</span>
                          <span>•</span>
                          <span>Presión: {tire.last_inspection.pressure} PSI</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mount Dialog */}
      <Dialog open={showMountDialog} onOpenChange={setShowMountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading font-bold uppercase">
              Montar Llanta - Posición {selectedPosition?.code}
            </DialogTitle>
            <DialogDescription>
              Selecciona una llanta disponible para montar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="input-label">Llanta *</Label>
              <Select
                value={mountForm.tire_id}
                onValueChange={(v) => setMountForm({ ...mountForm, tire_id: v })}
              >
                <SelectTrigger className="rounded-sm" data-testid="mount-tire-select">
                  <SelectValue placeholder="Seleccionar llanta" />
                </SelectTrigger>
                <SelectContent>
                  {availableTires.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.serial} - {t.brand} {t.dimension}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Odómetro Actual</Label>
              <Input
                type="number"
                value={mountForm.mount_odometer}
                onChange={(e) => setMountForm({ ...mountForm, mount_odometer: e.target.value })}
                className="rounded-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMountDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleMountTire}
              disabled={!mountForm.tire_id || saving}
              data-testid="confirm-mount-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Montar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tire Details Dialog */}
      <Dialog open={showTireDetailsDialog} onOpenChange={setShowTireDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading font-bold uppercase">
              Llanta {selectedTire?.serial}
            </DialogTitle>
            <DialogDescription>
              Posición: {selectedTire?.current_position}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Marca</p>
                <p className="font-medium">{selectedTire?.brand}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Modelo</p>
                <p className="font-medium">{selectedTire?.model || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Dimensión</p>
                <p className="font-medium">{selectedTire?.dimension}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Vida</p>
                <p className="font-medium">
                  {selectedTire?.life_number === 1 ? 'Nueva' : `R${selectedTire?.life_number - 1}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Km Totales</p>
                <p className="font-medium font-mono">
                  {selectedTire?.total_km?.toLocaleString() || 0} km
                </p>
              </div>
            </div>
            
            {selectedTire?.last_inspection && (
              <div className="p-4 bg-slate-50 rounded-sm">
                <p className="text-xs text-slate-500 uppercase font-bold mb-2">Última Inspección</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Profundidad:</span>{' '}
                    <span className="font-medium">
                      {Math.min(...selectedTire.last_inspection.depths).toFixed(1)}mm
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Presión:</span>{' '}
                    <span className="font-medium">{selectedTire.last_inspection.pressure} PSI</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={openInspectionDialog}>
              <Eye className="w-4 h-4 mr-2" />
              Nueva Inspección
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnmountTire}
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Desmontar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspection Dialog */}
      <Dialog open={showInspectionDialog} onOpenChange={setShowInspectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading font-bold uppercase">
              Nueva Inspección
            </DialogTitle>
            <DialogDescription>
              Llanta: {selectedTire?.serial} - Posición: {selectedTire?.current_position}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="input-label">Profundidades (mm) *</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="P1"
                  value={inspectionForm.depth1}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, depth1: e.target.value })}
                  className="rounded-sm"
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="P2"
                  value={inspectionForm.depth2}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, depth2: e.target.value })}
                  className="rounded-sm"
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="P3"
                  value={inspectionForm.depth3}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, depth3: e.target.value })}
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Presión (PSI) *</Label>
                <Input
                  type="number"
                  value={inspectionForm.pressure}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, pressure: e.target.value })}
                  className="rounded-sm"
                  data-testid="inspection-pressure-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Odómetro</Label>
                <Input
                  type="number"
                  value={inspectionForm.odometer}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, odometer: e.target.value })}
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="irregular_wear"
                checked={inspectionForm.irregular_wear}
                onChange={(e) => setInspectionForm({ ...inspectionForm, irregular_wear: e.target.checked })}
                className="custom-checkbox"
              />
              <Label htmlFor="irregular_wear" className="text-sm cursor-pointer">
                Desgaste irregular detectado
              </Label>
            </div>
            {inspectionForm.irregular_wear && (
              <div className="space-y-2">
                <Label className="input-label">Tipo de Desgaste</Label>
                <Select
                  value={inspectionForm.wear_type}
                  onValueChange={(v) => setInspectionForm({ ...inspectionForm, wear_type: v })}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="centro">Desgaste en centro</SelectItem>
                    <SelectItem value="bordes">Desgaste en bordes</SelectItem>
                    <SelectItem value="diagonal">Desgaste diagonal</SelectItem>
                    <SelectItem value="plano">Desgaste plano</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInspectionDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleCreateInspection}
              disabled={!inspectionForm.depth1 || !inspectionForm.pressure || saving}
              data-testid="save-inspection-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar Inspección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TireSchemaPage;
