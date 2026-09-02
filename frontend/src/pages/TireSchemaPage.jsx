import React, { useState, useEffect, useCallback } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';
import {
  ArrowLeft,
  CircleDot,
  Loader2,
  Eye,
  Settings2,
  RotateCw,
  Move,
  BarChart3,
  Pencil,
  AlertTriangle,
  ChevronDown,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import TruckSchema from '../components/tires/TruckSchema';
import AxleConfigDialog from '../components/tires/AxleConfigDialog';
import { getRenderConfig, deriveAxleConfig } from '../components/tires/tireSchema';
import { EsqueletoPagina } from '../components/Esqueletos';

const TireSchemaPage = () => {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState(null);
  const [tires, setTires] = useState([]);
  const [availableTires, setAvailableTires] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [selectedTire, setSelectedTire] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);

  // Dialog states
  const [showMountDialog, setShowMountDialog] = useState(false);
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [showTireDetailsDialog, setShowTireDetailsDialog] = useState(false);
  const [showAxleConfigDialog, setShowAxleConfigDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAxles, setSavingAxles] = useState(false);
  // Inspection id being edited (null = creating a new inspection).
  const [editingInspectionId, setEditingInspectionId] = useState(null);
  
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vehicleRes, tiresRes, availableRes] = await Promise.all([
        vehiclesApi.getById(vehicleId),
        tiresApi.getByVehicle(vehicleId),
        tiresApi.getAll(),
      ]);
      setVehicle(vehicleRes.data);
      setTires(tiresRes.data);
      // Show tires that are not mounted on any vehicle (nuevo, almacen, reencauche)
      setAvailableTires(availableRes.data.filter(t =>
        !t.current_vehicle_id && t.status !== 'en_uso' && t.status !== 'baja'
      ));
    } catch (error) {
      toast.error('Error al cargar datos');
      navigate('/vehicles');
    }
    setLoading(false);
  }, [vehicleId, navigate]);

  // Diagnostics are optional: never block the page if the endpoint fails.
  const fetchDiagnostics = useCallback(async () => {
    try {
      const res = await tiresApi.getDiagnostics(vehicleId);
      setDiagnostics(res.data);
    } catch (error) {
      setDiagnostics(null);
    }
  }, [vehicleId]);

  // Equivalente al array [vehicleId] anterior: las dos funciones solo leen el
  // vehicleId de la URL (navigate es estable en react-router).
  useEffect(() => {
    fetchData();
    fetchDiagnostics();
  }, [fetchData, fetchDiagnostics]);

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

      const payload = {
        tire_id: selectedTire.id,
        vehicle_id: vehicleId,
        position_code: selectedTire.current_position,
        depths,
        pressure: parseFloat(inspectionForm.pressure) || 0,
        irregular_wear: inspectionForm.irregular_wear,
        wear_type: inspectionForm.wear_type || null,
        odometer: parseInt(inspectionForm.odometer) || vehicle?.odometer || 0,
        notes: inspectionForm.notes || null,
      };

      if (editingInspectionId) {
        await tiresApi.updateInspection(editingInspectionId, payload);
        toast.success('Inspección actualizada');
      } else {
        await tiresApi.createInspection(payload);
        toast.success('Inspección registrada');
      }
      setShowInspectionDialog(false);
      setEditingInspectionId(null);
      setInspectionForm({
        depth1: '', depth2: '', depth3: '', pressure: '',
        irregular_wear: false, wear_type: '', odometer: '', notes: '',
      });
      fetchData();
      fetchDiagnostics();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar inspección');
    }
    setSaving(false);
  };

  const openInspectionDialog = () => {
    setEditingInspectionId(null);
    setInspectionForm({
      depth1: '', depth2: '', depth3: '', pressure: '',
      irregular_wear: false, wear_type: '',
      odometer: vehicle?.odometer?.toString() || '0',
      notes: '',
    });
    setShowTireDetailsDialog(false);
    setShowInspectionDialog(true);
  };

  // Load the tire's last inspection into the form for editing. The inspection id
  // usually arrives in tire.last_inspection.id; if not, fall back to getInspections.
  const openEditInspectionDialog = async () => {
    if (!selectedTire) return;
    let insp = selectedTire.last_inspection;
    let inspId = insp?.id;
    if (!inspId) {
      try {
        const res = await tiresApi.getInspections(selectedTire.id);
        const list = res.data || [];
        insp = list[0] || insp;
        inspId = insp?.id;
      } catch (error) {
        // ignore — handled below
      }
    }
    if (!inspId) {
      toast.error('No hay inspección previa para editar');
      return;
    }
    const depths = insp?.depths || [];
    setEditingInspectionId(inspId);
    setInspectionForm({
      depth1: depths[0] != null ? String(depths[0]) : '',
      depth2: depths[1] != null ? String(depths[1]) : '',
      depth3: depths[2] != null ? String(depths[2]) : '',
      pressure: insp?.pressure != null ? String(insp.pressure) : '',
      irregular_wear: !!insp?.irregular_wear,
      wear_type: insp?.wear_type || '',
      odometer: insp?.odometer != null ? String(insp.odometer) : (vehicle?.odometer?.toString() || '0'),
      notes: insp?.notes || '',
    });
    setShowTireDetailsDialog(false);
    setShowInspectionDialog(true);
  };

  const handleSaveAxleConfig = async (axleConfig) => {
    setSavingAxles(true);
    try {
      await vehiclesApi.update(vehicleId, { axle_config: axleConfig });
      toast.success('Configuración de ejes guardada');
      setShowAxleConfigDialog(false);
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar configuración de ejes');
    }
    setSavingAxles(false);
  };

  const config = getRenderConfig(vehicle);
  const isTracto = vehicle?.vehicle_type === 'tracto';

  // Formatting helpers: null/undefined -> "—".
  const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v);
  const fmtNum = (v, digits = 0) =>
    v === null || v === undefined || Number.isNaN(Number(v))
      ? '—'
      : Number(v).toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const fmtMoney = (v) =>
    v === null || v === undefined || Number.isNaN(Number(v))
      ? '—'
      : `S/ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
  const fmtDate = (v) => {
    if (!v) return '—';
    try {
      return format(new Date(v), 'dd/MM/yyyy', { locale: es });
    } catch {
      return '—';
    }
  };
  const minDepth = (tire) => {
    const depths = tire?.last_inspection?.depths;
    if (!depths || !depths.length) return null;
    return Math.min(...depths);
  };
  const statusStyles = {
    critical: 'bg-red-100 text-red-700',
    warning: 'bg-yellow-100 text-yellow-700',
    good: 'bg-green-100 text-green-700',
    empty: 'bg-grafito-100 text-grafito-500',
  };
  const statusLabels = {
    critical: 'Crítica',
    warning: 'Alerta',
    good: 'OK',
    empty: '—',
  };
  const severityStyles = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    alta: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    media: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    info: 'bg-grafito-200 text-grafito-800 border-grafito-300',
    baja: 'bg-grafito-200 text-grafito-800 border-grafito-300',
    low: 'bg-grafito-200 text-grafito-800 border-grafito-300',
  };
  const severityClass = (sev) => severityStyles[String(sev || '').toLowerCase()] || 'bg-grafito-100 text-grafito-600 border-grafito-200';

  const suggestions = diagnostics?.suggestions || [];
  const axleIssues = diagnostics?.axle_issues || [];
  const hasDiagnostics = suggestions.length > 0 || axleIssues.length > 0;
  const axleHistory = vehicle?.axle_config_history || [];

  if (loading) {
    return (
      <EsqueletoPagina />
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
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-grafito-900">
            Llantas del Vehículo
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <Badge variant="outline" className="font-mono text-lg">
              {vehicle?.plate}
            </Badge>
            <span className="text-grafito-500">
              {vehicle?.brand} {vehicle?.model} - {vehicle?.vehicle_type === 'tracto' ? 'Tracto' : 'Carreta'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/vehicles/${vehicleId}/tires/rotate`)}
            data-testid="rotate-tires-btn"
          >
            <RotateCw className="w-4 h-4 mr-2" />
            Rotar
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/vehicles/${vehicleId}/tires/align`)}
            data-testid="align-tires-btn"
          >
            <Move className="w-4 h-4 mr-2" />
            Alinear
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/vehicles/${vehicleId}/tires/graphs`)}
            data-testid="tire-graphs-btn"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Gráficas
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAxleConfigDialog(true)}
            data-testid="configure-axles-btn"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Configurar ejes
          </Button>
        </div>
      </div>

      {/* Tire Schema */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
            Esquema de Llantas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TruckSchema
            config={config}
            isTracto={isTracto}
            getTireByPosition={getTireByPosition}
            getTireStatus={getTireStatus}
            onPositionClick={handlePositionClick}
          />
        </CardContent>
      </Card>

      {/* Diagnostics Panel */}
      {hasDiagnostics && (
        <Card className="bg-white" data-testid="tire-diagnostics-panel">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-marca-500" />
              Diagnósticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.length > 0 && (
              <div className="space-y-2">
                {suggestions.map((s, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-sm border ${severityClass(s.severity)}`}
                  >
                    <div className="flex-1">
                      <p className="font-bold text-sm">{s.action || s.title || 'Recomendación'}</p>
                      {s.description && (
                        <p className="text-xs mt-0.5 opacity-90">{s.description}</p>
                      )}
                      {s.position_code && (
                        <p className="text-xs mt-0.5 font-mono opacity-75">Pos: {s.position_code}</p>
                      )}
                    </div>
                    {s.severity && (
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {s.severity}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
            {axleIssues.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-grafito-400 tracking-widest">
                  Problemas por eje
                </p>
                {axleIssues.map((ai, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-sm border ${severityClass(ai.severity)}`}
                  >
                    <div className="flex-1">
                      <p className="font-bold text-sm">
                        {ai.axle || ai.axle_name || `Eje ${ai.axle_index ?? ''}`}
                      </p>
                      {ai.description && (
                        <p className="text-xs mt-0.5 opacity-90">{ai.description}</p>
                      )}
                    </div>
                    {ai.severity && (
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {ai.severity}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Axle config history */}
      {axleHistory.length > 0 && (
        <Collapsible>
          <Card className="bg-white">
            <CollapsibleTrigger className="w-full text-left" data-testid="axle-history-trigger">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Histórico de esquema ({axleHistory.length})
                </CardTitle>
                <ChevronDown className="w-4 h-4 text-grafito-400" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <ul className="space-y-2">
                  {axleHistory.map((h, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm border-b border-grafito-100 pb-2 last:border-0">
                      <span className="font-mono text-xs text-grafito-500 w-24 shrink-0">
                        {fmtDate(h.date || h.changed_at || h.created_at)}
                      </span>
                      <span className="text-grafito-700">
                        {h.changed_by_name || h.changed_by || h.user || 'Usuario'}
                      </span>
                      {h.note && <span className="text-grafito-400 text-xs">— {h.note}</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Tires List */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
            Llantas Montadas ({tires.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {tires.length === 0 ? (
            <div className="text-center py-8 text-grafito-400">
              <CircleDot className="w-12 h-12 mx-auto mb-2" />
              <p>No hay llantas montadas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="table-dense">
                  <TableHead>Pos</TableHead>
                  <TableHead>Cód</TableHead>
                  <TableHead>Llanta</TableHead>
                  <TableHead>Cód Vida</TableHead>
                  <TableHead>Fecha Montaje</TableHead>
                  <TableHead>Prof. (mm)</TableHead>
                  <TableHead>km Recorridos</TableHead>
                  <TableHead>Km Restantes</TableHead>
                  <TableHead>Costo/km</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tires.map((tire) => {
                  const status = getTireStatus(tire);
                  const md = minDepth(tire);
                  return (
                    <TableRow
                      key={tire.id}
                      className={`table-dense cursor-pointer ${
                        tire.needs_review
                          ? 'bg-amber-50 hover:bg-amber-100'
                          : 'hover:bg-grafito-50'
                      }`}
                      data-testid={tire.needs_review ? 'tire-row-review' : undefined}
                      onClick={() => {
                        setSelectedTire(tire);
                        setShowTireDetailsDialog(true);
                      }}
                    >
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {dash(tire.current_position)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-bold">{dash(tire.serial)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tire.brand} {tire.model}</p>
                          <p className="text-xs text-grafito-500">{dash(tire.dimension)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{dash(tire.cod_vida)}</TableCell>
                      <TableCell className="text-xs">{fmtDate(tire.mount_date)}</TableCell>
                      <TableCell className="font-mono">
                        {md === null ? '—' : `${md.toFixed(1)}`}
                      </TableCell>
                      <TableCell className="font-mono">{fmtNum(tire.km_recorridos)}</TableCell>
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-2">
                          <span>{fmtNum(tire.km_remaining)}</span>
                          {tire.needs_review && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 whitespace-nowrap">
                              <AlertTriangle className="w-3 h-3" />
                              Revisar
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{fmtMoney(tire.cost_per_km)}</TableCell>
                      <TableCell>
                        <Badge className={statusStyles[status]}>{statusLabels[status]}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
                <p className="text-xs text-grafito-500 uppercase font-bold">Marca</p>
                <p className="font-medium">{selectedTire?.brand}</p>
              </div>
              <div>
                <p className="text-xs text-grafito-500 uppercase font-bold">Modelo</p>
                <p className="font-medium">{selectedTire?.model || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-grafito-500 uppercase font-bold">Dimensión</p>
                <p className="font-medium">{selectedTire?.dimension}</p>
              </div>
              <div>
                <p className="text-xs text-grafito-500 uppercase font-bold">Vida</p>
                <p className="font-medium">
                  {selectedTire?.life_number === 1 ? 'Nueva' : `R${selectedTire?.life_number - 1}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-grafito-500 uppercase font-bold">Km Totales</p>
                <p className="font-medium font-mono">
                  {selectedTire?.total_km?.toLocaleString() || 0} km
                </p>
              </div>
            </div>
            
            {selectedTire?.last_inspection && (
              <div className="p-4 bg-grafito-50 rounded-sm">
                <p className="text-xs text-grafito-500 uppercase font-bold mb-2">Última Inspección</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-grafito-500">Profundidad:</span>{' '}
                    <span className="font-medium">
                      {Math.min(...selectedTire.last_inspection.depths).toFixed(1)}mm
                    </span>
                  </div>
                  <div>
                    <span className="text-grafito-500">Presión:</span>{' '}
                    <span className="font-medium">{selectedTire.last_inspection.pressure} PSI</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={openInspectionDialog} data-testid="new-inspection-btn">
              <Eye className="w-4 h-4 mr-2" />
              Nueva Inspección
            </Button>
            {selectedTire?.last_inspection && (
              <Button
                variant="outline"
                onClick={openEditInspectionDialog}
                data-testid="edit-inspection-btn"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar última inspección
              </Button>
            )}
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
      <Dialog
        open={showInspectionDialog}
        onOpenChange={(open) => {
          setShowInspectionDialog(open);
          if (!open) setEditingInspectionId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading font-bold uppercase">
              {editingInspectionId ? 'Editar Inspección' : 'Nueva Inspección'}
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
              {editingInspectionId ? 'Actualizar Inspección' : 'Guardar Inspección'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Axle Config Dialog */}
      <AxleConfigDialog
        open={showAxleConfigDialog}
        onOpenChange={setShowAxleConfigDialog}
        initialAxles={deriveAxleConfig(vehicle)}
        saving={savingAxles}
        onSave={handleSaveAxleConfig}
      />
    </div>
  );
};

export default TireSchemaPage;
