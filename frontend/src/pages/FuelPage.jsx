import React, { useState, useEffect } from 'react';
import { fuelApi, vehiclesApi, tripsApi } from '../services/api';
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
  Fuel,
  Plus,
  Loader2,
  Ticket,
  TrendingUp,
  AlertTriangle,
  Camera,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const FuelPage = () => {
  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState([]);
  const [loads, setLoads] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [conciliation, setConciliation] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  
  const [showVoucherDialog, setShowVoucherDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [voucherForm, setVoucherForm] = useState({
    voucher_number: '',
    vehicle_id: '',
    trip_id: '',
    provider: '',
    limit_liters: '',
    valid_from: '',
    valid_until: '',
  });
  
  const [loadForm, setLoadForm] = useState({
    vehicle_id: '',
    voucher_id: '',
    trip_id: '',
    liters: '',
    price_per_liter: '',
    odometer: '',
    provider: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vouchersRes, loadsRes, kpisRes, vehiclesRes, tripsRes] = await Promise.all([
        fuelApi.getVouchers(),
        fuelApi.getLoads(),
        fuelApi.getKPIs(),
        vehiclesApi.getAll({ vehicle_type: 'tracto' }),
        tripsApi.getAll({ status: 'en_curso' }),
      ]);
      setVouchers(vouchersRes.data);
      setLoads(loadsRes.data);
      setKpis(kpisRes.data);
      setVehicles(vehiclesRes.data);
      setTrips(tripsRes.data);
      
      // Get conciliation
      const concilRes = await fuelApi.getConciliation();
      setConciliation(concilRes.data);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateVoucher = async () => {
    setSaving(true);
    try {
      await fuelApi.createVoucher({
        ...voucherForm,
        limit_liters: parseFloat(voucherForm.limit_liters) || null,
      });
      toast.success('Vale creado exitosamente');
      setShowVoucherDialog(false);
      setVoucherForm({
        voucher_number: '',
        vehicle_id: '',
        trip_id: '',
        provider: '',
        limit_liters: '',
        valid_from: '',
        valid_until: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear vale');
    }
    setSaving(false);
  };

  const handleCreateLoad = async () => {
    setSaving(true);
    try {
      await fuelApi.createLoad({
        ...loadForm,
        liters: parseFloat(loadForm.liters),
        price_per_liter: parseFloat(loadForm.price_per_liter),
        odometer: parseInt(loadForm.odometer),
      });
      toast.success('Carga registrada exitosamente');
      setShowLoadDialog(false);
      setLoadForm({
        vehicle_id: '',
        voucher_id: '',
        trip_id: '',
        liters: '',
        price_per_liter: '',
        odometer: '',
        provider: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar carga');
    }
    setSaving(false);
  };

  const getVehiclePlate = (id) => {
    const v = vehicles.find(v => v.id === id);
    return v?.plate || '-';
  };

  return (
    <div className="space-y-6" data-testid="fuel-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Combustible
          </h1>
          <p className="text-slate-500 mt-1">
            Gestión de vales, cargas y KPIs de combustible
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowVoucherDialog(true)} data-testid="new-voucher-btn">
            <Ticket className="w-4 h-4 mr-2" />
            Nuevo Vale
          </Button>
          <Button className="btn-action" onClick={() => setShowLoadDialog(true)} data-testid="new-load-btn">
            <Fuel className="w-4 h-4 mr-2" />
            Registrar Carga
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {kpis?.vehicle_kpis?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white border-l-4 border-l-green-500">
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Mejor Rendimiento</p>
              <p className="font-heading text-3xl font-bold text-green-600 mt-1">
                {kpis.vehicle_kpis[0]?.km_per_gallon || 0} km/gal
              </p>
              <p className="text-sm text-slate-500">{kpis.vehicle_kpis[0]?.plate}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-l-4 border-l-blue-500">
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Costo Promedio/km</p>
              <p className="font-heading text-3xl font-bold text-blue-600 mt-1">
                S/ {(kpis.vehicle_kpis.reduce((a, b) => a + b.cost_per_km, 0) / kpis.vehicle_kpis.length).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white border-l-4 border-l-orange-500">
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Cargas Este Mes</p>
              <p className="font-heading text-3xl font-bold text-orange-600 mt-1">{loads.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-l-4 border-l-red-500">
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Sin Vale</p>
              <p className="font-heading text-3xl font-bold text-red-600 mt-1">
                {conciliation?.total_without_voucher || 0}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="vouchers">
        <TabsList className="bg-slate-100 rounded-sm">
          <TabsTrigger value="vouchers" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            Vales
          </TabsTrigger>
          <TabsTrigger value="loads" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            Cargas
          </TabsTrigger>
          <TabsTrigger value="kpis" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            KPIs
          </TabsTrigger>
        </TabsList>

        {/* Vouchers Tab */}
        <TabsContent value="vouchers" className="mt-4">
          <Card className="bg-white">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : vouchers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Ticket className="w-12 h-12 mb-2" />
                  <p>No hay vales registrados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>Número</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Límite (L)</TableHead>
                      <TableHead>Usado (L)</TableHead>
                      <TableHead>Vigencia</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.map((voucher) => (
                      <TableRow key={voucher.id} className="table-dense">
                        <TableCell className="font-mono font-bold">{voucher.voucher_number}</TableCell>
                        <TableCell>{getVehiclePlate(voucher.vehicle_id)}</TableCell>
                        <TableCell>{voucher.provider}</TableCell>
                        <TableCell>{voucher.limit_liters || '-'}</TableCell>
                        <TableCell>{voucher.used_liters?.toFixed(1) || 0}</TableCell>
                        <TableCell>
                          <span className="text-xs">
                            {format(new Date(voucher.valid_until), 'dd/MM/yyyy')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={voucher.is_used ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-800'}>
                            {voucher.is_used ? 'Usado' : 'Activo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loads Tab */}
        <TabsContent value="loads" className="mt-4">
          <Card className="bg-white">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : loads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Fuel className="w-12 h-12 mb-2" />
                  <p>No hay cargas registradas</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>Fecha</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Litros</TableHead>
                      <TableHead>Precio/L</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Odómetro</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Vale</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loads.map((load) => (
                      <TableRow key={load.id} className="table-dense">
                        <TableCell>
                          {format(new Date(load.load_date), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell className="font-mono">{getVehiclePlate(load.vehicle_id)}</TableCell>
                        <TableCell className="font-mono">{load.liters?.toFixed(2)}</TableCell>
                        <TableCell>S/ {load.price_per_liter?.toFixed(2)}</TableCell>
                        <TableCell className="font-bold">S/ {load.total_amount?.toFixed(2)}</TableCell>
                        <TableCell className="font-mono">{load.odometer?.toLocaleString()} km</TableCell>
                        <TableCell>{load.provider}</TableCell>
                        <TableCell>
                          {load.voucher_id ? (
                            <Badge className="bg-green-100 text-green-800">Con vale</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">Sin vale</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* KPIs Tab */}
        <TabsContent value="kpis" className="mt-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Rendimiento por Vehículo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!kpis?.vehicle_kpis?.length ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <TrendingUp className="w-12 h-12 mb-2" />
                  <p>No hay suficientes datos para calcular KPIs</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Km Recorridos</TableHead>
                      <TableHead>Litros Totales</TableHead>
                      <TableHead>km/galón</TableHead>
                      <TableHead>Costo/km</TableHead>
                      <TableHead>Cargas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpis.vehicle_kpis.map((kpi) => (
                      <TableRow key={kpi.vehicle_id} className="table-dense">
                        <TableCell className="font-mono font-bold">{kpi.plate}</TableCell>
                        <TableCell>{kpi.km_traveled?.toLocaleString()} km</TableCell>
                        <TableCell>{kpi.total_liters?.toFixed(1)} L</TableCell>
                        <TableCell>
                          <span className={`font-bold ${kpi.km_per_gallon > 5 ? 'text-green-600' : 'text-red-600'}`}>
                            {kpi.km_per_gallon} km/gal
                          </span>
                        </TableCell>
                        <TableCell>S/ {kpi.cost_per_km}</TableCell>
                        <TableCell>{kpi.loads_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Voucher Dialog */}
      <Dialog open={showVoucherDialog} onOpenChange={setShowVoucherDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nuevo Vale de Combustible
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Número de Vale *</Label>
                <Input
                  value={voucherForm.voucher_number}
                  onChange={(e) => setVoucherForm({ ...voucherForm, voucher_number: e.target.value })}
                  className="rounded-sm"
                  data-testid="voucher-number-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Vehículo *</Label>
                <Select value={voucherForm.vehicle_id} onValueChange={(v) => setVoucherForm({ ...voucherForm, vehicle_id: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Proveedor *</Label>
                <Input
                  value={voucherForm.provider}
                  onChange={(e) => setVoucherForm({ ...voucherForm, provider: e.target.value })}
                  placeholder="Grifo, estación..."
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Límite (Litros)</Label>
                <Input
                  type="number"
                  value={voucherForm.limit_liters}
                  onChange={(e) => setVoucherForm({ ...voucherForm, limit_liters: e.target.value })}
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Válido Desde *</Label>
                <Input
                  type="date"
                  value={voucherForm.valid_from}
                  onChange={(e) => setVoucherForm({ ...voucherForm, valid_from: e.target.value })}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Válido Hasta *</Label>
                <Input
                  type="date"
                  value={voucherForm.valid_until}
                  onChange={(e) => setVoucherForm({ ...voucherForm, valid_until: e.target.value })}
                  className="rounded-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVoucherDialog(false)}>Cancelar</Button>
            <Button 
              className="btn-action" 
              onClick={handleCreateVoucher}
              disabled={!voucherForm.voucher_number || !voucherForm.vehicle_id || !voucherForm.provider || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Vale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Load Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Registrar Carga de Combustible
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Vehículo *</Label>
                <Select value={loadForm.vehicle_id} onValueChange={(v) => setLoadForm({ ...loadForm, vehicle_id: v })}>
                  <SelectTrigger className="rounded-sm" data-testid="load-vehicle-select">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Vale (opcional)</Label>
                <Select value={loadForm.voucher_id || "none"} onValueChange={(v) => setLoadForm({ ...loadForm, voucher_id: v === "none" ? "" : v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Sin vale" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vale</SelectItem>
                    {vouchers.filter(v => !v.is_used && v.vehicle_id === loadForm.vehicle_id).map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.voucher_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Litros *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={loadForm.liters}
                  onChange={(e) => setLoadForm({ ...loadForm, liters: e.target.value })}
                  className="rounded-sm"
                  data-testid="load-liters-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Precio/L *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={loadForm.price_per_liter}
                  onChange={(e) => setLoadForm({ ...loadForm, price_per_liter: e.target.value })}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Total</Label>
                <Input
                  value={`S/ ${((parseFloat(loadForm.liters) || 0) * (parseFloat(loadForm.price_per_liter) || 0)).toFixed(2)}`}
                  disabled
                  className="rounded-sm bg-slate-50"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Odómetro *</Label>
                <Input
                  type="number"
                  value={loadForm.odometer}
                  onChange={(e) => setLoadForm({ ...loadForm, odometer: e.target.value })}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Proveedor *</Label>
                <Input
                  value={loadForm.provider}
                  onChange={(e) => setLoadForm({ ...loadForm, provider: e.target.value })}
                  placeholder="Nombre del grifo"
                  className="rounded-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadDialog(false)}>Cancelar</Button>
            <Button 
              className="btn-action" 
              onClick={handleCreateLoad}
              disabled={!loadForm.vehicle_id || !loadForm.liters || !loadForm.price_per_liter || !loadForm.odometer || !loadForm.provider || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Carga
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FuelPage;
