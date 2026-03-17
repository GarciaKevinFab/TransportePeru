import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { vehiclesApi, usersApi } from '../services/api';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import {
  Truck,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Loader2,
  CircleDot,
  UserCheck,
  Shield,
  User,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const VehiclesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [filteredVehicles, setFilteredVehicles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAssignDriverDialog, setShowAssignDriverDialog] = useState(false);
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [equipmentItems, setEquipmentItems] = useState([]);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    plate: '',
    vehicle_type: 'tracto',
    brand: '',
    model: '',
    year: '',
    vin: '',
    color: '',
    fuel_capacity: '',
    tire_config: '6',
    status: 'disponible',
  });

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, driversRes] = await Promise.all([
        vehiclesApi.getAll(),
        usersApi.getAll({ role: 'chofer' }),
      ]);
      setVehicles(vehiclesRes.data);
      setFilteredVehicles(vehiclesRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      toast.error('Error al cargar vehículos');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    let filtered = vehicles;
    
    if (searchTerm) {
      filtered = filtered.filter(
        (v) =>
          v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.model?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter((v) => v.vehicle_type === typeFilter);
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter((v) => v.status === statusFilter);
    }
    
    setFilteredVehicles(filtered);
  }, [searchTerm, typeFilter, statusFilter, vehicles]);

  const handleCreateVehicle = async () => {
    setSaving(true);
    try {
      await vehiclesApi.create({
        ...formData,
        year: formData.year ? parseInt(formData.year) : null,
        fuel_capacity: formData.fuel_capacity ? parseFloat(formData.fuel_capacity) : null,
      });
      toast.success('Vehículo creado exitosamente');
      setShowCreateDialog(false);
      resetForm();
      fetchVehicles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear vehículo');
    }
    setSaving(false);
  };

  const handleDeleteVehicle = async () => {
    if (!selectedVehicle) return;
    setSaving(true);
    try {
      await vehiclesApi.delete(selectedVehicle.id);
      toast.success('Vehículo eliminado');
      setShowDeleteDialog(false);
      setSelectedVehicle(null);
      fetchVehicles();
    } catch (error) {
      toast.error('Error al eliminar vehículo');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFormData({
      plate: '',
      vehicle_type: 'tracto',
      brand: '',
      model: '',
      year: '',
      vin: '',
      color: '',
      fuel_capacity: '',
      tire_config: '6',
      status: 'disponible',
    });
    setSelectedVehicle(null);
  };

  const handleEditVehicle = (vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      plate: vehicle.plate || '',
      vehicle_type: vehicle.vehicle_type || 'tracto',
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      year: vehicle.year?.toString() || '',
      vin: vehicle.vin || '',
      color: vehicle.color || '',
      fuel_capacity: vehicle.fuel_capacity?.toString() || '',
      tire_config: vehicle.tire_config || '6',
      status: vehicle.status || 'disponible',
    });
    setShowEditDialog(true);
  };

  const handleUpdateVehicle = async () => {
    if (!selectedVehicle) return;
    setSaving(true);
    try {
      await api.put(`/vehicles/${selectedVehicle.id}`, {
        ...formData,
        year: formData.year ? parseInt(formData.year) : null,
        fuel_capacity: formData.fuel_capacity ? parseFloat(formData.fuel_capacity) : null,
      });
      toast.success('Vehículo actualizado');
      setShowEditDialog(false);
      resetForm();
      fetchVehicles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar vehículo');
    }
    setSaving(false);
  };

  const handleViewDetail = async (vehicle) => {
    setSelectedVehicle(vehicle);
    try {
      const res = await vehiclesApi.getEquipment(vehicle.id);
      setEquipmentItems(res.data.items || []);
    } catch {
      setEquipmentItems([]);
    }
    setShowDetailDialog(true);
  };

  const getDriverName = (driverId) => {
    if (!driverId) return null;
    const driver = drivers.find(d => d.id === driverId);
    return driver?.name || null;
  };

  const handleOpenAssignDriver = (vehicle) => {
    setSelectedVehicle(vehicle);
    setSelectedDriverId(vehicle.assigned_driver_id || 'none');
    setShowAssignDriverDialog(true);
  };

  const handleAssignDriver = async () => {
    if (!selectedVehicle) return;
    setSaving(true);
    const driverId = selectedDriverId === 'none' ? null : selectedDriverId;
    try {
      await vehiclesApi.assignDriver(selectedVehicle.id, driverId);
      toast.success(driverId ? 'Chofer asignado exitosamente' : 'Chofer desasignado');
      setShowAssignDriverDialog(false);
      setSelectedDriverId('none');
      fetchVehicles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al asignar chofer');
    }
    setSaving(false);
  };

  const handleOpenEquipment = async (vehicle) => {
    setSelectedVehicle(vehicle);
    try {
      const res = await vehiclesApi.getEquipment(vehicle.id);
      setEquipmentItems(res.data.items || []);
    } catch {
      setEquipmentItems([]);
    }
    setShowEquipmentDialog(true);
  };

  const handleSaveEquipment = async () => {
    if (!selectedVehicle) return;
    setSaving(true);
    try {
      await vehiclesApi.updateEquipment(selectedVehicle.id, { items: equipmentItems });
      toast.success('Equipamiento actualizado');
      setShowEquipmentDialog(false);
    } catch (error) {
      toast.error('Error al guardar equipamiento');
    }
    setSaving(false);
  };

  const updateEquipmentItem = (index, field, value) => {
    const updated = [...equipmentItems];
    updated[index] = { ...updated[index], [field]: value };
    setEquipmentItems(updated);
  };

  const getStatusBadge = (status) => {
    const styles = {
      disponible: 'bg-green-100 text-green-800 border-green-200',
      en_viaje: 'bg-blue-100 text-blue-800 border-blue-200',
      en_mantenimiento: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      fuera_servicio: 'bg-red-100 text-red-800 border-red-200',
    };
    const labels = {
      disponible: 'Disponible',
      en_viaje: 'En Viaje',
      en_mantenimiento: 'En Mantenimiento',
      fuera_servicio: 'Fuera de Servicio',
    };
    return (
      <Badge className={styles[status] || 'bg-slate-100 text-slate-800'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getTypeBadge = (type) => {
    return type === 'tracto' ? (
      <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">
        <Truck className="w-3 h-3 mr-1" />
        Tracto
      </Badge>
    ) : (
      <Badge variant="outline" className="border-slate-300 text-slate-700 bg-slate-50">
        <CircleDot className="w-3 h-3 mr-1" />
        Carreta
      </Badge>
    );
  };

  return (
    <div className="space-y-6" data-testid="vehicles-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Vehículos
          </h1>
          <p className="text-slate-500 mt-1">
            Gestión de tractos y carretas de la flota
          </p>
        </div>
        <Button className="btn-action" onClick={() => setShowCreateDialog(true)} data-testid="new-vehicle-btn">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Vehículo
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por placa, marca o modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-sm"
                data-testid="search-vehicles-input"
              />
            </div>
            <div className="flex gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] rounded-sm" data-testid="type-filter">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="tracto">Tracto</SelectItem>
                  <SelectItem value="carreta">Carreta</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] rounded-sm" data-testid="status-filter">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="en_viaje">En Viaje</SelectItem>
                  <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
                  <SelectItem value="fuera_servicio">Fuera de Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Truck className="w-12 h-12 mb-2" />
              <p>No se encontraron vehículos</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="table-dense">
                  <TableHead>Placa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Marca / Modelo</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead>Chofer Asignado</TableHead>
                  <TableHead>Odómetro</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => (
                  <TableRow key={vehicle.id} className="table-dense hover:bg-orange-50">
                    <TableCell>
                      <span className="font-mono font-bold text-slate-900">
                        {vehicle.plate}
                      </span>
                    </TableCell>
                    <TableCell>{getTypeBadge(vehicle.vehicle_type)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{vehicle.brand || '-'}</p>
                        <p className="text-xs text-slate-500">{vehicle.model || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getDriverName(vehicle.assigned_driver_id) ? (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-green-600" />
                          <span className="text-sm">{getDriverName(vehicle.assigned_driver_id)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>{vehicle.year || '-'}</TableCell>
                    <TableCell>
                      <span className="font-mono">
                        {vehicle.odometer?.toLocaleString() || 0} km
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`vehicle-actions-${vehicle.plate}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetail(vehicle)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalles
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => handleEditVehicle(vehicle)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => navigate(`/vehicles/${vehicle.id}/tires`)}>
                            <CircleDot className="w-4 h-4 mr-2" />
                            Ver Llantas
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => handleOpenAssignDriver(vehicle)}>
                              <UserCheck className="w-4 h-4 mr-2" />
                              Asignar Chofer
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleOpenEquipment(vehicle)}>
                            <Shield className="w-4 h-4 mr-2" />
                            Equipamiento EPP
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedVehicle(vehicle);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardContent className="py-4 text-center">
            <p className="font-heading text-3xl font-bold text-slate-900">
              {vehicles.filter((v) => v.vehicle_type === 'tracto').length}
            </p>
            <p className="text-xs uppercase tracking-widest text-slate-500 mt-1">Tractos</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="py-4 text-center">
            <p className="font-heading text-3xl font-bold text-slate-900">
              {vehicles.filter((v) => v.vehicle_type === 'carreta').length}
            </p>
            <p className="text-xs uppercase tracking-widest text-slate-500 mt-1">Carretas</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="py-4 text-center">
            <p className="font-heading text-3xl font-bold text-green-600">
              {vehicles.filter((v) => v.status === 'disponible').length}
            </p>
            <p className="text-xs uppercase tracking-widest text-slate-500 mt-1">Disponibles</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="py-4 text-center">
            <p className="font-heading text-3xl font-bold text-blue-600">
              {vehicles.filter((v) => v.status === 'en_viaje').length}
            </p>
            <p className="text-xs uppercase tracking-widest text-slate-500 mt-1">En Viaje</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nuevo Vehículo
            </DialogTitle>
            <DialogDescription>
              Ingresa los datos del nuevo vehículo
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Placa *</Label>
                <Input
                  value={formData.plate}
                  onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                  placeholder="ABC-123"
                  className="rounded-sm uppercase"
                  data-testid="vehicle-plate-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Tipo *</Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(v) => setFormData({ ...formData, vehicle_type: v })}
                >
                  <SelectTrigger className="rounded-sm" data-testid="vehicle-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tracto">Tracto</SelectItem>
                    <SelectItem value="carreta">Carreta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Marca</Label>
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="Volvo, Scania, etc."
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Modelo</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="FH16, R500, etc."
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Año</Label>
                <Input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="2024"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Color</Label>
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Blanco"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Cap. Combustible (L)</Label>
                <Input
                  type="number"
                  value={formData.fuel_capacity}
                  onChange={(e) => setFormData({ ...formData, fuel_capacity: e.target.value })}
                  placeholder="400"
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">VIN</Label>
              <Input
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                placeholder="Número de identificación vehicular"
                className="rounded-sm uppercase font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleCreateVehicle}
              disabled={!formData.plate || saving}
              data-testid="save-vehicle-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar el vehículo{' '}
              <strong>{selectedVehicle?.plate}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteVehicle}
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowEditDialog(open); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Editar Vehículo
            </DialogTitle>
            <DialogDescription>
              Modifica los datos del vehículo {selectedVehicle?.plate}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Placa *</Label>
                <Input
                  value={formData.plate}
                  onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                  placeholder="ABC-123"
                  className="rounded-sm uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Tipo *</Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(v) => setFormData({ ...formData, vehicle_type: v })}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tracto">Tracto</SelectItem>
                    <SelectItem value="carreta">Carreta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Marca</Label>
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="Volvo, Scania, etc."
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Modelo</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="FH16, R500, etc."
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Año</Label>
                <Input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="2024"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Color</Label>
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Blanco"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Cap. Combustible</Label>
                <Input
                  type="number"
                  value={formData.fuel_capacity}
                  onChange={(e) => setFormData({ ...formData, fuel_capacity: e.target.value })}
                  placeholder="400"
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">VIN</Label>
                <Input
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                  placeholder="VIN"
                  className="rounded-sm uppercase font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponible">Disponible</SelectItem>
                    <SelectItem value="en_viaje">En Viaje</SelectItem>
                    <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
                    <SelectItem value="fuera_servicio">Fuera de Servicio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowEditDialog(false); }}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleUpdateVehicle}
              disabled={!formData.plate || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Vehicle Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Detalle del Vehículo
            </DialogTitle>
            <DialogDescription>
              {selectedVehicle?.plate} - {selectedVehicle?.vehicle_type === 'tracto' ? 'Tracto' : 'Carreta'}
            </DialogDescription>
          </DialogHeader>
          {selectedVehicle && (
            <div className="py-4 space-y-4">
              {/* Vehicle Info */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">Placa</p>
                  <p className="font-mono font-bold text-lg">{selectedVehicle.plate}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">Marca / Modelo</p>
                  <p className="font-medium">{selectedVehicle.brand || '-'} {selectedVehicle.model || ''}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">Año</p>
                  <p className="font-medium">{selectedVehicle.year || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">VIN</p>
                  <p className="font-mono text-sm">{selectedVehicle.vin || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">Odómetro</p>
                  <p className="font-mono">{selectedVehicle.odometer?.toLocaleString() || 0} km</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">Estado</p>
                  {getStatusBadge(selectedVehicle.status)}
                </div>
              </div>

              {/* Assigned Driver */}
              <div className="p-3 bg-slate-50 rounded-sm">
                <p className="text-xs uppercase text-slate-500 font-bold mb-1">Chofer Asignado</p>
                {getDriverName(selectedVehicle.assigned_driver_id) ? (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-green-600" />
                    <span className="font-medium">{getDriverName(selectedVehicle.assigned_driver_id)}</span>
                  </div>
                ) : (
                  <span className="text-slate-400">Sin chofer asignado</span>
                )}
              </div>

              {/* EPP Summary */}
              <div>
                <p className="text-xs uppercase text-slate-500 font-bold mb-2">Equipamiento EPP</p>
                <div className="grid grid-cols-2 gap-2">
                  {equipmentItems.map((item) => (
                    <div key={item.name} className={`flex items-center justify-between p-2 rounded-sm text-sm ${
                      item.condition === 'bueno' ? 'bg-green-50 border border-green-200' :
                      item.condition === 'regular' ? 'bg-yellow-50 border border-yellow-200' :
                      item.condition === 'malo' || item.condition === 'vencido' ? 'bg-red-50 border border-red-200' :
                      'bg-slate-50 border border-slate-200'
                    }`}>
                      <span>{item.label || item.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{item.quantity}</Badge>
                        <span className={`text-xs capitalize ${
                          item.condition === 'bueno' ? 'text-green-600' :
                          item.condition === 'regular' ? 'text-yellow-600' :
                          item.condition === 'malo' || item.condition === 'vencido' ? 'text-red-600' :
                          'text-slate-400'
                        }`}>{item.condition}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              setShowDetailDialog(false);
              if (selectedVehicle) navigate(`/vehicles/${selectedVehicle.id}/tires`);
            }}>
              <CircleDot className="w-4 h-4 mr-2" />
              Ver Llantas
            </Button>
            <Button variant="outline" onClick={() => {
              setShowDetailDialog(false);
              if (selectedVehicle) handleOpenEquipment(selectedVehicle);
            }}>
              <Shield className="w-4 h-4 mr-2" />
              Editar EPP
            </Button>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Driver Dialog */}
      <Dialog open={showAssignDriverDialog} onOpenChange={setShowAssignDriverDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Asignar Chofer
            </DialogTitle>
            <DialogDescription>
              Vehículo: {selectedVehicle?.plate}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="input-label">Chofer</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Seleccionar chofer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} {d.license_number ? `(${d.license_number})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDriverDialog(false)}>Cancelar</Button>
            <Button
              className="btn-action"
              onClick={handleAssignDriver}
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Equipment EPP Dialog */}
      <Dialog open={showEquipmentDialog} onOpenChange={setShowEquipmentDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Equipamiento EPP
            </DialogTitle>
            <DialogDescription>
              Vehículo: {selectedVehicle?.plate} - {selectedVehicle?.brand} {selectedVehicle?.model}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow className="table-dense">
                  <TableHead>Elemento</TableHead>
                  <TableHead className="w-20">Cant.</TableHead>
                  <TableHead className="w-32">Estado</TableHead>
                  <TableHead className="w-36">Vencimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipmentItems.map((item, index) => (
                  <TableRow key={item.name} className="table-dense">
                    <TableCell className="font-medium">{item.label || item.name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateEquipmentItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="rounded-sm h-8 w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.condition}
                        onValueChange={(v) => updateEquipmentItem(index, 'condition', v)}
                      >
                        <SelectTrigger className="rounded-sm h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendiente">Pendiente</SelectItem>
                          <SelectItem value="bueno">Bueno</SelectItem>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="malo">Malo</SelectItem>
                          <SelectItem value="vencido">Vencido</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={item.expiry_date || ''}
                        onChange={(e) => updateEquipmentItem(index, 'expiry_date', e.target.value || null)}
                        className="rounded-sm h-8"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEquipmentDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleSaveEquipment} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar Equipamiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VehiclesPage;
