import React, { useState, useEffect } from 'react';
import { tripsApi, usersApi, vehiclesApi } from '../services/api';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
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
  Receipt,
  Plus,
  Loader2,
  Search,
  DollarSign,
  CheckCircle,
  AlertCircle,
  FileText,
  Truck,
  User,
  ArrowUpCircle,
  ArrowDownCircle,
  Calculator,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const SettlementsPage = () => {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripExpenses, setTripExpenses] = useState([]);
  const [tripAdvances, setTripAdvances] = useState([]);
  const [saving, setSaving] = useState(false);
  
  const [expenseForm, setExpenseForm] = useState({
    category: 'alimentacion',
    description: '',
    amount: '',
    provider: '',
    ruc: '',
    has_igv: false,
  });
  
  const [advanceForm, setAdvanceForm] = useState({
    amount: '',
    payment_method: 'efectivo',
    notes: '',
  });

  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    budget: '',
    days: '',
  });

  const expenseCategories = [
    { value: 'alimentacion', label: 'Alimentación', icon: '🍽️' },
    { value: 'hospedaje', label: 'Hospedaje', icon: '🏨' },
    { value: 'movilidad', label: 'Movilidad', icon: '🚕' },
    { value: 'peajes', label: 'Peajes', icon: '🛣️' },
    { value: 'parqueo', label: 'Parqueo', icon: '🅿️' },
    { value: 'combustible', label: 'Combustible', icon: '⛽' },
    { value: 'otros', label: 'Otros', icon: '📝' },
  ];

  const settlementStatuses = [
    { value: 'pending', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'en_revision', label: 'En Revisión', color: 'bg-blue-100 text-blue-700' },
    { value: 'aprobado', label: 'Aprobado', color: 'bg-green-100 text-green-700' },
    { value: 'cerrado', label: 'Cerrado', color: 'bg-slate-100 text-slate-700' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tripsRes, driversRes, vehiclesRes] = await Promise.all([
        tripsApi.getAll(),
        usersApi.getAll({ role: 'chofer' }),
        vehiclesApi.getAll(),
      ]);
      setTrips(tripsRes.data);
      setDrivers(driversRes.data);
      setVehicles(vehiclesRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchTripDetails = async (trip) => {
    try {
      const [expensesRes, advancesRes] = await Promise.all([
        api.get(`/trips/${trip.id}/expenses`),
        api.get(`/trips/${trip.id}/advances`),
      ]);
      setTripExpenses(expensesRes.data);
      setTripAdvances(advancesRes.data);
    } catch (error) {
      console.error('Error fetching trip details:', error);
      setTripExpenses([]);
      setTripAdvances([]);
    }
  };

  const handleOpenDetail = async (trip) => {
    setSelectedTrip(trip);
    await fetchTripDetails(trip);
    setShowDetailDialog(true);
  };

  const filteredTrips = trips.filter(trip => {
    const matchesSearch = trip.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         trip.cargo_description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || trip.settlement_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddExpense = async () => {
    if (!selectedTrip || !expenseForm.amount) {
      toast.error('El monto es requerido');
      return;
    }
    
    setSaving(true);
    try {
      await api.post(`/trips/${selectedTrip.id}/expenses`, {
        ...expenseForm,
        amount: parseFloat(expenseForm.amount),
      });
      toast.success('Gasto registrado');
      await fetchTripDetails(selectedTrip);
      setShowExpenseDialog(false);
      setExpenseForm({
        category: 'alimentacion',
        description: '',
        amount: '',
        provider: '',
        ruc: '',
        has_igv: false,
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar gasto');
    }
    setSaving(false);
  };

  const handleAddAdvance = async () => {
    if (!selectedTrip || !advanceForm.amount) {
      toast.error('El monto es requerido');
      return;
    }
    
    setSaving(true);
    try {
      await api.post(`/trips/${selectedTrip.id}/advances`, {
        ...advanceForm,
        amount: parseFloat(advanceForm.amount),
      });
      toast.success('Anticipo registrado');
      await fetchTripDetails(selectedTrip);
      setShowAdvanceDialog(false);
      setAdvanceForm({
        amount: '',
        payment_method: 'efectivo',
        notes: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar anticipo');
    }
    setSaving(false);
  };

  const handleCloseSettlement = async () => {
    if (!selectedTrip) return;
    
    setSaving(true);
    try {
      // First create/update the settlement to get the settlement_id
      const settlementRes = await api.post(`/trips/${selectedTrip.id}/settlement`, {});
      const settlementId = settlementRes.data.id;
      
      // Then close the settlement
      await api.post(`/settlements/${settlementId}/close`, {});
      toast.success('Liquidación cerrada');
      setShowDetailDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cerrar liquidación');
    }
    setSaving(false);
  };

  const handleSetBudget = async () => {
    if (!selectedTrip || !budgetForm.budget || !budgetForm.days) return;
    setSaving(true);
    try {
      await api.post(`/trips/${selectedTrip.id}/viatico-budget`, {
        budget: parseFloat(budgetForm.budget),
        days: parseInt(budgetForm.days),
      });
      toast.success('Presupuesto de viáticos asignado');
      setShowBudgetDialog(false);
      // Update selectedTrip locally first
      setSelectedTrip(prev => ({
        ...prev,
        viatico_budget: parseFloat(budgetForm.budget),
        viatico_days: parseInt(budgetForm.days),
        viatico_daily: Math.round(parseFloat(budgetForm.budget) / parseInt(budgetForm.days) * 100) / 100,
      }));
      setBudgetForm({ budget: '', days: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al asignar presupuesto');
    }
    setSaving(false);
  };

  const handleOpenBudget = (trip) => {
    setBudgetForm({
      budget: trip.viatico_budget?.toString() || '',
      days: trip.viatico_days?.toString() || '',
    });
    setShowBudgetDialog(true);
  };

  const getDriverName = (id) => drivers.find(d => d.id === id)?.name || '-';
  const getVehiclePlate = (id) => vehicles.find(v => v.id === id)?.plate || '-';
  const getStatusInfo = (status) => settlementStatuses.find(s => s.value === status) || settlementStatuses[0];
  const getCategoryInfo = (cat) => expenseCategories.find(c => c.value === cat) || expenseCategories[6];

  const totalAdvances = tripAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalExpenses = tripExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const balance = totalAdvances - totalExpenses;

  const pendingTrips = trips.filter(t => t.settlement_status === 'pending' || !t.settlement_status).length;
  const totalPendingAdvances = trips.filter(t => t.settlement_status === 'pending' || !t.settlement_status)
    .reduce((sum, t) => sum + (t.total_advance || 0), 0);

  return (
    <div className="space-y-6 page-fade-in" data-testid="settlements-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Viáticos y Liquidación
          </h1>
          <p className="text-slate-500 mt-1">
            Gestión de anticipos, gastos y liquidación de viajes
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-yellow-500 card-enter card-stagger-1">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Pendientes</p>
                <p className="font-heading text-3xl font-bold text-yellow-600 mt-1">{pendingTrips}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-blue-500 card-enter card-stagger-2">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Por Rendir</p>
                <p className="font-heading text-2xl font-bold text-blue-600 mt-1">
                  S/ {totalPendingAdvances.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-green-500 card-enter card-stagger-3">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Cerrados</p>
                <p className="font-heading text-3xl font-bold text-green-600 mt-1">
                  {trips.filter(t => t.settlement_status === 'cerrado').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-orange-500 card-enter card-stagger-4">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Viajes Totales</p>
                <p className="font-heading text-3xl font-bold text-orange-600 mt-1">{trips.length}</p>
              </div>
              <Truck className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white section-enter">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente o carga..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {settlementStatuses.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Trips Table */}
      <Card className="bg-white section-enter section-stagger-1">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Receipt className="w-12 h-12 mb-2" />
              <p>No hay viajes registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="table-dense">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Cliente/Carga</TableHead>
                  <TableHead>Viático/Día</TableHead>
                  <TableHead>Anticipo</TableHead>
                  <TableHead>Gastos</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrips.map((trip) => {
                  const tripBalance = (trip.total_advance || 0) - (trip.total_expenses || 0);
                  return (
                    <TableRow key={trip.id} className="table-dense">
                      <TableCell className="text-sm">
                        {format(new Date(trip.scheduled_date), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell className="font-mono">{getVehiclePlate(trip.tracto_id)}</TableCell>
                      <TableCell>{getDriverName(trip.driver_id)}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="font-medium truncate">{trip.client_name || '-'}</p>
                        <p className="text-xs text-slate-500 truncate">{trip.cargo_description || '-'}</p>
                      </TableCell>
                      <TableCell>
                        {trip.viatico_daily ? (
                          <div>
                            <span className="font-bold text-indigo-600">S/ {trip.viatico_daily.toFixed(2)}</span>
                            <p className="text-[10px] text-slate-400">{trip.viatico_days}d / S/{trip.viatico_budget?.toFixed(0)}</p>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-indigo-500 h-7 text-xs px-2"
                            onClick={() => { setSelectedTrip(trip); handleOpenBudget(trip); }}
                          >
                            + Asignar
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        S/ {(trip.total_advance || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        S/ {(trip.total_expenses || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className={tripBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        <span className="font-bold">S/ {Math.abs(tripBalance).toFixed(2)}</span>
                        <span className="text-xs ml-1">
                          {tripBalance >= 0 ? '(a favor)' : '(a rendir)'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusInfo(trip.settlement_status).color}>
                          {getStatusInfo(trip.settlement_status).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetail(trip)}
                        >
                          <Calculator className="w-4 h-4 mr-1" />
                          Liquidar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Settlement Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Liquidación de Viaje
            </DialogTitle>
          </DialogHeader>
          {selectedTrip && (
            <div className="py-4">
              {/* Trip Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 rounded-sm">
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">Fecha</p>
                  <p className="font-medium">
                    {format(new Date(selectedTrip.scheduled_date), 'dd/MM/yyyy', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">Vehículo</p>
                  <p className="font-mono font-medium">{getVehiclePlate(selectedTrip.tracto_id)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">Chofer</p>
                  <p className="font-medium">{getDriverName(selectedTrip.driver_id)}</p>
                </div>
              </div>

              {/* Viáticos Budget */}
              {selectedTrip.viatico_budget ? (
                <div className="mb-4 p-4 bg-indigo-50 rounded-sm border border-indigo-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs uppercase font-bold text-indigo-700 tracking-widest">Presupuesto de Viáticos</p>
                    {selectedTrip.settlement_status !== 'cerrado' && (
                      <Button size="sm" variant="outline" onClick={() => handleOpenBudget(selectedTrip)} className="h-7 text-xs">
                        Editar
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-indigo-600">Total Asignado</p>
                      <p className="font-heading text-xl font-bold text-indigo-700">S/ {selectedTrip.viatico_budget?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600">Días</p>
                      <p className="font-heading text-xl font-bold text-indigo-700">{selectedTrip.viatico_days}</p>
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600">Por Día</p>
                      <p className="font-heading text-xl font-bold text-indigo-700">S/ {selectedTrip.viatico_daily?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <Button
                    variant="outline"
                    className="w-full border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                    onClick={() => handleOpenBudget(selectedTrip)}
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    Asignar Presupuesto de Viáticos
                  </Button>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-xs uppercase text-green-700 font-bold">Anticipos</p>
                        <p className="font-heading text-xl font-bold text-green-600">
                          S/ {totalAdvances.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2">
                      <ArrowDownCircle className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-xs uppercase text-red-700 font-bold">Gastos</p>
                        <p className="font-heading text-xl font-bold text-red-600">
                          S/ {totalExpenses.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className={balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2">
                      <Calculator className={`w-5 h-5 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                      <div>
                        <p className={`text-xs uppercase font-bold ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                          {balance >= 0 ? 'A Favor Empresa' : 'A Favor Chofer'}
                        </p>
                        <p className={`font-heading text-xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                          S/ {Math.abs(balance).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs for Advances and Expenses */}
              <Tabs defaultValue="expenses">
                <div className="flex items-center justify-between mb-2">
                  <TabsList className="bg-slate-100 rounded-sm">
                    <TabsTrigger value="expenses" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs">
                      Gastos ({tripExpenses.length})
                    </TabsTrigger>
                    <TabsTrigger value="advances" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs">
                      Anticipos ({tripAdvances.length})
                    </TabsTrigger>
                  </TabsList>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowAdvanceDialog(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Anticipo
                    </Button>
                    <Button size="sm" className="btn-action" onClick={() => setShowExpenseDialog(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Gasto
                    </Button>
                  </div>
                </div>

                <TabsContent value="expenses">
                  {tripExpenses.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Receipt className="w-8 h-8 mx-auto mb-2" />
                      <p>No hay gastos registrados</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="table-dense">
                          <TableHead>Categoría</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>IGV</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tripExpenses.map((expense) => {
                          const catInfo = getCategoryInfo(expense.category);
                          return (
                            <TableRow key={expense.id} className="table-dense">
                              <TableCell>
                                <span className="mr-1">{catInfo.icon}</span>
                                {catInfo.label}
                              </TableCell>
                              <TableCell>{expense.description || '-'}</TableCell>
                              <TableCell>{expense.provider || '-'}</TableCell>
                              <TableCell>
                                {expense.has_igv ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-bold text-red-600">
                                S/ {expense.amount?.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="advances">
                  {tripAdvances.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <DollarSign className="w-8 h-8 mx-auto mb-2" />
                      <p>No hay anticipos registrados</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="table-dense">
                          <TableHead>Fecha</TableHead>
                          <TableHead>Método de Pago</TableHead>
                          <TableHead>Notas</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tripAdvances.map((advance) => (
                          <TableRow key={advance.id} className="table-dense">
                            <TableCell>
                              {format(new Date(advance.delivered_date || advance.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                            </TableCell>
                            <TableCell className="capitalize">{advance.payment_method}</TableCell>
                            <TableCell>{advance.notes || '-'}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              S/ {advance.amount?.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Cerrar</Button>
            {selectedTrip?.settlement_status !== 'cerrado' && (
              <Button 
                className="btn-action bg-green-600 hover:bg-green-700"
                onClick={handleCloseSettlement}
                disabled={saving}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <CheckCircle className="w-4 h-4 mr-2" />
                Cerrar Liquidación
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Registrar Gasto
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="input-label">Categoría *</Label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.icon} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Descripción</Label>
              <Input
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="rounded-sm"
                placeholder="Detalle del gasto..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Monto (S/) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="rounded-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Proveedor</Label>
                <Input
                  value={expenseForm.provider}
                  onChange={(e) => setExpenseForm({ ...expenseForm, provider: e.target.value })}
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">RUC</Label>
                <Input
                  value={expenseForm.ruc}
                  onChange={(e) => setExpenseForm({ ...expenseForm, ruc: e.target.value })}
                  className="rounded-sm"
                  placeholder="20XXXXXXXXX"
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="has_igv"
                  checked={expenseForm.has_igv}
                  onChange={(e) => setExpenseForm({ ...expenseForm, has_igv: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="has_igv" className="cursor-pointer">Incluye IGV</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpenseDialog(false)}>Cancelar</Button>
            <Button 
              className="btn-action"
              onClick={handleAddExpense}
              disabled={!expenseForm.amount || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Advance Dialog */}
      <Dialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Registrar Anticipo
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="input-label">Monto (S/) *</Label>
              <Input
                type="number"
                step="0.01"
                value={advanceForm.amount}
                onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                className="rounded-sm"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Método de Pago</Label>
              <Select value={advanceForm.payment_method} onValueChange={(v) => setAdvanceForm({ ...advanceForm, payment_method: v })}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="yape">Yape</SelectItem>
                  <SelectItem value="plin">Plin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Notas</Label>
              <Textarea
                value={advanceForm.notes}
                onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                className="rounded-sm"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdvanceDialog(false)}>Cancelar</Button>
            <Button 
              className="btn-action"
              onClick={handleAddAdvance}
              disabled={!advanceForm.amount || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Anticipo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Budget Dialog */}
      <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Presupuesto de Viáticos
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="input-label">Monto Total (S/) *</Label>
              <Input
                type="number"
                step="0.01"
                value={budgetForm.budget}
                onChange={(e) => setBudgetForm({ ...budgetForm, budget: e.target.value })}
                className="rounded-sm"
                placeholder="Ej: 2700"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Cantidad de Días *</Label>
              <Input
                type="number"
                min="1"
                value={budgetForm.days}
                onChange={(e) => setBudgetForm({ ...budgetForm, days: e.target.value })}
                className="rounded-sm"
                placeholder="Ej: 5"
              />
            </div>
            {budgetForm.budget && budgetForm.days && parseInt(budgetForm.days) > 0 && (
              <div className="p-4 bg-indigo-50 rounded-sm border border-indigo-200">
                <p className="text-xs uppercase font-bold text-indigo-700 mb-1">Cálculo por día</p>
                <p className="font-heading text-2xl font-bold text-indigo-700">
                  S/ {(parseFloat(budgetForm.budget) / parseInt(budgetForm.days)).toFixed(2)} / día
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBudgetDialog(false)}>Cancelar</Button>
            <Button
              className="btn-action"
              onClick={handleSetBudget}
              disabled={!budgetForm.budget || !budgetForm.days || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Asignar Presupuesto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettlementsPage;
