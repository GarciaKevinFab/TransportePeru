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
  Truck,
  RotateCcw,
  Gauge,
  History,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import EstadoVacio from '../components/EstadoVacio';

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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTire, setSelectedTire] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    serial: '', brand: '', model: '', dimension: '',
    purchase_cost: '', supplier: '', status: '', life_number: 1,
    position_type: 'toda_posicion',
  });

  const [formData, setFormData] = useState({
    serial: '',
    brand: '',
    model: '',
    dimension: '',
    purchase_cost: '',
    supplier: '',
    position_type: 'toda_posicion',
  });
  
  const [mountData, setMountData] = useState({
    vehicle_id: '',
    position_code: '',
    mount_odometer: '',
    mount_date: new Date().toISOString().substring(0, 10),
  });

  const positionTypes = [
    { value: 'direccional', label: 'Direccional' },
    { value: 'traccion', label: 'Tracción' },
    { value: 'toda_posicion', label: 'Toda posición' },
    { value: 'mixto', label: 'Mixto' },
  ];

  const tireStatuses = [
    { value: 'nuevo', label: 'Nuevo', color: 'bg-green-100 text-green-700' },
    { value: 'en_uso', label: 'En Uso', color: 'bg-blue-100 text-blue-700' },
    { value: 'almacen', label: 'En Almacén', color: 'bg-grafito-100 text-grafito-700' },
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
        position_type: 'toda_posicion',
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
        mount_date: mountData.mount_date
          ? new Date(mountData.mount_date).toISOString()
          : new Date().toISOString(),
      });
      toast.success('Llanta montada exitosamente');
      setShowMountDialog(false);
      setSelectedTire(null);
      setMountData({
        vehicle_id: '',
        position_code: '',
        mount_odometer: '',
        mount_date: new Date().toISOString().substring(0, 10),
      });
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

  const openEditDialog = (tire) => {
    setSelectedTire(tire);
    setEditData({
      serial: tire.serial || '',
      brand: tire.brand || '',
      model: tire.model || '',
      dimension: tire.dimension || '',
      purchase_cost: tire.purchase_cost || '',
      supplier: tire.supplier || '',
      status: tire.status || '',
      life_number: tire.life_number || 1,
      position_type: tire.position_type || 'toda_posicion',
    });
    setShowEditDialog(true);
  };

  const handleUpdateTire = async () => {
    if (!selectedTire) return;
    setSaving(true);
    try {
      await tiresApi.update(selectedTire.id, {
        ...editData,
        purchase_cost: parseFloat(editData.purchase_cost) || 0,
        life_number: parseInt(editData.life_number) || 1,
      });
      toast.success('Llanta actualizada');
      setShowEditDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar');
    }
    setSaving(false);
  };

  const handleDeleteTire = async (tire) => {
    if (!confirm(`¿Eliminar la llanta ${tire.serial}? Esta acción no se puede deshacer.`)) return;
    try {
      await tiresApi.delete(tire.id);
      toast.success('Llanta eliminada');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar llanta');
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

  /* Un solo cluster de acciones para la tabla (escritorio) y las tarjetas
     (movil), igual que AccionesViaje en TripsPage: una accion nueva aparece
     en ambas vistas o en ninguna. */
  const AccionesLlanta = ({ tire }) => (
    <div className="flex justify-end gap-2 flex-wrap">
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
      <Button
        size="sm"
        variant="outline"
        onClick={() => openEditDialog(tire)}
        title="Editar"
      >
        <Pencil className="w-4 h-4" />
      </Button>
      {!tire.current_vehicle_id && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDeleteTire(tire)}
          title="Eliminar"
          className="text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 page-fade-in" data-testid="tires-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-grafito-900">
            Gestión de Llantas
          </h1>
          <p className="text-grafito-500 mt-1">
            Inventario, montaje, inspecciones y reportes de llantas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/tires/lifecycle')}
            data-testid="tire-lifecycle-btn"
          >
            <History className="w-4 h-4 mr-2" />
            Ciclo de vida
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/tires/required-by-dimension')}
            data-testid="tire-required-btn"
          >
            <Gauge className="w-4 h-4 mr-2" />
            Llantas requeridas
          </Button>
          <Button className="btn-action btn-press" onClick={() => setShowCreateDialog(true)} data-testid="new-tire-btn">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Llanta
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-blue-500 card-enter card-stagger-1">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">En Uso</p>
                <p className="font-heading text-3xl font-bold text-blue-600 mt-1">{inUseTires}</p>
              </div>
              <Truck className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-grafito-500 card-enter card-stagger-2">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">En Almacén</p>
                <p className="font-heading text-3xl font-bold text-grafito-600 mt-1">{storageTires}</p>
              </div>
              <CircleDot className="w-8 h-8 text-grafito-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-red-500 card-enter card-stagger-3">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">Críticas</p>
                <p className="font-heading text-3xl font-bold text-red-600 mt-1">{criticalTires}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-yellow-500 card-enter card-stagger-4">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">Inspección</p>
                <p className="font-heading text-3xl font-bold text-yellow-600 mt-1">{inspectionRequired}</p>
              </div>
              <Gauge className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory">
        <TabsList className="bg-grafito-100 rounded-sm">
          <TabsTrigger value="inventory" className="rounded-sm data-[state=active]:bg-grafito-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            Inventario
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="rounded-sm data-[state=active]:bg-grafito-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-grafito-400" />
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

          <Card className="bg-white section-enter">
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-marca-500" />
                </div>
              ) : filteredTires.length === 0 ? (
                tires.length > 0 ? (
                  <EstadoVacio
                    icono={CircleDot}
                    titulo="Sin resultados"
                    texto="Ninguna llanta coincide con la búsqueda o el filtro."
                    filtrado
                  />
                ) : (
                  <EstadoVacio
                    icono={CircleDot}
                    titulo="Registra tu primera llanta"
                    texto="Cada llanta se sigue por serial: montajes, kilómetros, inspecciones y reencauches. Regístrala aquí y luego móntala en un vehículo."
                    accion={{ texto: 'Nueva llanta', onClick: () => setShowCreateDialog(true) }}
                  />
                )
              ) : (
                <>
                {/* Movil: tarjetas. Nueve columnas en 375px esconden estado y
                    acciones tras un arrastre lateral que nadie descubre. */}
                <div className="md:hidden divide-y divide-grafito-100 dark:divide-grafito-800">
                  {filteredTires.map((tire) => (
                    <div key={tire.id} className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold">{tire.serial}</span>
                        <Badge className={getStatusInfo(tire.status).color}>
                          {getStatusInfo(tire.status).label}
                        </Badge>
                        <Badge variant="outline">
                          {tire.life_number === 1 ? 'VN' : `R${tire.life_number - 1}`}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-grafito-500">
                        {[tire.brand, tire.model, tire.dimension].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-grafito-500">
                        <span>{tire.total_km?.toLocaleString() || 0} km</span>
                        {tire.current_vehicle_id && (
                          <span className="font-mono">
                            {getVehiclePlate(tire.current_vehicle_id)}
                            {tire.current_position ? ` · ${tire.current_position}` : ''}
                          </span>
                        )}
                      </p>
                      <div className="mt-2">
                        <AccionesLlanta tire={tire} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Escritorio: la tabla de siempre */}
                <div className="hidden md:block">
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
                            <p className="text-xs text-grafito-500">{tire.model || '-'}</p>
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
                          <AccionesLlanta tire={tire} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Vehicle Tab */}
        <TabsContent value="vehicles" className="mt-4">
          {!loading && vehicles.filter(v => v.vehicle_type === 'tracto').length === 0 && (
            <Card className="bg-white">
              <CardContent className="p-0">
                <EstadoVacio
                  icono={Truck}
                  titulo="Antes de ver llantas por vehículo, registra tus tractos"
                  texto="Esta vista muestra el esquema de llantas de cada tracto. Carga primero tu flota y vuelve aquí."
                  enlace={{ texto: 'Ir a Vehículos', onClick: () => navigate('/vehicles') }}
                />
              </CardContent>
            </Card>
          )}
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
                    <div className="flex items-center gap-2 text-sm text-grafito-500 mb-2">
                      <Truck className="w-4 h-4" />
                      <span>{vehicle.brand} {vehicle.model}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-grafito-500">
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
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nueva Llanta
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label className="input-label">Tipo de posición</Label>
              <Select
                value={formData.position_type}
                onValueChange={(v) => setFormData({ ...formData, position_type: v })}
              >
                <SelectTrigger className="rounded-sm" data-testid="tire-position-type-select">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {positionTypes.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Edit Tire Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Editar Llanta {selectedTire?.serial}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Serial *</Label>
                <Input value={editData.serial} onChange={(e) => setEditData({ ...editData, serial: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Marca *</Label>
                <Input value={editData.brand} onChange={(e) => setEditData({ ...editData, brand: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Modelo</Label>
                <Input value={editData.model} onChange={(e) => setEditData({ ...editData, model: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Dimensión *</Label>
                <Input value={editData.dimension} onChange={(e) => setEditData({ ...editData, dimension: e.target.value })} className="rounded-sm" placeholder="295/80R22.5" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Costo de Compra</Label>
                <Input type="number" value={editData.purchase_cost} onChange={(e) => setEditData({ ...editData, purchase_cost: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Proveedor</Label>
                <Input value={editData.supplier} onChange={(e) => setEditData({ ...editData, supplier: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Estado</Label>
                <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                  <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nuevo">Nuevo</SelectItem>
                    <SelectItem value="almacen">En Almacén</SelectItem>
                    <SelectItem value="en_uso">En Uso</SelectItem>
                    <SelectItem value="reparacion">En Reparación</SelectItem>
                    <SelectItem value="reencauche">Reencauche</SelectItem>
                    <SelectItem value="descartada">Descartada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Vida (1=VN, 2=R1, ...)</Label>
                <Input type="number" min="1" max="5" value={editData.life_number} onChange={(e) => setEditData({ ...editData, life_number: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Tipo de posición</Label>
                <Select value={editData.position_type} onValueChange={(v) => setEditData({ ...editData, position_type: v })}>
                  <SelectTrigger className="rounded-sm"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {positionTypes.map((pt) => (
                      <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedTire?.current_vehicle_id && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-800">
                <strong>Esta llanta está montada</strong> en {getVehiclePlate(selectedTire.current_vehicle_id)} posición {selectedTire.current_position}.
                Para cambiar vehículo o posición, primero desmonte y vuelva a montar.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button
              className="btn-action btn-press"
              onClick={handleUpdateTire}
              disabled={!editData.serial || !editData.brand || !editData.dimension || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mount Tire Dialog */}
      <Dialog open={showMountDialog} onOpenChange={setShowMountDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Montar Llanta
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedTire && (
              <div className="p-4 bg-grafito-50 rounded-sm mb-4">
                <p className="text-sm text-grafito-500">Llanta seleccionada:</p>
                <p className="font-mono font-bold text-lg">{selectedTire.serial}</p>
                <p className="text-sm text-grafito-500">{selectedTire.brand} {selectedTire.dimension}</p>
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
              <div className="space-y-2">
                <Label className="input-label">Fecha de Montaje *</Label>
                <Input
                  type="date"
                  value={mountData.mount_date}
                  onChange={(e) => setMountData({ ...mountData, mount_date: e.target.value })}
                  className="rounded-sm"
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
