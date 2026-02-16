import React, { useState, useEffect } from 'react';
import { tiresApi, vehiclesApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  CircleDot,
  Plus,
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle,
  Truck,
  RotateCcw,
  Gauge,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const TiresPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tires, setTires] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [requiredReport, setRequiredReport] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMountDialog, setShowMountDialog] = useState(false);
  const [selectedTire, setSelectedTire] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    serial: '',
    brand: '',
    model: '',
    dimension: '',
    purchase_cost: '',
    supplier: '',
  });
  
  const [mountData, setMountData] = useState({
    vehicle_id: '',
    position_code: '',
    mount_odometer: '',
  });

  const tireStatuses = [
    { value: 'nuevo', label: 'Nuevo', color: 'bg-green-100 text-green-700' },
    { value: 'en_uso', label: 'En Uso', color: 'bg-blue-100 text-blue-700' },
    { value: 'almacen', label: 'En Almacén', color: 'bg-slate-100 text-slate-700' },
    { value: 'reencauche', label: 'Reencauche', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'baja', label: 'Baja', color: 'bg-red-100 text-red-700' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tiresRes, vehiclesRes, reportRes] = await Promise.all([
        tiresApi.getAll(),
        vehiclesApi.getAll(),
        tiresApi.getRequiredReport(),
      ]);
      setTires(tiresRes.data);
      setVehicles(vehiclesRes.data);
      setRequiredReport(reportRes.data);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTires = tires.filter(tire => {
    const matchesSearch = tire.serial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tire.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tire.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateTire = async () => {
    if (!formData.serial || !formData.brand || !formData.dimension) {
      toast.error('Serial, marca y dimensión son requeridos');
      return;
    }
    
    setSaving(true);
    try {
      await tiresApi.create({
        ...formData,
        purchase_cost: parseFloat(formData.purchase_cost) || 0,
      });
      toast.success('Llanta registrada exitosamente');
      setShowCreateDialog(false);
      setFormData({
        serial: '',
        brand: '',
        model: '',
        dimension: '',
        purchase_cost: '',
        supplier: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear llanta');
    }
    setSaving(false);
  };

  const handleMountTire = async () => {
    if (!selectedTire || !mountData.vehicle_id || !mountData.position_code || !mountData.mount_odometer) {
      toast.error('Todos los campos son requeridos');
      return;
    }
    
    setSaving(true);
    try {
      await tiresApi.mount({
        tire_id: selectedTire.id,
        vehicle_id: mountData.vehicle_id,
        position_code: mountData.position_code,
        mount_odometer: parseInt(mountData.mount_odometer),
      });
      toast.success('Llanta montada exitosamente');
      setShowMountDialog(false);
      setSelectedTire(null);
      setMountData({ vehicle_id: '', position_code: '', mount_odometer: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al montar llanta');
    }
    setSaving(false);
  };

  const handleUnmountTire = async (tire) => {
    if (!confirm('¿Desmontar esta llanta del vehículo?')) return;
    
    try {
      const vehicle = vehicles.find(v => v.id === tire.current_vehicle_id);
      await tiresApi.unmount(tire.id, {
        unmount_odometer: vehicle?.odometer || 0,
        reason: 'Desmontaje manual',
      });
      toast.success('Llanta desmontada');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al desmontar llanta');
    }
  };

  const getVehiclePlate = (id) => vehicles.find(v => v.id === id)?.plate || '-';
  const getStatusInfo = (status) => tireStatuses.find(s => s.value === status) || tireStatuses[2];

  const inUseTires = tires.filter(t => t.status === 'en_uso').length;
  const storageTires = tires.filter(t => t.status === 'almacen' || t.status === 'nuevo').length;
  const criticalTires = requiredReport?.critical_depth || 0;
  const inspectionRequired = requiredReport?.inspection_required || 0;

  const positions = [
    'EJE1-IZQ', 'EJE1-DER', 
    'EJE2-IZQ-EXT', 'EJE2-IZQ-INT', 'EJE2-DER-INT', 'EJE2-DER-EXT',
    'EJE3-IZQ-EXT', 'EJE3-IZQ-INT', 'EJE3-DER-INT', 'EJE3-DER-EXT',
  ];

  return (
    <div className="space-y-6" data-testid="tires-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Gestión de Llantas
          </h1>
          <p className="text-slate-500 mt-1">
            Inventario, montaje, inspecciones y reportes de llantas
          </p>
        </div>
        <Button className="btn-action" onClick={() => setShowCreateDialog(true)} data-testid="new-tire-btn">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Llanta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-blue-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">En Uso</p>
                <p className="font-heading text-3xl font-bold text-blue-600 mt-1">{inUseTires}</p>
              </div>
              <Truck className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-slate-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">En Almacén</p>
                <p className="font-heading text-3xl font-bold text-slate-600 mt-1">{storageTires}</p>
              </div>
              <CircleDot className="w-8 h-8 text-slate-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-red-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Críticas</p>
                <p className="font-heading text-3xl font-bold text-red-600 mt-1">{criticalTires}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-yellow-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Inspección</p>
                <p className="font-heading text-3xl font-bold text-yellow-600 mt-1">{inspectionRequired}</p>
              </div>
              <Gauge className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory">
        <TabsList className="bg-slate-100 rounded-sm">
          <TabsTrigger value="inventory" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            Inventario
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            Por Vehículo
          </TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="mt-4">
          {/* Filters */}
          <Card className="bg-white mb-4">
            <CardContent className="py-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por serial o marca..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 rounded-sm"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] rounded-sm">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {tireStatuses.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : filteredTires.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <CircleDot className="w-12 h-12 mb-2" />
                  <p>No hay llantas registradas</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>Serial</TableHead>
                      <TableHead>Marca/Modelo</TableHead>
                      <TableHead>Dimensión</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Posición</TableHead>
                      <TableHead>Km Total</TableHead>
                      <TableHead>Vida</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTires.map((tire) => (
                      <TableRow key={tire.id} className="table-dense">
                        <TableCell className="font-mono font-bold">{tire.serial}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tire.brand}</p>
                            <p className="text-xs text-slate-500">{tire.model || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{tire.dimension}</TableCell>
                        <TableCell>
                          <Badge className={getStatusInfo(tire.status).color}>
                            {getStatusInfo(tire.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tire.current_vehicle_id ? getVehiclePlate(tire.current_vehicle_id) : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {tire.current_position || '-'}
                        </TableCell>
                        <TableCell>{tire.total_km?.toLocaleString() || 0} km</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {tire.life_number === 1 ? 'VN' : `R${tire.life_number - 1}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {tire.status === 'almacen' || tire.status === 'nuevo' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedTire(tire);
                                  setShowMountDialog(true);
                                }}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Montar
                              </Button>
                            ) : tire.status === 'en_uso' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnmountTire(tire)}
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Desmontar
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Vehicle Tab */}
        <TabsContent value="vehicles" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.filter(v => v.vehicle_type === 'tracto').map(vehicle => {
              const vehicleTires = tires.filter(t => t.current_vehicle_id === vehicle.id);
              return (
                <Card key={vehicle.id} className="bg-white hover:shadow-md transition-shadow cursor-pointer" 
                      onClick={() => navigate(`/vehicles/${vehicle.id}/tires`)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-mono text-lg">{vehicle.plate}</CardTitle>
                      <Badge variant="outline">{vehicleTires.length} llantas</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                      <Truck className="w-4 h-4" />
                      <span>{vehicle.brand} {vehicle.model}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Gauge className="w-4 h-4" />
                      <span>{vehicle.odometer?.toLocaleString() || 0} km</span>
                    </div>
                    <Button className="w-full mt-4" variant="outline" size="sm">
                      Ver Esquema de Llantas
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Tire Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nueva Llanta
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Serial *</Label>
                <Input
                  value={formData.serial}
                  onChange={(e) => setFormData({ ...formData, serial: e.target.value.toUpperCase() })}
                  className="rounded-sm uppercase"
                  placeholder="DOT XXXX XXXX"
                  data-testid="tire-serial-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Marca *</Label>
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="rounded-sm"
                  placeholder="Michelin, Goodyear..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Modelo</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Dimensión *</Label>
                <Input
                  value={formData.dimension}
                  onChange={(e) => setFormData({ ...formData, dimension: e.target.value })}
                  className="rounded-sm"
                  placeholder="295/80R22.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Costo (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.purchase_cost}
                  onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })}
                  className="rounded-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Proveedor</Label>
                <Input
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="rounded-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button 
              className="btn-action" 
              onClick={handleCreateTire}
              disabled={!formData.serial || !formData.brand || !formData.dimension || saving}
              data-testid="save-tire-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Llanta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mount Tire Dialog */}
      <Dialog open={showMountDialog} onOpenChange={setShowMountDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Montar Llanta
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedTire && (
              <div className="p-4 bg-slate-50 rounded-sm mb-4">
                <p className="text-sm text-slate-500">Llanta seleccionada:</p>
                <p className="font-mono font-bold text-lg">{selectedTire.serial}</p>
                <p className="text-sm text-slate-500">{selectedTire.brand} {selectedTire.dimension}</p>
              </div>
            )}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="input-label">Vehículo *</Label>
                <Select value={mountData.vehicle_id} onValueChange={(v) => setMountData({ ...mountData, vehicle_id: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate} - {v.brand} ({v.vehicle_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Posición *</Label>
                <Select value={mountData.position_code} onValueChange={(v) => setMountData({ ...mountData, position_code: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar posición" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Odómetro del Vehículo *</Label>
                <Input
                  type="number"
                  value={mountData.mount_odometer}
                  onChange={(e) => setMountData({ ...mountData, mount_odometer: e.target.value })}
                  className="rounded-sm"
                  placeholder="Kilometraje actual"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowMountDialog(false);
              setSelectedTire(null);
            }}>Cancelar</Button>
            <Button 
              className="btn-action" 
              onClick={handleMountTire}
              disabled={!mountData.vehicle_id || !mountData.position_code || !mountData.mount_odometer || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Montar Llanta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TiresPage;
