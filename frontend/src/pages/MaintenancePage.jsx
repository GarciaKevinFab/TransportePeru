import React, { useState, useEffect } from 'react';
import { maintenanceApi, vehiclesApi } from '../services/api';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
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
  DialogDescription,
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
  Wrench,
  Plus,
  Loader2,
  Play,
  CheckCircle,
  Clock,
  AlertTriangle,
  MoreVertical,
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

const MaintenancePage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'mantenimiento';
  
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    vehicle_id: '',
    order_type: 'correctivo',
    priority: 'normal',
    description: '',
    workshop: '',
    status: 'abierta',
  });
  
  const [completeData, setCompleteData] = useState({
    labor_cost: '',
    parts_cost: '',
    odometer: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, vehiclesRes] = await Promise.all([
        maintenanceApi.getWorkOrders(),
        vehiclesApi.getAll(),
      ]);
      setWorkOrders(ordersRes.data);
      setVehicles(vehiclesRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredOrders = statusFilter === 'all' 
    ? workOrders 
    : workOrders.filter(o => o.status === statusFilter);

  const handleCreateOrder = async () => {
    setSaving(true);
    try {
      await maintenanceApi.createWorkOrder(formData);
      toast.success('Orden de trabajo creada');
      setShowCreateDialog(false);
      setFormData({
        vehicle_id: '',
        order_type: 'correctivo',
        priority: 'normal',
        description: '',
        workshop: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear orden');
    }
    setSaving(false);
  };

  const handleStartOrder = async (orderId) => {
    try {
      await maintenanceApi.startWorkOrder(orderId, {});
      toast.success('Orden iniciada');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar orden');
    }
  };

  const handleCompleteOrder = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      await maintenanceApi.completeWorkOrder(selectedOrder.id, {
        labor_cost: parseFloat(completeData.labor_cost) || 0,
        parts_cost: parseFloat(completeData.parts_cost) || 0,
        odometer: parseInt(completeData.odometer) || 0,
        notes: completeData.notes,
      });
      toast.success('Orden completada');
      setShowCompleteDialog(false);
      setSelectedOrder(null);
      setCompleteData({ labor_cost: '', parts_cost: '', odometer: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al completar orden');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFormData({
      vehicle_id: '',
      order_type: 'correctivo',
      priority: 'normal',
      description: '',
      workshop: '',
      status: 'abierta',
    });
    setSelectedOrder(null);
  };

  const handleEditOrder = (order) => {
    setSelectedOrder(order);
    setFormData({
      vehicle_id: order.vehicle_id || '',
      order_type: order.order_type || 'correctivo',
      priority: order.priority || 'normal',
      description: order.description || '',
      workshop: order.workshop || '',
      status: order.status || 'abierta',
    });
    setShowEditDialog(true);
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      await api.put(`/maintenance/work-orders/${selectedOrder.id}`, formData);
      toast.success('Orden actualizada');
      setShowEditDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar orden');
    }
    setSaving(false);
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm('¿Eliminar esta orden de trabajo?')) return;
    try {
      await api.delete(`/maintenance/work-orders/${orderId}`);
      toast.success('Orden eliminada');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar orden');
    }
  };

  const getVehiclePlate = (id) => {
    const v = vehicles.find(v => v.id === id);
    return v?.plate || '-';
  };

  const getStatusBadge = (status) => {
    const styles = {
      abierta: 'bg-yellow-100 text-yellow-800',
      en_proceso: 'bg-blue-100 text-blue-800',
      completada: 'bg-green-100 text-green-800',
      cancelada: 'bg-red-100 text-red-800',
    };
    const labels = {
      abierta: 'Abierta',
      en_proceso: 'En Proceso',
      completada: 'Completada',
      cancelada: 'Cancelada',
    };
    return <Badge className={styles[status] || 'bg-slate-100'}>{labels[status] || status}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      baja: 'bg-slate-100 text-slate-700',
      normal: 'bg-blue-100 text-blue-700',
      alta: 'bg-orange-100 text-orange-700',
      critica: 'bg-red-100 text-red-700',
    };
    return <Badge className={styles[priority] || 'bg-slate-100'}>{priority.toUpperCase()}</Badge>;
  };

  const openOrders = workOrders.filter(o => o.status === 'abierta').length;
  const inProgressOrders = workOrders.filter(o => o.status === 'en_proceso').length;

  return (
    <div className="space-y-6" data-testid="maintenance-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Mantenimiento
          </h1>
          <p className="text-slate-500 mt-1">
            Órdenes de trabajo preventivas y correctivas
          </p>
        </div>
        <Button className="btn-action" onClick={() => setShowCreateDialog(true)} data-testid="new-workorder-btn">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Orden
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-yellow-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Abiertas</p>
                <p className="font-heading text-3xl font-bold text-yellow-600 mt-1">{openOrders}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-blue-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">En Proceso</p>
                <p className="font-heading text-3xl font-bold text-blue-600 mt-1">{inProgressOrders}</p>
              </div>
              <Wrench className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-green-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Completadas</p>
                <p className="font-heading text-3xl font-bold text-green-600 mt-1">
                  {workOrders.filter(o => o.status === 'completada').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-red-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Críticas</p>
                <p className="font-heading text-3xl font-bold text-red-600 mt-1">
                  {workOrders.filter(o => o.priority === 'critica' && o.status !== 'completada').length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="py-4">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] rounded-sm">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="abierta">Abiertas</SelectItem>
                <SelectItem value="en_proceso">En Proceso</SelectItem>
                <SelectItem value="completada">Completadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders Table */}
      <Card className="bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Wrench className="w-12 h-12 mb-2" />
              <p>No hay órdenes de trabajo</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="table-dense">
                  <TableHead>OT #</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} className="table-dense">
                    <TableCell className="font-mono font-bold">{order.order_number}</TableCell>
                    <TableCell>{getVehiclePlate(order.vehicle_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{order.order_type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{order.description}</TableCell>
                    <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>S/ {order.total_cost?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {order.status === 'abierta' && (
                            <DropdownMenuItem onClick={() => handleStartOrder(order.id)}>
                              <Play className="w-4 h-4 mr-2" />
                              Iniciar
                            </DropdownMenuItem>
                          )}
                          {order.status === 'en_proceso' && (
                            <DropdownMenuItem onClick={() => {
                              setSelectedOrder(order);
                              setShowCompleteDialog(true);
                            }}>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Completar
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nueva Orden de Trabajo
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="input-label">Vehículo *</Label>
              <Select value={formData.vehicle_id} onValueChange={(v) => setFormData({ ...formData, vehicle_id: v })}>
                <SelectTrigger className="rounded-sm" data-testid="ot-vehicle-select">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Tipo</Label>
                <Select value={formData.order_type} onValueChange={(v) => setFormData({ ...formData, order_type: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventivo">Preventivo</SelectItem>
                    <SelectItem value="correctivo">Correctivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Prioridad</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Descripción *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe el trabajo a realizar..."
                className="rounded-sm"
                rows={3}
                data-testid="ot-description-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Taller/Proveedor</Label>
              <Input
                value={formData.workshop}
                onChange={(e) => setFormData({ ...formData, workshop: e.target.value })}
                className="rounded-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button 
              className="btn-action" 
              onClick={handleCreateOrder}
              disabled={!formData.vehicle_id || !formData.description || saving}
              data-testid="save-ot-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Orden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Completar Orden {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Costo Mano de Obra</Label>
                <Input
                  type="number"
                  value={completeData.labor_cost}
                  onChange={(e) => setCompleteData({ ...completeData, labor_cost: e.target.value })}
                  placeholder="0.00"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Costo Repuestos</Label>
                <Input
                  type="number"
                  value={completeData.parts_cost}
                  onChange={(e) => setCompleteData({ ...completeData, parts_cost: e.target.value })}
                  placeholder="0.00"
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Odómetro al Servicio</Label>
              <Input
                type="number"
                value={completeData.odometer}
                onChange={(e) => setCompleteData({ ...completeData, odometer: e.target.value })}
                className="rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Notas</Label>
              <Textarea
                value={completeData.notes}
                onChange={(e) => setCompleteData({ ...completeData, notes: e.target.value })}
                className="rounded-sm"
                rows={3}
              />
            </div>
            <div className="p-4 bg-slate-50 rounded-sm">
              <p className="text-sm text-slate-500">Total estimado:</p>
              <p className="font-heading text-2xl font-bold text-slate-900">
                S/ {((parseFloat(completeData.labor_cost) || 0) + (parseFloat(completeData.parts_cost) || 0)).toFixed(2)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleCompleteOrder} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Completar Orden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaintenancePage;
