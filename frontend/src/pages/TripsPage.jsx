import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripsApi, vehiclesApi, usersApi, routesApi } from '../services/api';
import api from '../services/api';
import { Card, CardContent } from '../components/ui/card';
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
import { Textarea } from '../components/ui/textarea';
import {
  Route,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Play,
  CheckCircle,
  Loader2,
  Truck,
  User,
  Calendar,
  MapPin,
  Edit,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

const TripsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    tracto_id: '',
    carreta_id: '',
    driver_id: '',
    route_id: '',
    client_name: '',
    cargo_description: '',
    cargo_weight: '',
    scheduled_date: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tripsRes, vehiclesRes, driversRes, routesRes] = await Promise.all([
        tripsApi.getAll(),
        vehiclesApi.getAll(),
        usersApi.getAll({ role: 'chofer' }),
        routesApi.getAll(),
      ]);
      setTrips(tripsRes.data);
      setFilteredTrips(tripsRes.data);
      setVehicles(vehiclesRes.data);
      setDrivers(driversRes.data);
      setRoutes(routesRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = trips;
    
    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          t.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.cargo_description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }
    
    setFilteredTrips(filtered);
  }, [searchTerm, statusFilter, trips]);

  const handleCreateTrip = async () => {
    setSaving(true);
    try {
      await tripsApi.create({
        ...formData,
        cargo_weight: formData.cargo_weight ? parseFloat(formData.cargo_weight) : null,
        scheduled_date: new Date(formData.scheduled_date).toISOString(),
      });
      toast.success('Viaje creado exitosamente');
      setShowCreateDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear viaje');
    }
    setSaving(false);
  };

  const handleStartTrip = async (tripId) => {
    try {
      await tripsApi.start(tripId, { km_start: 0 });
      toast.success('Viaje iniciado');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar viaje');
    }
  };

  const handleCompleteTrip = async (tripId) => {
    try {
      await tripsApi.complete(tripId, { km_end: 0 });
      toast.success('Viaje completado');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al completar viaje');
    }
  };

  const resetForm = () => {
    setFormData({
      tracto_id: '',
      carreta_id: '',
      driver_id: '',
      route_id: '',
      client_name: '',
      cargo_description: '',
      cargo_weight: '',
      scheduled_date: '',
      notes: '',
      status: 'programado',
    });
    setSelectedTrip(null);
  };

  const handleEditTrip = (trip) => {
    setSelectedTrip(trip);
    setFormData({
      tracto_id: trip.tracto_id || '',
      carreta_id: trip.carreta_id || '',
      driver_id: trip.driver_id || '',
      route_id: trip.route_id || '',
      client_name: trip.client_name || '',
      cargo_description: trip.cargo_description || '',
      cargo_weight: trip.cargo_weight?.toString() || '',
      scheduled_date: trip.scheduled_date ? trip.scheduled_date.substring(0, 16) : '',
      notes: trip.notes || '',
      status: trip.status || 'programado',
    });
    setShowEditDialog(true);
  };

  const handleUpdateTrip = async () => {
    if (!selectedTrip) return;
    setSaving(true);
    try {
      await api.put(`/trips/${selectedTrip.id}`, {
        ...formData,
        cargo_weight: formData.cargo_weight ? parseFloat(formData.cargo_weight) : null,
        scheduled_date: formData.scheduled_date ? new Date(formData.scheduled_date).toISOString() : null,
      });
      toast.success('Viaje actualizado');
      setShowEditDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar viaje');
    }
    setSaving(false);
  };

  const handleDeleteTrip = async (tripId) => {
    if (!confirm('¿Eliminar este viaje?')) return;
    try {
      await api.delete(`/trips/${tripId}`);
      toast.success('Viaje eliminado');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar viaje');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      programado: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      en_curso: 'bg-blue-100 text-blue-800 border-blue-200',
      completado: 'bg-green-100 text-green-800 border-green-200',
      cancelado: 'bg-red-100 text-red-800 border-red-200',
    };
    const labels = {
      programado: 'Programado',
      en_curso: 'En Curso',
      completado: 'Completado',
      cancelado: 'Cancelado',
    };
    return (
      <Badge className={styles[status] || 'bg-slate-100 text-slate-800'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getVehiclePlate = (id) => {
    const vehicle = vehicles.find((v) => v.id === id);
    return vehicle?.plate || '-';
  };

  const getDriverName = (id) => {
    const driver = drivers.find((d) => d.id === id);
    return driver?.name || '-';
  };

  const getRouteName = (id) => {
    const route = routes.find((r) => r.id === id);
    return route ? `${route.origin} → ${route.destination}` : '-';
  };

  const tractos = vehicles.filter((v) => v.vehicle_type === 'tracto' && v.status === 'disponible');
  const carretas = vehicles.filter((v) => v.vehicle_type === 'carreta' && v.status === 'disponible');

  return (
    <div className="space-y-6" data-testid="trips-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Viajes
          </h1>
          <p className="text-slate-500 mt-1">
            Gestión y seguimiento de viajes
          </p>
        </div>
        <Button className="btn-action" onClick={() => setShowCreateDialog(true)} data-testid="new-trip-btn">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Viaje
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente o carga..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-sm"
                data-testid="search-trips-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] rounded-sm" data-testid="status-filter">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="programado">Programado</SelectItem>
                <SelectItem value="en_curso">En Curso</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
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
          ) : filteredTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Route className="w-12 h-12 mb-2" />
              <p>No se encontraron viajes</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="table-dense">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Tracto</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrips.map((trip) => (
                  <TableRow key={trip.id} className="table-dense hover:bg-orange-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {format(new Date(trip.scheduled_date), 'dd/MM/yyyy', { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{trip.client_name || 'Sin cliente'}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[150px]">
                        {trip.cargo_description || '-'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="text-sm">{getRouteName(trip.route_id)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold">{getVehiclePlate(trip.tracto_id)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        {getDriverName(trip.driver_id)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(trip.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/trips/${trip.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalles
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => handleEditTrip(trip)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {trip.status === 'programado' && (
                            <DropdownMenuItem onClick={() => handleStartTrip(trip.id)}>
                              <Play className="w-4 h-4 mr-2" />
                              Iniciar Viaje
                            </DropdownMenuItem>
                          )}
                          {trip.status === 'en_curso' && (
                            <DropdownMenuItem onClick={() => handleCompleteTrip(trip.id)}>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Completar Viaje
                            </DropdownMenuItem>
                          )}
                          {isAdmin && trip.status !== 'en_curso' && (
                            <DropdownMenuItem 
                              onClick={() => handleDeleteTrip(trip.id)}
                              className="text-red-600"
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

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nuevo Viaje
            </DialogTitle>
            <DialogDescription>
              Programa un nuevo viaje asignando vehículo y chofer
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Tracto *</Label>
                <Select
                  value={formData.tracto_id}
                  onValueChange={(v) => setFormData({ ...formData, tracto_id: v })}
                >
                  <SelectTrigger className="rounded-sm" data-testid="trip-tracto-select">
                    <SelectValue placeholder="Seleccionar tracto" />
                  </SelectTrigger>
                  <SelectContent>
                    {tractos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          {v.plate} - {v.brand}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Carreta</Label>
                <Select
                  value={formData.carreta_id}
                  onValueChange={(v) => setFormData({ ...formData, carreta_id: v })}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar carreta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin carreta</SelectItem>
                    {carretas.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate} - {v.brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Chofer *</Label>
                <Select
                  value={formData.driver_id}
                  onValueChange={(v) => setFormData({ ...formData, driver_id: v })}
                >
                  <SelectTrigger className="rounded-sm" data-testid="trip-driver-select">
                    <SelectValue placeholder="Seleccionar chofer" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {d.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Ruta</Label>
                <Select
                  value={formData.route_id}
                  onValueChange={(v) => setFormData({ ...formData, route_id: v })}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar ruta" />
                  </SelectTrigger>
                  <SelectContent>
                    {routes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.distance_km} km)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Cliente</Label>
                <Input
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="Nombre del cliente"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Fecha Programada *</Label>
                <Input
                  type="datetime-local"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="rounded-sm"
                  data-testid="trip-date-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Descripción de Carga</Label>
                <Input
                  value={formData.cargo_description}
                  onChange={(e) => setFormData({ ...formData, cargo_description: e.target.value })}
                  placeholder="Tipo de carga"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Peso (kg)</Label>
                <Input
                  type="number"
                  value={formData.cargo_weight}
                  onChange={(e) => setFormData({ ...formData, cargo_weight: e.target.value })}
                  placeholder="25000"
                  className="rounded-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="input-label">Notas</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observaciones adicionales"
                className="rounded-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleCreateTrip}
              disabled={!formData.tracto_id || !formData.driver_id || !formData.scheduled_date || saving}
              data-testid="save-trip-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Viaje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowEditDialog(open); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Editar Viaje
            </DialogTitle>
            <DialogDescription>
              Modifica los datos del viaje
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Tracto</Label>
                <Select
                  value={formData.tracto_id}
                  onValueChange={(v) => setFormData({ ...formData, tracto_id: v })}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.filter(v => v.vehicle_type === 'tracto').map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.plate} - {t.brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Carreta</Label>
                <Select
                  value={formData.carreta_id || ""}
                  onValueChange={(v) => setFormData({ ...formData, carreta_id: v })}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin carreta</SelectItem>
                    {vehicles.filter(v => v.vehicle_type === 'carreta').map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.plate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Chofer</Label>
                <Select
                  value={formData.driver_id}
                  onValueChange={(v) => setFormData({ ...formData, driver_id: v })}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <SelectItem value="programado">Programado</SelectItem>
                    <SelectItem value="en_curso">En Curso</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Cliente</Label>
                <Input
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="Nombre del cliente"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Fecha Programada</Label>
                <Input
                  type="datetime-local"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Descripción de Carga</Label>
                <Input
                  value={formData.cargo_description}
                  onChange={(e) => setFormData({ ...formData, cargo_description: e.target.value })}
                  placeholder="Tipo de carga"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Peso (kg)</Label>
                <Input
                  type="number"
                  value={formData.cargo_weight}
                  onChange={(e) => setFormData({ ...formData, cargo_weight: e.target.value })}
                  placeholder="25000"
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Notas</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observaciones adicionales"
                className="rounded-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowEditDialog(false); }}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleUpdateTrip}
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TripsPage;
