import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { vehiclesApi, usersApi, reportsApi, tiresApi } from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
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
  FileSpreadsheet,
  FileText,
  Loader2,
  Fuel,
  Wrench,
  Route,
  CircleDot,
  Wallet,
  Gauge,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import EncabezadoPagina from '../components/EncabezadoPagina';
import TarjetaMetrica from '../components/TarjetaMetrica';

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
  const [tiresReport, setTiresReport] = useState(null);
  const [viaticosReport, setViaticosReport] = useState(null);
  const [costPerKmReport, setCostPerKmReport] = useState(null);
  const [docsExpiringReport, setDocsExpiringReport] = useState(null);

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

  const buildParams = () => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return params;
  };

  const fetchTiresReport = async () => {
    setLoading(true);
    try {
      const res = await tiresApi.getRequiredReport();
      setTiresReport(res.data || {});
    } catch (error) {
      toast.error('Error al cargar reporte de llantas');
      setTiresReport({});
    }
    setLoading(false);
  };

  const fetchViaticosReport = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      if (selectedDriver !== 'all') params.driver_id = selectedDriver;
      const res = await reportsApi.viaticos(params);
      setViaticosReport(res.data || {});
    } catch (error) {
      toast.error('Error al cargar reporte de viáticos');
      setViaticosReport({});
    }
    setLoading(false);
  };

  const fetchCostPerKmReport = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      if (selectedVehicle !== 'all') params.vehicle_id = selectedVehicle;
      const res = await reportsApi.costPerKm(params);
      setCostPerKmReport(res.data || {});
    } catch (error) {
      toast.error('Error al cargar reporte de costo/km');
      setCostPerKmReport({});
    }
    setLoading(false);
  };

  const fetchDocsExpiringReport = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.documentsExpiring(buildParams());
      setDocsExpiringReport(res.data || {});
    } catch (error) {
      toast.error('Error al cargar documentos por vencer');
      setDocsExpiringReport({});
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
      case 'tires':
        fetchTiresReport();
        break;
      case 'viaticos':
        fetchViaticosReport();
        break;
      case 'cost_per_km':
        fetchCostPerKmReport();
        break;
      case 'docs_expiring':
        fetchDocsExpiringReport();
        break;
      default:
        break;
    }
  };

  // Exportación CSV en cliente (mismo patrón de descarga que el Excel del servidor).
  const exportCsv = (filename, headers, rows) => {
    if (!rows || rows.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    const escape = (val) => {
      const s = val === null || val === undefined ? '' : String(val);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(';'),
      ...rows.map((r) => r.map(escape).join(';')),
    ].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('CSV descargado exitosamente');
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
      <EncabezadoPagina
        titulo="Reportes"
        subtitulo="Generación y exportación de reportes del sistema"
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-grafito-100 rounded-sm">
          <TabsTrigger value="trips" className="rounded-sm data-[state=active]:bg-grafito-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <Route className="w-4 h-4 mr-2" />
            Viajes
          </TabsTrigger>
          <TabsTrigger value="fuel" className="rounded-sm data-[state=active]:bg-grafito-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <Fuel className="w-4 h-4 mr-2" />
            Combustible
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="rounded-sm data-[state=active]:bg-grafito-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <Wrench className="w-4 h-4 mr-2" />
            Mantenimiento
          </TabsTrigger>
          <TabsTrigger value="tires" className="rounded-sm data-[state=active]:bg-grafito-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <CircleDot className="w-4 h-4 mr-2" />
            Llantas
          </TabsTrigger>
          <TabsTrigger value="viaticos" className="rounded-sm data-[state=active]:bg-grafito-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <Wallet className="w-4 h-4 mr-2" />
            Viáticos
          </TabsTrigger>
          <TabsTrigger value="cost_per_km" className="rounded-sm data-[state=active]:bg-grafito-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <Gauge className="w-4 h-4 mr-2" />
            Costo/km
          </TabsTrigger>
          <TabsTrigger value="docs_expiring" className="rounded-sm data-[state=active]:bg-grafito-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <ShieldAlert className="w-4 h-4 mr-2" />
            Docs. por Vencer
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
              {(activeTab === 'trips' || activeTab === 'viaticos') && (
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
              {(activeTab === 'fuel' || activeTab === 'maintenance' || activeTab === 'cost_per_km') && (
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
                <TarjetaMetrica
                  titulo="Total Viajes"
                  valor={tripsReport.totals.count}
                  tono="neutro"
                />
                <TarjetaMetrica
                  titulo="Km Recorridos"
                  valor={tripsReport.totals.total_km.toLocaleString()}
                  tono="ok"
                />
                <TarjetaMetrica
                  titulo="Anticipos"
                  valor={<>S/ {tripsReport.totals.total_advances.toLocaleString()}</>}
                  tono="marca"
                />
                <TarjetaMetrica
                  titulo="Gastos"
                  valor={<>S/ {tripsReport.totals.total_expenses.toLocaleString()}</>}
                  tono="alerta"
                />
                <TarjetaMetrica
                  titulo="Balance"
                  valor={<>S/ {Math.abs(tripsReport.totals.balance).toLocaleString()}</>}
                  tono={tripsReport.totals.balance >= 0 ? 'ok' : 'alerta'}
                />
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
              <CardContent className="py-16 text-center text-grafito-400">
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
                <TarjetaMetrica
                  titulo="Total Cargas"
                  valor={fuelReport.totals.total_loads}
                  tono="neutro"
                />
                <TarjetaMetrica
                  titulo="Total Litros"
                  valor={fuelReport.totals.total_liters.toLocaleString()}
                  tono="ok"
                />
                <TarjetaMetrica
                  titulo="Total Gastado"
                  valor={<>S/ {fuelReport.totals.total_amount.toLocaleString()}</>}
                  tono="marca"
                />
                <TarjetaMetrica
                  titulo="Precio Promedio"
                  valor={<>S/ {fuelReport.totals.avg_price_per_liter.toFixed(2)}/L</>}
                  tono="neutro"
                />
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
              <CardContent className="py-16 text-center text-grafito-400">
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
                <TarjetaMetrica
                  titulo="Total OTs"
                  valor={maintenanceReport.totals.count}
                  tono="neutro"
                />
                <TarjetaMetrica
                  titulo="Costo Total"
                  valor={<>S/ {maintenanceReport.totals.total_cost.toLocaleString()}</>}
                  tono="marca"
                />
                <TarjetaMetrica
                  titulo="Completadas"
                  valor={maintenanceReport.by_status.completada || 0}
                  tono="ok"
                />
                <TarjetaMetrica
                  titulo="En Proceso"
                  valor={maintenanceReport.by_status.en_proceso || 0}
                  tono="aviso"
                />
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
                              wo.priority === 'alta' ? 'bg-marca-100 text-marca-700' :
                              'bg-grafito-100'
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
              <CardContent className="py-16 text-center text-grafito-400">
                <Wrench className="w-12 h-12 mx-auto mb-4" />
                <p>Seleccione los filtros y haga clic en "Generar" para ver el reporte</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tires Report */}
        <TabsContent value="tires" className="mt-4">
          {tiresReport ? (
            <>
              <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <div className="grid grid-cols-2 gap-4 flex-1 min-w-[240px]">
                  <TarjetaMetrica
                    titulo="A Reemplazar"
                    valor={tiresReport.total_replace || 0}
                    tono="alerta"
                  />
                  <TarjetaMetrica
                    titulo="A Reencauchar"
                    valor={tiresReport.total_retread || 0}
                    tono="aviso"
                  />
                </div>
                <Link to="/tires/required-by-dimension">
                  <Button variant="outline" data-testid="tires-by-dimension-link">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ver por dimensión
                  </Button>
                </Link>
              </div>

              {(() => {
                const groups = [
                  { key: 'replace_needed', label: 'A Reemplazar', color: 'text-red-600' },
                  { key: 'retread_needed', label: 'A Reencauchar', color: 'text-yellow-600' },
                ];
                const hasData = groups.some(
                  (g) => tiresReport[g.key] && Object.keys(tiresReport[g.key]).length > 0
                );
                if (!hasData) {
                  return (
                    <Card className="bg-white">
                      <CardContent className="py-16 text-center text-grafito-400">
                        <CircleDot className="w-12 h-12 mx-auto mb-4" />
                        <p>No hay llantas que requieran reemplazo o reencauche</p>
                      </CardContent>
                    </Card>
                  );
                }
                return groups.map((g) => {
                  const byDim = tiresReport[g.key] || {};
                  const dims = Object.keys(byDim);
                  if (dims.length === 0) return null;
                  return (
                    <Card key={g.key} className="bg-white section-enter mb-4">
                      <CardHeader>
                        <CardTitle className={`text-sm font-bold uppercase tracking-widest ${g.color}`}>
                          {g.label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="table-dense">
                              <TableHead>Dimensión</TableHead>
                              <TableHead>Código / Serie</TableHead>
                              <TableHead>Marca</TableHead>
                              <TableHead>Prof. (mm)</TableHead>
                              <TableHead>Vida</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dims.map((dim) =>
                              (byDim[dim] || []).map((t) => (
                                <TableRow key={t.id} className="table-dense">
                                  <TableCell className="font-mono">{dim}</TableCell>
                                  <TableCell className="font-mono">{t.code || t.serial || t.id?.substring(0, 8)}</TableCell>
                                  <TableCell>{t.brand || '-'}</TableCell>
                                  <TableCell>{t.last_depth ?? '-'}</TableCell>
                                  <TableCell>{t.life_number || 1}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  );
                });
              })()}
            </>
          ) : (
            <Card className="bg-white">
              <CardContent className="py-16 text-center text-grafito-400">
                <CircleDot className="w-12 h-12 mx-auto mb-4" />
                <p>Haga clic en "Generar" para ver el reporte de llantas</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Viáticos Report */}
        <TabsContent value="viaticos" className="mt-4">
          {viaticosReport ? (
            (() => {
              const rows = viaticosReport.rows || viaticosReport.drivers || viaticosReport.viaticos || [];
              const totals = viaticosReport.totals || {
                budget: rows.reduce((a, r) => a + (Number(r.budget) || 0), 0),
                spent: rows.reduce((a, r) => a + (Number(r.spent) || 0), 0),
                balance: rows.reduce((a, r) => a + (Number(r.balance) || 0), 0),
              };
              if (rows.length === 0) {
                return (
                  <Card className="bg-white">
                    <CardContent className="py-16 text-center text-grafito-400">
                      <Wallet className="w-12 h-12 mx-auto mb-4" />
                      <p>No hay datos de viáticos para el periodo seleccionado</p>
                    </CardContent>
                  </Card>
                );
              }
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <TarjetaMetrica
                      titulo="Presupuesto"
                      valor={<>S/ {(Number(totals.budget) || 0).toLocaleString()}</>}
                      tono="neutro"
                    />
                    <TarjetaMetrica
                      titulo="Gastado"
                      valor={<>S/ {(Number(totals.spent) || 0).toLocaleString()}</>}
                      tono="marca"
                    />
                    <TarjetaMetrica
                      titulo="Saldo"
                      valor={<>S/ {(Number(totals.balance) || 0).toLocaleString()}</>}
                      tono={(Number(totals.balance) || 0) >= 0 ? 'ok' : 'alerta'}
                    />
                  </div>
                  <Card className="bg-white section-enter">
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
                        Consolidado por Chofer
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          exportCsv(
                            'reporte_viaticos.csv',
                            ['Chofer', 'Periodo', 'Presupuesto', 'Gastado', 'Saldo', 'Viajes'],
                            rows.map((r) => [
                              r.driver_name || getDriverName(r.driver_id),
                              r.period || '',
                              Number(r.budget) || 0,
                              Number(r.spent) || 0,
                              Number(r.balance) || 0,
                              r.trips_count ?? '',
                            ])
                          )
                        }
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        CSV
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="table-dense">
                            <TableHead>Chofer</TableHead>
                            <TableHead>Periodo</TableHead>
                            <TableHead>Presupuesto</TableHead>
                            <TableHead>Gastado</TableHead>
                            <TableHead>Saldo</TableHead>
                            <TableHead>Viajes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r, i) => {
                            const balance = Number(r.balance) || 0;
                            return (
                              <TableRow key={r.driver_id || i} className="table-dense">
                                <TableCell>{r.driver_name || getDriverName(r.driver_id)}</TableCell>
                                <TableCell>{r.period || '-'}</TableCell>
                                <TableCell>S/ {(Number(r.budget) || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-marca-600">S/ {(Number(r.spent) || 0).toFixed(2)}</TableCell>
                                <TableCell className={balance >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                                  S/ {balance.toFixed(2)}
                                </TableCell>
                                <TableCell>{r.trips_count ?? '-'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              );
            })()
          ) : (
            <Card className="bg-white">
              <CardContent className="py-16 text-center text-grafito-400">
                <Wallet className="w-12 h-12 mx-auto mb-4" />
                <p>Seleccione los filtros y haga clic en "Generar" para ver el reporte</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Costo por Km Report */}
        <TabsContent value="cost_per_km" className="mt-4">
          {costPerKmReport ? (
            (() => {
              const rows = costPerKmReport.rows || costPerKmReport.vehicles || [];
              if (rows.length === 0) {
                return (
                  <Card className="bg-white">
                    <CardContent className="py-16 text-center text-grafito-400">
                      <Gauge className="w-12 h-12 mx-auto mb-4" />
                      <p>No hay datos de costo por km para el periodo seleccionado</p>
                    </CardContent>
                  </Card>
                );
              }
              const chartData = rows.map((r) => ({
                plate: r.plate || getVehiclePlate(r.vehicle_id),
                cpk: Number(r.cost_per_km) || 0,
              }));
              return (
                <>
                  <Card className="bg-white section-enter mb-4">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
                        Costo por Km (S/ / km)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e6e4e1" />
                            <XAxis dataKey="plate" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <RechartsTooltip formatter={(v) => `S/ ${Number(v).toFixed(2)}`} />
                            <Bar dataKey="cpk" fill="#e00000" radius={[4, 4, 0, 0]} name="Costo/km" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white section-enter">
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
                        Detalle por Unidad
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          exportCsv(
                            'reporte_costo_km.csv',
                            ['Vehículo', 'Km', 'Combustible', 'Llantas', 'Mantenimiento', 'Costo Total', 'Costo/km'],
                            rows.map((r) => [
                              r.plate || getVehiclePlate(r.vehicle_id),
                              Number(r.km) || 0,
                              Number(r.fuel_cost) || 0,
                              Number(r.tire_cost) || 0,
                              Number(r.maintenance_cost) || 0,
                              Number(r.total_cost) || 0,
                              Number(r.cost_per_km) || 0,
                            ])
                          )
                        }
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        CSV
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="table-dense">
                            <TableHead>Vehículo</TableHead>
                            <TableHead>Km</TableHead>
                            <TableHead>Combustible</TableHead>
                            <TableHead>Llantas</TableHead>
                            <TableHead>Mantenimiento</TableHead>
                            <TableHead>Costo Total</TableHead>
                            <TableHead>Costo/km</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r, i) => (
                            <TableRow key={r.vehicle_id || i} className="table-dense">
                              <TableCell className="font-mono">{r.plate || getVehiclePlate(r.vehicle_id)}</TableCell>
                              <TableCell>{(Number(r.km) || 0).toLocaleString()}</TableCell>
                              <TableCell>S/ {(Number(r.fuel_cost) || 0).toFixed(2)}</TableCell>
                              <TableCell>S/ {(Number(r.tire_cost) || 0).toFixed(2)}</TableCell>
                              <TableCell>S/ {(Number(r.maintenance_cost) || 0).toFixed(2)}</TableCell>
                              <TableCell className="font-bold">S/ {(Number(r.total_cost) || 0).toFixed(2)}</TableCell>
                              <TableCell className="font-bold text-marca-600">S/ {(Number(r.cost_per_km) || 0).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              );
            })()
          ) : (
            <Card className="bg-white">
              <CardContent className="py-16 text-center text-grafito-400">
                <Gauge className="w-12 h-12 mx-auto mb-4" />
                <p>Seleccione los filtros y haga clic en "Generar" para ver el reporte</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documentos por Vencer Report */}
        <TabsContent value="docs_expiring" className="mt-4">
          {docsExpiringReport ? (
            (() => {
              const rows = docsExpiringReport.documents || docsExpiringReport.rows || [];
              if (rows.length === 0) {
                return (
                  <Card className="bg-white">
                    <CardContent className="py-16 text-center text-grafito-400">
                      <ShieldAlert className="w-12 h-12 mx-auto mb-4" />
                      <p>No hay documentos próximos a vencer</p>
                    </CardContent>
                  </Card>
                );
              }
              const daysBadge = (days) => {
                const d = Number(days);
                if (Number.isNaN(d)) return <Badge variant="outline">-</Badge>;
                if (d < 0) return <Badge variant="outline" className="bg-red-100 text-red-700">Vencido ({Math.abs(d)}d)</Badge>;
                if (d <= 15) return <Badge variant="outline" className="bg-marca-100 text-marca-700">{d}d</Badge>;
                return <Badge variant="outline" className="bg-yellow-100 text-yellow-700">{d}d</Badge>;
              };
              return (
                <Card className="bg-white section-enter">
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
                      Documentos Próximos a Vencer / Vencidos
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportCsv(
                          'documentos_por_vencer.csv',
                          ['Tipo', 'Entidad', 'Placa/Identificación', 'Número', 'Vencimiento', 'Días'],
                          rows.map((r) => [
                            r.document_type_name || r.document_type || '',
                            r.entity_name || '',
                            r.plate || r.entity_identifier || '',
                            r.number || '',
                            (r.expiry_date || '').substring(0, 10),
                            r.days_until ?? r.days ?? '',
                          ])
                        )
                      }
                      data-testid="docs-expiring-export-btn"
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="table-dense">
                          <TableHead>Tipo</TableHead>
                          <TableHead>Entidad</TableHead>
                          <TableHead>Placa / ID</TableHead>
                          <TableHead>Número</TableHead>
                          <TableHead>Vencimiento</TableHead>
                          <TableHead>Días</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r, i) => (
                          <TableRow key={r.id || i} className="table-dense">
                            <TableCell>{r.document_type_name || r.document_type || '-'}</TableCell>
                            <TableCell>{r.entity_name || '-'}</TableCell>
                            <TableCell className="font-mono">{r.plate || r.entity_identifier || '-'}</TableCell>
                            <TableCell>{r.number || '-'}</TableCell>
                            <TableCell>{(r.expiry_date || '').substring(0, 10) || '-'}</TableCell>
                            <TableCell>{daysBadge(r.days_until ?? r.days)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })()
          ) : (
            <Card className="bg-white">
              <CardContent className="py-16 text-center text-grafito-400">
                <ShieldAlert className="w-12 h-12 mx-auto mb-4" />
                <p>Haga clic en "Generar" para ver los documentos por vencer</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
