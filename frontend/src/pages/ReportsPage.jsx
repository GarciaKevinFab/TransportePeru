import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { vehiclesApi, usersApi } from '../services/api';
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
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Truck,
  Fuel,
  Wrench,
  Route,
  Calendar,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ReportsPage = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trips');
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  
  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState('all');
  
  // Report data
  const [tripsReport, setTripsReport] = useState(null);
  const [fuelReport, setFuelReport] = useState(null);
  const [maintenanceReport, setMaintenanceReport] = useState(null);

  useEffect(() => {
    fetchBaseData();
  }, []);

  const fetchBaseData = async () => {
    try {
      const [vehiclesRes, driversRes] = await Promise.all([
        vehiclesApi.getAll(),
        usersApi.getAll({ role: 'chofer' }),
      ]);
      setVehicles(vehiclesRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      console.error('Error fetching base data:', error);
    }
  };

  const fetchTripsReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedDriver !== 'all') params.append('driver_id', selectedDriver);
      
      const res = await api.get(`/reports/trips?${params.toString()}`);
      setTripsReport(res.data);
    } catch (error) {
      toast.error('Error al cargar reporte de viajes');
    }
    setLoading(false);
  };

  const fetchFuelReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedVehicle !== 'all') params.append('vehicle_id', selectedVehicle);
      
      const res = await api.get(`/reports/fuel?${params.toString()}`);
      setFuelReport(res.data);
    } catch (error) {
      toast.error('Error al cargar reporte de combustible');
    }
    setLoading(false);
  };

  const fetchMaintenanceReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedVehicle !== 'all') params.append('vehicle_id', selectedVehicle);
      
      const res = await api.get(`/reports/maintenance?${params.toString()}`);
      setMaintenanceReport(res.data);
    } catch (error) {
      toast.error('Error al cargar reporte de mantenimiento');
    }
    setLoading(false);
  };

  const handleGenerateReport = () => {
    switch (activeTab) {
      case 'trips':
        fetchTripsReport();
        break;
      case 'fuel':
        fetchFuelReport();
        break;
      case 'maintenance':
        fetchMaintenanceReport();
        break;
      default:
        break;
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const response = await api.get(`/reports/trips/export/excel?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'reporte_viajes.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Excel descargado exitosamente');
    } catch (error) {
      toast.error('Error al exportar Excel');
    }
  };

  const handleExportPDF = async (tripId) => {
    try {
      const response = await api.get(`/reports/settlements/export/pdf/${tripId}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `liquidacion_${tripId.substring(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('PDF descargado exitosamente');
    } catch (error) {
      toast.error('Error al exportar PDF');
    }
  };

  const getVehiclePlate = (id) => vehicles.find(v => v.id === id)?.plate || '-';
  const getDriverName = (id) => drivers.find(d => d.id === id)?.name || '-';

  return (
    <div className="space-y-6 page-fade-in" data-testid="reports-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Reportes
          </h1>
          <p className="text-slate-500 mt-1">
            Generación y exportación de reportes del sistema
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 rounded-sm">
          <TabsTrigger value="trips" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <Route className="w-4 h-4 mr-2" />
            Viajes
          </TabsTrigger>
          <TabsTrigger value="fuel" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <Fuel className="w-4 h-4 mr-2" />
            Combustible
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <Wrench className="w-4 h-4 mr-2" />
            Mantenimiento
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <Card className="bg-white mt-4 section-enter">
          <CardContent className="py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Fecha Inicio</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Fecha Fin</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-sm"
                />
              </div>
              {activeTab === 'trips' && (
                <div className="space-y-2">
                  <Label className="input-label">Chofer</Label>
                  <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                    <SelectTrigger className="rounded-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {drivers.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(activeTab === 'fuel' || activeTab === 'maintenance') && (
                <div className="space-y-2">
                  <Label className="input-label">Vehículo</Label>
                  <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                    <SelectTrigger className="rounded-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {vehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Button className="btn-action btn-press" onClick={handleGenerateReport} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Generar
                </Button>
                {activeTab === 'trips' && tripsReport && (
                  <Button variant="outline" onClick={handleExportExcel}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Excel
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trips Report */}
        <TabsContent value="trips" className="mt-4">
          {tripsReport && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <Card className="bg-white border-l-4 border-l-blue-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total Viajes</p>
                    <p className="font-heading text-3xl font-bold text-blue-600 mt-1">{tripsReport.totals.count}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-green-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Km Recorridos</p>
                    <p className="font-heading text-2xl font-bold text-green-600 mt-1">{tripsReport.totals.total_km.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-orange-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Anticipos</p>
                    <p className="font-heading text-xl font-bold text-orange-600 mt-1">S/ {tripsReport.totals.total_advances.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-red-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Gastos</p>
                    <p className="font-heading text-xl font-bold text-red-600 mt-1">S/ {tripsReport.totals.total_expenses.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-slate-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Balance</p>
                    <p className={`font-heading text-xl font-bold mt-1 ${tripsReport.totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      S/ {Math.abs(tripsReport.totals.balance).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Table */}
              <Card className="bg-white section-enter">
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-dense">
                        <TableHead>Fecha</TableHead>
                        <TableHead>Vehículo</TableHead>
                        <TableHead>Chofer</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Km</TableHead>
                        <TableHead>Anticipo</TableHead>
                        <TableHead>Gastos</TableHead>
                        <TableHead className="text-right">PDF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tripsReport.trips.map((trip) => (
                        <TableRow key={trip.id} className="table-dense">
                          <TableCell>{trip.scheduled_date?.substring(0, 10)}</TableCell>
                          <TableCell className="font-mono">{trip.tracto_plate}</TableCell>
                          <TableCell>{trip.driver_name}</TableCell>
                          <TableCell>{trip.client_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{trip.status}</Badge>
                          </TableCell>
                          <TableCell>{((trip.km_end || 0) - (trip.km_start || 0)).toLocaleString()}</TableCell>
                          <TableCell className="text-green-600">S/ {(trip.total_advance || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-red-600">S/ {(trip.total_expenses || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => handleExportPDF(trip.id)}>
                              <FileText className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
          {!tripsReport && (
            <Card className="bg-white">
              <CardContent className="py-16 text-center text-slate-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-4" />
                <p>Seleccione los filtros y haga clic en "Generar" para ver el reporte</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Fuel Report */}
        <TabsContent value="fuel" className="mt-4">
          {fuelReport && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <Card className="bg-white border-l-4 border-l-blue-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total Cargas</p>
                    <p className="font-heading text-3xl font-bold text-blue-600 mt-1">{fuelReport.totals.total_loads}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-green-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total Litros</p>
                    <p className="font-heading text-2xl font-bold text-green-600 mt-1">{fuelReport.totals.total_liters.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-orange-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total Gastado</p>
                    <p className="font-heading text-xl font-bold text-orange-600 mt-1">S/ {fuelReport.totals.total_amount.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-slate-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Precio Promedio</p>
                    <p className="font-heading text-xl font-bold text-slate-600 mt-1">S/ {fuelReport.totals.avg_price_per_liter.toFixed(2)}/L</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white section-enter">
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-dense">
                        <TableHead>Fecha</TableHead>
                        <TableHead>Vehículo</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Litros</TableHead>
                        <TableHead>Precio/L</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Odómetro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fuelReport.loads.map((load) => (
                        <TableRow key={load.id} className="table-dense">
                          <TableCell>{load.load_date?.substring(0, 10)}</TableCell>
                          <TableCell className="font-mono">{getVehiclePlate(load.vehicle_id)}</TableCell>
                          <TableCell>{load.provider || '-'}</TableCell>
                          <TableCell>{load.liters?.toFixed(2)}</TableCell>
                          <TableCell>S/ {load.price_per_liter?.toFixed(2)}</TableCell>
                          <TableCell className="font-bold">S/ {load.total_amount?.toFixed(2)}</TableCell>
                          <TableCell>{load.odometer?.toLocaleString()} km</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
          {!fuelReport && (
            <Card className="bg-white">
              <CardContent className="py-16 text-center text-slate-400">
                <Fuel className="w-12 h-12 mx-auto mb-4" />
                <p>Seleccione los filtros y haga clic en "Generar" para ver el reporte</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Maintenance Report */}
        <TabsContent value="maintenance" className="mt-4">
          {maintenanceReport && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <Card className="bg-white border-l-4 border-l-blue-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total OTs</p>
                    <p className="font-heading text-3xl font-bold text-blue-600 mt-1">{maintenanceReport.totals.count}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-orange-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Costo Total</p>
                    <p className="font-heading text-xl font-bold text-orange-600 mt-1">S/ {maintenanceReport.totals.total_cost.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-green-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Completadas</p>
                    <p className="font-heading text-3xl font-bold text-green-600 mt-1">{maintenanceReport.by_status.completada || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-yellow-500">
                  <CardContent className="py-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">En Proceso</p>
                    <p className="font-heading text-3xl font-bold text-yellow-600 mt-1">{maintenanceReport.by_status.en_proceso || 0}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white section-enter">
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-dense">
                        <TableHead>Número</TableHead>
                        <TableHead>Vehículo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Prioridad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Costo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenanceReport.work_orders.map((wo) => (
                        <TableRow key={wo.id} className="table-dense">
                          <TableCell className="font-mono">{wo.order_number}</TableCell>
                          <TableCell className="font-mono">{getVehiclePlate(wo.vehicle_id)}</TableCell>
                          <TableCell className="capitalize">{wo.order_type}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{wo.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              wo.priority === 'critica' ? 'bg-red-100 text-red-700' :
                              wo.priority === 'alta' ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-100'
                            }>
                              {wo.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{wo.status}</Badge>
                          </TableCell>
                          <TableCell className="font-bold">S/ {(wo.total_cost || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
          {!maintenanceReport && (
            <Card className="bg-white">
              <CardContent className="py-16 text-center text-slate-400">
                <Wrench className="w-12 h-12 mx-auto mb-4" />
                <p>Seleccione los filtros y haga clic en "Generar" para ver el reporte</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
