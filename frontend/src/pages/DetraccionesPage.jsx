import React, { useState, useEffect, useCallback } from 'react';
import api, { detraccionesApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
  Coins,
  Plus,
  Loader2,
  Landmark,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Wand2,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

// Detracción SPOT (transporte de carga): 4% del importe de la operación
// cuando supera S/ 400. El cliente deposita en el Banco de la Nación.
const DEFAULT_RATE = 4;
const DEFAULT_CODIGO = '027';
const MIN_AMOUNT = 400;

const STATUS_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'depositada', label: 'Depositada' },
  { value: 'anulada', label: 'Anulada' },
];

const emptyForm = {
  client_ruc: '',
  client_name: '',
  comprobante_serie: '',
  comprobante_numero: '',
  fecha_emision: '',
  base_amount: '',
  rate: DEFAULT_RATE,
  codigo_bien_servicio: DEFAULT_CODIGO,
  notes: '',
};

const soles = (value) =>
  `S/ ${(Number(value) || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const localDate = (value) => {
  if (!value) return '-';
  const raw = String(value).substring(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('es-PE');
};

const DetraccionesPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detracciones, setDetracciones] = useState([]);
  const [summary, setSummary] = useState(null);
  const [facturas, setFacturas] = useState([]);

  // Filtros
  const [statusFilter, setStatusFilter] = useState('all');
  const [rucFilter, setRucFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Diálogos
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [showFacturaDialog, setShowFacturaDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);

  const [formData, setFormData] = useState(emptyForm);
  const [depositData, setDepositData] = useState({ constancia_number: '', deposit_date: '' });
  const [selectedFacturaId, setSelectedFacturaId] = useState('');

  const buildParams = useCallback(() => {
    const params = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    if (rucFilter.trim()) params.client_ruc = rucFilter.trim();
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    return params;
  }, [statusFilter, rucFilter, fromDate, toDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = buildParams();
    try {
      const res = await detraccionesApi.getAll(params);
      setDetracciones(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch (error) {
      setDetracciones([]);
      toast.error(error.response?.data?.detail || 'Error al cargar detracciones');
    }
    try {
      const res = await detraccionesApi.getSummary(params);
      setSummary(res.data || null);
    } catch (error) {
      setSummary(null);
    }
    setLoading(false);
  }, [buildParams]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFacturas = async () => {
    try {
      const res = await api.get('/facturas');
      setFacturas(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch (error) {
      setFacturas([]);
      toast.error('No se pudieron cargar las facturas');
    }
  };

  // --- Totales (usa el summary del backend; si no responde, calcula en cliente) ---
  const localPending = detracciones.filter((d) => d.status === 'pendiente');
  const localDeposited = detracciones.filter((d) => d.status === 'depositada');
  const sumAmount = (rows) =>
    rows.reduce((acc, r) => acc + (Number(r.detraccion_amount ?? r.amount) || 0), 0);

  const pendingCount = summary?.pending_count ?? localPending.length;
  const pendingAmount = summary?.pending_amount ?? sumAmount(localPending);
  const depositedCount = summary?.deposited_count ?? localDeposited.length;
  const depositedAmount = summary?.deposited_amount ?? sumAmount(localDeposited);
  const totalCount = summary?.total_count ?? detracciones.length;
  const totalAmount =
    summary?.total_amount ??
    sumAmount(detracciones.filter((d) => d.status !== 'anulada'));

  // --- Formulario crear/editar ---
  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, fecha_emision: new Date().toISOString().substring(0, 10) });
    setShowFormDialog(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setFormData({
      client_ruc: row.client_ruc || '',
      client_name: row.client_name || '',
      comprobante_serie: row.comprobante_serie || '',
      comprobante_numero: row.comprobante_numero || '',
      fecha_emision: (row.fecha_emision || '').substring(0, 10),
      base_amount: row.base_amount ?? '',
      rate: row.rate ?? DEFAULT_RATE,
      codigo_bien_servicio: row.codigo_bien_servicio || DEFAULT_CODIGO,
      notes: row.notes || '',
    });
    setShowFormDialog(true);
  };

  const computedAmount =
    (Number(formData.base_amount) || 0) * ((Number(formData.rate) || 0) / 100);
  const belowMinimum = (Number(formData.base_amount) || 0) > 0 &&
    (Number(formData.base_amount) || 0) <= MIN_AMOUNT;

  const handleSave = async () => {
    if (!formData.client_ruc || !formData.base_amount) {
      toast.error('RUC del cliente y base imponible son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        base_amount: Number(formData.base_amount) || 0,
        rate: Number(formData.rate) || DEFAULT_RATE,
      };
      if (editingId) {
        await detraccionesApi.update(editingId, payload);
        toast.success('Detracción actualizada');
      } else {
        await detraccionesApi.create(payload);
        toast.success('Detracción registrada');
      }
      setShowFormDialog(false);
      setEditingId(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar la detracción');
    }
    setSaving(false);
  };

  // --- Registrar depósito ---
  const openDeposit = (row) => {
    setSelected(row);
    setDepositData({
      constancia_number: row.constancia_number || '',
      deposit_date: (row.deposit_date || new Date().toISOString()).substring(0, 10),
    });
    setShowDepositDialog(true);
  };

  const handleRegisterDeposit = async () => {
    if (!depositData.constancia_number || !depositData.deposit_date) {
      toast.error('N° de constancia y fecha de depósito son obligatorios');
      return;
    }
    setSaving(true);
    try {
      await detraccionesApi.registerDeposit(selected.id, depositData);
      toast.success('Depósito registrado');
      setShowDepositDialog(false);
      setSelected(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar el depósito');
    }
    setSaving(false);
  };

  // --- Generar desde factura ---
  const openFromFactura = () => {
    setSelectedFacturaId('');
    fetchFacturas();
    setShowFacturaDialog(true);
  };

  const handleFromFactura = async () => {
    if (!selectedFacturaId) {
      toast.error('Seleccione una factura');
      return;
    }
    setSaving(true);
    try {
      const res = await detraccionesApi.fromFactura(selectedFacturaId);
      toast.success(res.data?.message || 'Detracción generada desde la factura');
      setShowFacturaDialog(false);
      fetchData();
    } catch (error) {
      // El backend informa si la factura no alcanza el mínimo de S/ 400.
      toast.error(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          'No se pudo generar la detracción desde la factura'
      );
    }
    setSaving(false);
  };

  // --- Eliminar ---
  const handleDelete = async () => {
    setSaving(true);
    try {
      await detraccionesApi.delete(selected.id);
      toast.success('Detracción eliminada');
      setShowDeleteDialog(false);
      setSelected(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar la detracción');
    }
    setSaving(false);
  };

  // --- Export CSV ---
  const exportCsv = () => {
    if (detracciones.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    const escape = (val) => {
      const s = val === null || val === undefined ? '' : String(val);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = [
      'Comprobante', 'Fecha Emisión', 'RUC Cliente', 'Razón Social',
      'Base Imponible', 'Tasa %', 'Monto Detracción', 'N° Constancia',
      'Fecha Depósito', 'Estado',
    ];
    const rows = detracciones.map((d) => [
      `${d.comprobante_serie || ''}-${d.comprobante_numero || ''}`,
      (d.fecha_emision || '').substring(0, 10),
      d.client_ruc || '',
      d.client_name || '',
      Number(d.base_amount) || 0,
      Number(d.rate) || 0,
      Number(d.detraccion_amount ?? d.amount) || 0,
      d.constancia_number || '',
      (d.deposit_date || '').substring(0, 10),
      d.status || '',
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.map(escape).join(';'))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'detracciones.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('CSV descargado exitosamente');
  };

  const statusBadge = (status) => {
    if (status === 'depositada') {
      return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Depositada</Badge>;
    }
    if (status === 'anulada') {
      return <Badge variant="outline" className="bg-slate-100 text-slate-600">Anulada</Badge>;
    }
    return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200">Pendiente</Badge>;
  };

  return (
    <div className="space-y-6 page-fade-in" data-testid="detracciones-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Detracciones
          </h1>
          <p className="text-slate-500 mt-1">
            SPOT — Transporte de carga: {DEFAULT_RATE}% del importe cuando supera S/ {MIN_AMOUNT}.
            El cliente deposita en el Banco de la Nación.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} data-testid="detracciones-export-btn">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={openFromFactura} data-testid="detraccion-from-factura-btn">
            <Wand2 className="w-4 h-4 mr-2" />
            Generar desde factura
          </Button>
          <Button className="btn-action btn-press" onClick={openCreate} data-testid="detraccion-new-btn">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Detracción
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-l-4 border-l-yellow-500" data-testid="stat-pendientes">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Pendientes</p>
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
            <p className="font-heading text-3xl font-bold text-yellow-600 mt-1">{pendingCount}</p>
            <p className="text-sm text-slate-500">{soles(pendingAmount)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-green-500" data-testid="stat-depositadas">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Depositadas</p>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <p className="font-heading text-3xl font-bold text-green-600 mt-1">{depositedCount}</p>
            <p className="text-sm text-slate-500">{soles(depositedAmount)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-orange-500" data-testid="stat-total">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total del periodo</p>
              <Coins className="w-4 h-4 text-orange-600" />
            </div>
            <p className="font-heading text-2xl font-bold text-orange-600 mt-1">{soles(totalAmount)}</p>
            <p className="text-sm text-slate-500">{totalCount} detracciones</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-white section-enter">
        <CardContent className="py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label className="input-label">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-sm" data-testid="filter-status">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="input-label">RUC Cliente</Label>
              <Input
                value={rucFilter}
                onChange={(e) => setRucFilter(e.target.value)}
                placeholder="20xxxxxxxxx"
                maxLength={11}
                className="rounded-sm"
                data-testid="filter-ruc"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Desde</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-sm" data-testid="filter-from" />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Hasta</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-sm" data-testid="filter-to" />
            </div>
            <div className="flex items-end">
              <Button className="btn-action btn-press" onClick={fetchData} disabled={loading} data-testid="filter-apply-btn">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card className="bg-white section-enter">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
            Detracciones registradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="table-dense">
                <TableHead>Comprobante</TableHead>
                <TableHead>F. Emisión</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Base Imponible</TableHead>
                <TableHead>Tasa</TableHead>
                <TableHead>Monto Detracción</TableHead>
                <TableHead>N° Constancia</TableHead>
                <TableHead>F. Depósito</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                  </TableCell>
                </TableRow>
              ) : detracciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                    <Coins className="w-10 h-10 mx-auto mb-3" />
                    <p>No hay detracciones registradas para los filtros seleccionados</p>
                  </TableCell>
                </TableRow>
              ) : (
                detracciones.map((d) => (
                  <TableRow key={d.id} className="table-dense" data-testid={`detraccion-row-${d.id}`}>
                    <TableCell className="font-mono">
                      {d.comprobante_serie || '-'}-{d.comprobante_numero || '-'}
                    </TableCell>
                    <TableCell>{localDate(d.fecha_emision)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-slate-500 block">{d.client_ruc || '-'}</span>
                      <span className="truncate block max-w-[180px]">{d.client_name || '-'}</span>
                    </TableCell>
                    <TableCell>{soles(d.base_amount)}</TableCell>
                    <TableCell>{(Number(d.rate) || 0).toFixed(2)}%</TableCell>
                    <TableCell className="font-bold text-orange-600">
                      {soles(d.detraccion_amount ?? d.amount)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.constancia_number || '-'}</TableCell>
                    <TableCell>{d.deposit_date ? localDate(d.deposit_date) : '-'}</TableCell>
                    <TableCell>{statusBadge(d.status)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {d.status === 'pendiente' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Registrar depósito"
                          onClick={() => openDeposit(d)}
                          data-testid={`deposit-btn-${d.id}`}
                        >
                          <Landmark className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(d)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        title="Eliminar"
                        onClick={() => { setSelected(d); setShowDeleteDialog(true); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diálogo crear/editar */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {editingId ? 'Editar Detracción' : 'Nueva Detracción'}
            </DialogTitle>
            <DialogDescription>
              El monto final lo recalcula el servidor según la tasa vigente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">RUC Cliente *</Label>
                <Input
                  value={formData.client_ruc}
                  onChange={(e) => setFormData({ ...formData, client_ruc: e.target.value })}
                  placeholder="20xxxxxxxxx"
                  maxLength={11}
                  className="rounded-sm"
                  data-testid="form-client-ruc"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Razón Social</Label>
                <Input
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="rounded-sm"
                  data-testid="form-client-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Serie</Label>
                <Input
                  value={formData.comprobante_serie}
                  onChange={(e) => setFormData({ ...formData, comprobante_serie: e.target.value })}
                  placeholder="F001"
                  className="rounded-sm"
                  data-testid="form-serie"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Número</Label>
                <Input
                  value={formData.comprobante_numero}
                  onChange={(e) => setFormData({ ...formData, comprobante_numero: e.target.value })}
                  placeholder="00000123"
                  className="rounded-sm"
                  data-testid="form-numero"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Fecha de Emisión</Label>
                <Input
                  type="date"
                  value={formData.fecha_emision}
                  onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                  className="rounded-sm"
                  data-testid="form-fecha-emision"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Base Imponible (S/) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.base_amount}
                  onChange={(e) => setFormData({ ...formData, base_amount: e.target.value })}
                  className="rounded-sm"
                  data-testid="form-base-amount"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Tasa (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  className="rounded-sm"
                  data-testid="form-rate"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Código Bien/Servicio</Label>
                <Input
                  value={formData.codigo_bien_servicio}
                  onChange={(e) => setFormData({ ...formData, codigo_bien_servicio: e.target.value })}
                  placeholder="027"
                  className="rounded-sm"
                  data-testid="form-codigo"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="input-label">Observaciones</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="rounded-sm"
                data-testid="form-notes"
              />
            </div>

            {/* Monto calculado en vivo */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Base imponible</span>
                <span className="font-medium">{soles(formData.base_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tasa aplicada</span>
                <span className="font-medium">{(Number(formData.rate) || 0).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Monto detracción (referencial)</span>
                <span className="text-orange-600" data-testid="form-computed-amount">{soles(computedAmount)}</span>
              </div>
              {belowMinimum && (
                <p className="text-xs text-yellow-700">
                  El importe no supera S/ {MIN_AMOUNT}; normalmente no corresponde detracción.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleSave} disabled={saving} data-testid="form-save-btn">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? 'Guardar Cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo registrar depósito */}
      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Registrar Depósito
            </DialogTitle>
            <DialogDescription>
              Constancia de depósito del Banco de la Nación.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label className="input-label">N° de Constancia *</Label>
              <Input
                value={depositData.constancia_number}
                onChange={(e) => setDepositData({ ...depositData, constancia_number: e.target.value })}
                className="rounded-sm"
                data-testid="deposit-constancia"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Fecha de Depósito *</Label>
              <Input
                type="date"
                value={depositData.deposit_date}
                onChange={(e) => setDepositData({ ...depositData, deposit_date: e.target.value })}
                className="rounded-sm"
                data-testid="deposit-date"
              />
            </div>
            {selected && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between">
                <span>Monto a depositar</span>
                <span className="font-bold text-orange-600">
                  {soles(selected.detraccion_amount ?? selected.amount)}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleRegisterDeposit} disabled={saving} data-testid="deposit-save-btn">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo generar desde factura */}
      <Dialog open={showFacturaDialog} onOpenChange={setShowFacturaDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Generar desde Factura
            </DialogTitle>
            <DialogDescription>
              Se calcula la detracción sobre el total de la factura seleccionada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label className="input-label">Factura</Label>
              <Select value={selectedFacturaId} onValueChange={setSelectedFacturaId}>
                <SelectTrigger className="rounded-sm" data-testid="factura-select">
                  <SelectValue placeholder="Seleccionar factura..." />
                </SelectTrigger>
                <SelectContent>
                  {facturas.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.serie}-{String(f.numero || '').padStart(8, '0')} · {f.cliente_razon_social || f.cliente_ruc || 'Sin cliente'} · {soles(f.total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {facturas.length === 0 && (
                <p className="text-xs text-slate-400">No hay facturas disponibles.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFacturaDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleFromFactura} disabled={saving} data-testid="factura-generate-btn">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo eliminar */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Eliminar Detracción
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DetraccionesPage;
