import React, { useState, useEffect } from 'react';
import { maintenanceApi, vehiclesApi } from '../services/api';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import MaintenancePlansPanel from '../components/MaintenancePlansPanel';
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
  X,
  FileSpreadsheet,
  ClipboardList,
  Gauge,
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
  const [activeTab, setActiveTab] = useState('orders');

  // Estado de mantenimiento preventivo por vehículo (km restantes, plan, alerta)
  const [maintStatuses, setMaintStatuses] = useState({});
  const [maintLoading, setMaintLoading] = useState(false);
  
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

  const [parts, setParts] = useState([]);

  // Auto-compute parts_cost from parts list
  const partsTotal = parts.reduce(
    (sum, p) => sum + (parseFloat(p.quantity) || 0) * (parseFloat(p.unit_cost) || 0),
    0
  );

  const todayISO = () => new Date().toISOString().substring(0, 10);

  const addPart = () => {
    setParts([
      ...parts,
      {
        name: '',
        quantity: 1,
        unit_cost: 0,
        installation_date: todayISO(),
        warranty_months: 6,
      },
    ]);
  };

  const updatePart = (index, field, value) => {
    const next = [...parts];
    next[index] = { ...next[index], [field]: value };
    setParts(next);
  };

  const removePart = (index) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const computeWarrantyExpires = (installation_date, warranty_months) => {
    if (!installation_date) return '';
    const date = new Date(installation_date);
    if (isNaN(date.getTime())) return '';
    const months = parseInt(warranty_months) || 0;
    date.setMonth(date.getMonth() + months);
    return date.toISOString().substring(0, 10);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, vehiclesRes] = await Promise.all([
        maintenanceApi.getWorkOrders(),
        vehiclesApi.getAll(),
      ]);
      setWorkOrders(ordersRes.data);
      setVehicles(vehiclesRes.data);
      fetchMaintStatuses(vehiclesRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    }
    setLoading(false);
  };

  // Carga el estado de mantenimiento de cada vehículo en paralelo.
  // Los vehículos sin plan asignado devuelven error/404 y se ignoran silenciosamente.
  const fetchMaintStatuses = async (vehicleList) => {
    if (!vehicleList || vehicleList.length === 0) return;
    setMaintLoading(true);
    const results = await Promise.allSettled(
      vehicleList.map((v) => maintenanceApi.getStatus(v.id))
    );
    const map = {};
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled' && res.value?.data) {
        map[vehicleList[idx].id] = res.value.data;
      }
    });
    setMaintStatuses(map);
    setMaintLoading(false);
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
      // Build items with derived warranty_expires_at and computed total
      const items = parts.map(p => {
        const qty = parseFloat(p.quantity) || 0;
        const unit = parseFloat(p.unit_cost) || 0;
        const months = parseInt(p.warranty_months) || 0;
        return {
          name: p.name,
          quantity: qty,
          unit_cost: unit,
          total_cost: qty * unit,
          installation_date: p.installation_date || todayISO(),
          warranty_months: months,
          warranty_expires_at: computeWarrantyExpires(p.installation_date || todayISO(), months),
        };
      });

      await maintenanceApi.completeWorkOrder(selectedOrder.id, {
        labor_cost: parseFloat(completeData.labor_cost) || 0,
        parts_cost: partsTotal,
        odometer: parseInt(completeData.odometer) || 0,
        notes: completeData.notes,
        items,
      });
      toast.success('Orden completada');
      setShowCompleteDialog(false);
      setSelectedOrder(null);
      setCompleteData({ labor_cost: '', parts_cost: '', odometer: '', notes: '' });
      setParts([]);
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
    <div className="space-y-6 page-fade-in" data-testid="maintenance-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Mantenimiento
          </h1>
          <p className="text-slate-500 mt-1">
            Órdenes de trabajo y planes preventivos por vehículo
          </p>
        </div>
        {activeTab === 'orders' && (
          <Button className="btn-action btn-press" onClick={() => setShowCreateDialog(true)} data-testid="new-workorder-btn">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Orden
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 rounded-sm">
          <TabsTrigger value="orders" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <ClipboardList className="w-4 h-4 mr-2" />
            Órdenes de Trabajo
          </TabsTrigger>
          <TabsTrigger value="plans" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Planes Preventivos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4 space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-yellow-500 card-enter card-stagger-1">
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
        <Card className="bg-white border-l-4 border-l-blue-500 card-enter card-stagger-2">
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
        <Card className="bg-white border-l-4 border-l-green-500 card-enter card-stagger-3">
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
        <Card className="bg-white border-l-4 border-l-red-500 card-enter card-stagger-4">
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

      {/* Estado de Mantenimiento Preventivo por Unidad */}
      <Card className="bg-white section-enter" data-testid="maintenance-status-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-tight text-slate-900">
            <Gauge className="w-5 h-5 text-slate-500" />
            Estado de Mantenimiento por Unidad
          </CardTitle>
          <p className="text-xs text-slate-500">Kilómetros restantes para el próximo servicio preventivo</p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {maintLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : Object.keys(maintStatuses).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Gauge className="w-10 h-10 mb-2" />
              <p className="text-sm">Sin planes preventivos asignados a vehículos</p>
              <p className="text-xs">Asigna un plan en la pestaña "Planes Preventivos"</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="table-dense">
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Odómetro Actual</TableHead>
                  <TableHead className="text-right">Próximo Servicio</TableHead>
                  <TableHead className="text-right">Km Restantes</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles
                  .filter((v) => maintStatuses[v.id])
                  .map((v) => {
                    const st = maintStatuses[v.id];
                    const kmRemaining = st.km_remaining;
                    return (
                      <TableRow key={v.id} className="table-dense">
                        <TableCell className="font-mono font-bold">{v.plate}</TableCell>
                        <TableCell className="text-slate-600">{st.plan_name || '-'}</TableCell>
                        <TableCell className="text-right font-mono">
                          {st.current_odometer != null ? `${Number(st.current_odometer).toLocaleString('es-PE')} km` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {st.next_service_km != null ? `${Number(st.next_service_km).toLocaleString('es-PE')} km` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {kmRemaining != null ? (
                            <span className={kmRemaining <= 0 ? 'text-red-600' : st.due_soon ? 'text-orange-600' : 'text-slate-900'}>
                              {Number(kmRemaining).toLocaleString('es-PE')} km
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {kmRemaining != null && kmRemaining <= 0 ? (
                            <Badge className="bg-red-100 text-red-800">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Servicio vencido
                            </Badge>
                          ) : st.due_soon ? (
                            <Badge className="bg-orange-100 text-orange-800">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Faltan {Number(kmRemaining).toLocaleString('es-PE')} km
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Al día
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-white section-enter">
        <CardContent className="py-4">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-sm">
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
      <Card className="bg-white section-enter section-stagger-1">
        <CardContent className="p-0 overflow-x-auto">
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
                          {isAdmin && order.status !== 'completada' && (
                            <DropdownMenuItem onClick={() => handleEditOrder(order)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {order.status === 'abierta' && (
                            <DropdownMenuItem onClick={() => handleStartOrder(order.id)}>
                              <Play className="w-4 h-4 mr-2" />
                              Iniciar
                            </DropdownMenuItem>
                          )}
                          {order.status === 'en_proceso' && (
                            <DropdownMenuItem onClick={() => {
                              setSelectedOrder(order);
                              setParts([]);
                              setCompleteData({ labor_cost: '', parts_cost: '', odometer: '', notes: '' });
                              setShowCompleteDialog(true);
                            }}>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Completar
                            </DropdownMenuItem>
                          )}
                          {isAdmin && order.status === 'abierta' && (
                            <DropdownMenuItem 
                              onClick={() => handleDeleteOrder(order.id)}
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

        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          <MaintenancePlansPanel vehicles={vehicles} />
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Completar Orden {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label className="input-label">Costo Repuestos (auto)</Label>
                <Input
                  type="number"
                  value={partsTotal.toFixed(2)}
                  disabled
                  className="rounded-sm bg-slate-50 font-bold"
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

            {/* Parts list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="input-label">Repuestos Utilizados</Label>
                <Button type="button" size="sm" variant="outline" onClick={addPart} className="btn-press">
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar Repuesto
                </Button>
              </div>
              {parts.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-sm">
                  Sin repuestos. Agregue uno con el botón superior.
                </p>
              ) : (
                <div className="space-y-2">
                  {parts.map((p, index) => {
                    const expires = computeWarrantyExpires(p.installation_date, p.warranty_months);
                    const lineTotal = (parseFloat(p.quantity) || 0) * (parseFloat(p.unit_cost) || 0);
                    return (
                      <div key={index} className="p-3 bg-slate-50 rounded-sm border border-slate-200 space-y-2 card-enter">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase">
                            Repuesto #{index + 1}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removePart(index)}
                            className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="sm:col-span-2 space-y-1">
                            <Label className="text-xs">Nombre *</Label>
                            <Input
                              value={p.name}
                              onChange={(e) => updatePart(index, 'name', e.target.value)}
                              className="rounded-sm h-8"
                              placeholder="Filtro de aceite, batería..."
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cantidad</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={p.quantity}
                              onChange={(e) => updatePart(index, 'quantity', e.target.value)}
                              className="rounded-sm h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Costo Unitario (S/)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={p.unit_cost}
                              onChange={(e) => updatePart(index, 'unit_cost', e.target.value)}
                              className="rounded-sm h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Fecha Instalación</Label>
                            <Input
                              type="date"
                              value={p.installation_date}
                              onChange={(e) => updatePart(index, 'installation_date', e.target.value)}
                              className="rounded-sm h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Garantía (meses)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={p.warranty_months}
                              onChange={(e) => updatePart(index, 'warranty_months', e.target.value)}
                              className="rounded-sm h-8"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                          <span className="text-slate-500">
                            Garantía vence: <strong>{expires || '-'}</strong>
                          </span>
                          <span className="font-bold text-slate-700">
                            S/ {lineTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                S/ {((parseFloat(completeData.labor_cost) || 0) + partsTotal).toFixed(2)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCompleteDialog(false); setParts([]); }}>Cancelar</Button>
            <Button className="btn-action" onClick={handleCompleteOrder} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Completar Orden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowEditDialog(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Editar Orden de Trabajo
            </DialogTitle>
            <DialogDescription>
              Modificar OT {selectedOrder?.order_number}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="input-label">Vehículo</Label>
              <Select value={formData.vehicle_id} onValueChange={(v) => setFormData({ ...formData, vehicle_id: v })}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Seleccionar vehículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.plate} - {v.brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Tipo</Label>
                <Select value={formData.order_type} onValueChange={(v) => setFormData({ ...formData, order_type: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correctivo">Correctivo</SelectItem>
                    <SelectItem value="preventivo">Preventivo</SelectItem>
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
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Estado</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abierta">Abierta</SelectItem>
                  <SelectItem value="en_proceso">En Proceso</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Taller</Label>
              <Input
                value={formData.workshop}
                onChange={(e) => setFormData({ ...formData, workshop: e.target.value })}
                placeholder="Nombre del taller"
                className="rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="rounded-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowEditDialog(false); }}>Cancelar</Button>
            <Button className="btn-action" onClick={handleUpdateOrder} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaintenancePage;
