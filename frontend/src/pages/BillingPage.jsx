import React, { useState, useEffect } from 'react';
import api, { tripsApi, vehiclesApi, usersApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  FileText,
  Truck as TruckIcon,
  Plus,
  Loader2,
  Send,
  Search,
  Receipt,
  Settings,
  Save,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BillingPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('guias');

  // Data
  const [guias, setGuias] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [sunatConfig, setSunatConfig] = useState({});

  // Dialogs
  const [showGuiaDialog, setShowGuiaDialog] = useState(false);
  const [showFacturaDialog, setShowFacturaDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Forms
  const [guiaForm, setGuiaForm] = useState({
    trip_id: '',
    remitente_ruc: '', remitente_razon_social: '',
    destinatario_ruc: '', destinatario_razon_social: '',
    punto_partida: '', punto_partida_ubigeo: '',
    punto_llegada: '', punto_llegada_ubigeo: '',
    descripcion_carga: '', peso_bruto: '', num_bultos: '',
  });

  const [facturaForm, setFacturaForm] = useState({
    trip_id: '',
    cliente_ruc: '', cliente_razon_social: '', cliente_direccion: '',
    items: [{ descripcion: '', cantidad: 1, precio_unitario: 0 }],
  });

  const [configForm, setConfigForm] = useState({
    ruc: '', razon_social: '',
    api_provider: 'nubefact',
    api_url: '', api_token: '',
    production: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [guiasRes, facturasRes, tripsRes, vehiclesRes, driversRes] = await Promise.all([
        api.get('/guias').catch(() => ({ data: [] })),
        api.get('/facturas').catch(() => ({ data: [] })),
        tripsApi.getAll(),
        vehiclesApi.getAll(),
        usersApi.getAll({ role: 'chofer' }),
      ]);
      setGuias(guiasRes.data);
      setFacturas(facturasRes.data);
      setTrips(tripsRes.data);
      setVehicles(vehiclesRes.data);
      setDrivers(driversRes.data);

      // Load SUNAT config
      try {
        const configRes = await api.get('/config/sunat');
        setSunatConfig(configRes.data);
        setConfigForm(prev => ({ ...prev, ...configRes.data }));
      } catch {}
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  // Auto-fill guía from trip
  const handleTripSelectGuia = (tripId) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    const vehicle = vehicles.find(v => v.id === trip.tracto_id);
    const driver = drivers.find(d => d.id === trip.driver_id);

    setGuiaForm(prev => ({
      ...prev,
      trip_id: tripId,
      punto_partida: trip.origin || '',
      punto_llegada: trip.destination || '',
      vehiculo_placa: vehicle?.plate || '',
      conductor_dni: driver?.dni || '',
      conductor_nombre: driver?.name || '',
      conductor_licencia: driver?.license_number || '',
      descripcion_carga: trip.cargo_description || '',
      peso_bruto: trip.cargo_weight?.toString() || '',
      destinatario_ruc: trip.client_ruc || '',
      destinatario_razon_social: trip.client_name || '',
    }));
  };

  const handleTripSelectFactura = (tripId) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    setFacturaForm(prev => ({
      ...prev,
      trip_id: tripId,
      cliente_ruc: trip.client_ruc || '',
      cliente_razon_social: trip.client_name || '',
      items: [{
        descripcion: `Servicio de transporte - ${trip.origin || ''} a ${trip.destination || ''}`,
        cantidad: 1,
        precio_unitario: trip.freight_amount || 0,
      }],
    }));
  };

  // Create guía
  const handleCreateGuia = async () => {
    if (!guiaForm.destinatario_razon_social) {
      toast.error('Ingresa el destinatario');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/guias', {
        ...guiaForm,
        peso_bruto: guiaForm.peso_bruto ? parseFloat(guiaForm.peso_bruto) : null,
        num_bultos: guiaForm.num_bultos ? parseInt(guiaForm.num_bultos) : null,
        transportista_ruc: sunatConfig.ruc || configForm.ruc,
        transportista_razon_social: sunatConfig.razon_social || configForm.razon_social,
      });
      toast.success(`Guía ${res.data.numero} creada`);
      setShowGuiaDialog(false);
      setGuiaForm({ trip_id: '', remitente_ruc: '', remitente_razon_social: '', destinatario_ruc: '', destinatario_razon_social: '', punto_partida: '', punto_partida_ubigeo: '', punto_llegada: '', punto_llegada_ubigeo: '', descripcion_carga: '', peso_bruto: '', num_bultos: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear guía');
    }
    setSaving(false);
  };

  // Create factura
  const handleCreateFactura = async () => {
    if (!facturaForm.cliente_ruc) {
      toast.error('Ingresa el RUC del cliente');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/facturas', facturaForm);
      toast.success(`Factura ${res.data.numero} creada - Total: S/ ${res.data.total}`);
      setShowFacturaDialog(false);
      setFacturaForm({ trip_id: '', cliente_ruc: '', cliente_razon_social: '', cliente_direccion: '', items: [{ descripcion: '', cantidad: 1, precio_unitario: 0 }] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear factura');
    }
    setSaving(false);
  };

  // Emit to SUNAT
  const handleEmit = async (type, id) => {
    setSaving(true);
    try {
      await api.post(`/${type}/${id}/emit`);
      toast.success('Documento emitido');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al emitir');
    }
    setSaving(false);
  };

  // Save config
  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await api.put('/config/sunat', configForm);
      toast.success('Configuración SUNAT guardada');
      setShowConfigDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Error al guardar configuración');
    }
    setSaving(false);
  };

  // Factura item helpers
  const addFacturaItem = () => {
    setFacturaForm(prev => ({
      ...prev,
      items: [...prev.items, { descripcion: '', cantidad: 1, precio_unitario: 0 }]
    }));
  };

  const updateFacturaItem = (index, field, value) => {
    const items = [...facturaForm.items];
    items[index] = { ...items[index], [field]: value };
    setFacturaForm(prev => ({ ...prev, items }));
  };

  const removeFacturaItem = (index) => {
    setFacturaForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const facturaSubtotal = facturaForm.items.reduce((sum, i) => sum + (i.cantidad * i.precio_unitario), 0);
  const facturaIGV = Math.round(facturaSubtotal * 0.18 * 100) / 100;
  const facturaTotal = Math.round((facturaSubtotal + facturaIGV) * 100) / 100;

  const getStatusBadge = (status) => {
    const map = {
      borrador: { label: 'Borrador', color: 'bg-slate-100 text-slate-700' },
      emitida: { label: 'Emitida', color: 'bg-green-100 text-green-700' },
      pagada: { label: 'Pagada', color: 'bg-blue-100 text-blue-700' },
      anulada: { label: 'Anulada', color: 'bg-red-100 text-red-700' },
      error: { label: 'Error', color: 'bg-red-100 text-red-700' },
    };
    const info = map[status] || map.borrador;
    return <Badge className={info.color}>{info.label}</Badge>;
  };

  // Stats
  const guiasEmitidas = guias.filter(g => g.status === 'emitida').length;
  const facturasEmitidas = facturas.filter(f => f.status === 'emitida' || f.status === 'pagada').length;
  const totalFacturado = facturas.filter(f => f.status !== 'anulada').reduce((sum, f) => sum + (f.total || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Facturación y Guías
          </h1>
          <p className="text-slate-500 mt-1">
            Guías de transportista y facturas electrónicas (SUNAT)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="btn-press" onClick={() => setShowConfigDialog(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Config SUNAT
          </Button>
        </div>
      </div>

      {/* SUNAT Status */}
      {!sunatConfig.ruc && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">Configuración SUNAT pendiente</p>
              <p className="text-sm text-yellow-600">Configure sus credenciales API para emitir documentos electrónicos.</p>
            </div>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setShowConfigDialog(true)}>
              Configurar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-blue-500 card-enter card-stagger-1">
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Guías</p>
            <p className="font-heading text-3xl font-bold text-blue-600 mt-1">{guias.length}</p>
            <p className="text-xs text-slate-400">{guiasEmitidas} emitidas</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-green-500 card-enter card-stagger-2">
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Facturas</p>
            <p className="font-heading text-3xl font-bold text-green-600 mt-1">{facturas.length}</p>
            <p className="text-xs text-slate-400">{facturasEmitidas} emitidas</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-orange-500 col-span-2 card-enter card-stagger-3">
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total Facturado</p>
            <p className="font-heading text-3xl font-bold text-orange-600 mt-1">
              S/ {totalFacturado.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="guias" className="flex items-center gap-2">
            <TruckIcon className="w-4 h-4" /> Guías de Transportista
          </TabsTrigger>
          <TabsTrigger value="facturas" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Facturas
          </TabsTrigger>
        </TabsList>

        {/* Guías Tab */}
        <TabsContent value="guias" className="space-y-4">
          <div className="flex justify-end">
            <Button className="btn-action btn-press" onClick={() => setShowGuiaDialog(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nueva Guía
            </Button>
          </div>
          <Card className="bg-white section-enter">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="table-dense">
                    <TableHead>N° Guía</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Ruta</TableHead>
                    <TableHead>Carga</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        No hay guías registradas
                      </TableCell>
                    </TableRow>
                  ) : guias.map((guia) => (
                    <TableRow key={guia.id} className="table-dense">
                      <TableCell className="font-mono font-bold text-sm">
                        {guia.serie}-{String(guia.numero).padStart(8, '0')}
                      </TableCell>
                      <TableCell className="text-sm">{guia.fecha_emision || '-'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{guia.destinatario_razon_social || '-'}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">
                        {guia.punto_partida} → {guia.punto_llegada}
                      </TableCell>
                      <TableCell className="text-xs">{guia.descripcion_carga || '-'}</TableCell>
                      <TableCell>{getStatusBadge(guia.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {guia.status === 'borrador' && (
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleEmit('guias', guia.id)} disabled={saving}>
                              <Send className="w-3 h-3 mr-1" /> Emitir
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedItem(guia); setShowDetailDialog(true); }}>
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Facturas Tab */}
        <TabsContent value="facturas" className="space-y-4">
          <div className="flex justify-end">
            <Button className="btn-action btn-press" onClick={() => setShowFacturaDialog(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nueva Factura
            </Button>
          </div>
          <Card className="bg-white section-enter">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="table-dense">
                    <TableHead>N° Factura</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>RUC</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>IGV</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facturas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                        No hay facturas registradas
                      </TableCell>
                    </TableRow>
                  ) : facturas.map((factura) => (
                    <TableRow key={factura.id} className="table-dense">
                      <TableCell className="font-mono font-bold text-sm">
                        {factura.serie}-{String(factura.numero).padStart(8, '0')}
                      </TableCell>
                      <TableCell className="text-sm">{factura.fecha_emision || '-'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{factura.cliente_razon_social || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{factura.cliente_ruc || '-'}</TableCell>
                      <TableCell>S/ {(factura.subtotal || 0).toFixed(2)}</TableCell>
                      <TableCell>S/ {(factura.igv || 0).toFixed(2)}</TableCell>
                      <TableCell className="font-bold">S/ {(factura.total || 0).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(factura.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {factura.status === 'borrador' && (
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleEmit('facturas', factura.id)} disabled={saving}>
                              <Send className="w-3 h-3 mr-1" /> Emitir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Nueva Guía Dialog */}
      <Dialog open={showGuiaDialog} onOpenChange={setShowGuiaDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nueva Guía de Transportista
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Trip selector */}
            <div className="space-y-2">
              <Label className="input-label">Vincular a Viaje (auto-rellena datos)</Label>
              <Select value={guiaForm.trip_id} onValueChange={handleTripSelectGuia}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Seleccionar viaje..." />
                </SelectTrigger>
                <SelectContent>
                  {trips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.client_name || 'Sin cliente'} - {trip.origin || '?'} → {trip.destination || '?'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label font-bold text-blue-700">Remitente</Label>
                <Input placeholder="RUC" value={guiaForm.remitente_ruc} onChange={e => setGuiaForm({...guiaForm, remitente_ruc: e.target.value})} className="rounded-sm" />
                <Input placeholder="Razón Social" value={guiaForm.remitente_razon_social} onChange={e => setGuiaForm({...guiaForm, remitente_razon_social: e.target.value})} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label font-bold text-green-700">Destinatario</Label>
                <Input placeholder="RUC" value={guiaForm.destinatario_ruc} onChange={e => setGuiaForm({...guiaForm, destinatario_ruc: e.target.value})} className="rounded-sm" />
                <Input placeholder="Razón Social" value={guiaForm.destinatario_razon_social} onChange={e => setGuiaForm({...guiaForm, destinatario_razon_social: e.target.value})} className="rounded-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Punto de Partida</Label>
                <Input value={guiaForm.punto_partida} onChange={e => setGuiaForm({...guiaForm, punto_partida: e.target.value})} className="rounded-sm" placeholder="Ciudad / Dirección" />
                <Input value={guiaForm.punto_partida_ubigeo} onChange={e => setGuiaForm({...guiaForm, punto_partida_ubigeo: e.target.value})} className="rounded-sm" placeholder="Ubigeo (ej: 150101)" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Punto de Llegada</Label>
                <Input value={guiaForm.punto_llegada} onChange={e => setGuiaForm({...guiaForm, punto_llegada: e.target.value})} className="rounded-sm" placeholder="Ciudad / Dirección" />
                <Input value={guiaForm.punto_llegada_ubigeo} onChange={e => setGuiaForm({...guiaForm, punto_llegada_ubigeo: e.target.value})} className="rounded-sm" placeholder="Ubigeo (ej: 040101)" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Descripción Carga</Label>
                <Input value={guiaForm.descripcion_carga} onChange={e => setGuiaForm({...guiaForm, descripcion_carga: e.target.value})} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Peso Bruto (kg)</Label>
                <Input type="number" value={guiaForm.peso_bruto} onChange={e => setGuiaForm({...guiaForm, peso_bruto: e.target.value})} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">N° Bultos</Label>
                <Input type="number" value={guiaForm.num_bultos} onChange={e => setGuiaForm({...guiaForm, num_bultos: e.target.value})} className="rounded-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGuiaDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleCreateGuia} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Guía
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nueva Factura Dialog */}
      <Dialog open={showFacturaDialog} onOpenChange={setShowFacturaDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nueva Factura Electrónica
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Trip selector */}
            <div className="space-y-2">
              <Label className="input-label">Vincular a Viaje</Label>
              <Select value={facturaForm.trip_id} onValueChange={handleTripSelectFactura}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Seleccionar viaje..." />
                </SelectTrigger>
                <SelectContent>
                  {trips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.client_name || 'Sin cliente'} - {trip.origin || '?'} → {trip.destination || '?'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">RUC Cliente *</Label>
                <Input value={facturaForm.cliente_ruc} onChange={e => setFacturaForm({...facturaForm, cliente_ruc: e.target.value})} className="rounded-sm" placeholder="20xxxxxxxxx" maxLength={11} />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Razón Social *</Label>
                <Input value={facturaForm.cliente_razon_social} onChange={e => setFacturaForm({...facturaForm, cliente_razon_social: e.target.value})} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Dirección</Label>
                <Input value={facturaForm.cliente_direccion} onChange={e => setFacturaForm({...facturaForm, cliente_direccion: e.target.value})} className="rounded-sm" />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="input-label">Detalle de Servicios</Label>
                <Button size="sm" variant="outline" onClick={addFacturaItem}>
                  <Plus className="w-3 h-3 mr-1" /> Agregar
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="table-dense">
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-20">Cant.</TableHead>
                    <TableHead className="w-28">P. Unit.</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facturaForm.items.map((item, idx) => (
                    <TableRow key={idx} className="table-dense">
                      <TableCell>
                        <Input value={item.descripcion} onChange={e => updateFacturaItem(idx, 'descripcion', e.target.value)} className="rounded-sm h-8" placeholder="Servicio de transporte..." />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="1" value={item.cantidad} onChange={e => updateFacturaItem(idx, 'cantidad', parseInt(e.target.value) || 0)} className="rounded-sm h-8 w-16" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={item.precio_unitario} onChange={e => updateFacturaItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)} className="rounded-sm h-8" />
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        S/ {(item.cantidad * item.precio_unitario).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {facturaForm.items.length > 1 && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => removeFacturaItem(idx)}>
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-medium">S/ {facturaSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>IGV (18%)</span>
                <span className="font-medium">S/ {facturaIGV.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total</span>
                <span className="text-orange-600">S/ {facturaTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFacturaDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleCreateFactura} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config SUNAT Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Configuración SUNAT
            </DialogTitle>
            <DialogDescription>
              Ingrese sus credenciales de facturación electrónica
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">RUC de la Empresa</Label>
                <Input value={configForm.ruc} onChange={e => setConfigForm({...configForm, ruc: e.target.value})} className="rounded-sm" placeholder="20xxxxxxxxx" maxLength={11} />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Razón Social</Label>
                <Input value={configForm.razon_social} onChange={e => setConfigForm({...configForm, razon_social: e.target.value})} className="rounded-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Proveedor API</Label>
              <Select value={configForm.api_provider} onValueChange={v => setConfigForm({...configForm, api_provider: v})}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nubefact">Nubefact</SelectItem>
                  <SelectItem value="efact">Efact</SelectItem>
                  <SelectItem value="sunat">SUNAT Directo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="input-label">URL del API</Label>
              <Input value={configForm.api_url} onChange={e => setConfigForm({...configForm, api_url: e.target.value})} className="rounded-sm" placeholder="https://api.nubefact.com/api/v1/..." />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Token API</Label>
              <Input type="password" value={configForm.api_token} onChange={e => setConfigForm({...configForm, api_token: e.target.value})} className="rounded-sm" placeholder="Tu token secreto" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="production" checked={configForm.production} onChange={e => setConfigForm({...configForm, production: e.target.checked})} />
              <Label htmlFor="production" className="text-sm">Modo Producción (desmarcar para pruebas/beta)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleSaveConfig} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillingPage;
