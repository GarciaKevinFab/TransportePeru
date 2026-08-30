import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  liquidacionesFleteApi,
  proveedoresApi,
  tiposCargaApi,
  whatsappPendientesApi,
} from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Plus, Loader2, Eye, Lock, Trash2, Pencil, MessageSquareText,
  FileSpreadsheet, Users, ImageIcon, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

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

const STATUS_LABEL = {
  borrador: { label: 'Borrador', className: 'bg-slate-100 text-slate-600' },
  en_revision: { label: 'En revisión', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  aprobada: { label: 'Aprobada', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  cerrada: { label: 'Cerrada', className: 'bg-green-100 text-green-700 border-green-200' },
};

const statusBadge = (status) => {
  const meta = STATUS_LABEL[status] || STATUS_LABEL.borrador;
  return <Badge variant="outline" className={meta.className}>{meta.label}</Badge>;
};

const emptyLiquidacionForm = {
  proveedor_id: '',
  periodo_inicio: '',
  periodo_fin: '',
  tipo_carga: '',
  cliente_nombre: 'DISTRIBUIDORA CINSA',
};

const emptyProveedorForm = {
  tipo: 'empresa',
  razon_social: '',
  ruc: '',
  dni: '',
  celular: '',
  banco: '',
  cuenta_corriente: '',
  cuenta_cci: '',
  notes: '',
};

const LiquidacionFletePage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('liquidaciones');

  // --- Liquidaciones ---
  const [loading, setLoading] = useState(true);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [tiposCarga, setTiposCarga] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [proveedorFilter, setProveedorFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  const [showLiqDialog, setShowLiqDialog] = useState(false);
  const [liqForm, setLiqForm] = useState(emptyLiquidacionForm);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showDeleteLiqDialog, setShowDeleteLiqDialog] = useState(false);
  const [selectedLiq, setSelectedLiq] = useState(null);

  const fetchLookups = useCallback(async () => {
    try {
      const [provRes, tiposRes] = await Promise.all([
        proveedoresApi.getAll(),
        tiposCargaApi.getAll(),
      ]);
      setProveedores(Array.isArray(provRes.data) ? provRes.data : []);
      setTiposCarga(Array.isArray(tiposRes.data) ? tiposRes.data : []);
    } catch (error) {
      toast.error('No se pudieron cargar proveedores/tipos de carga');
    }
  }, []);

  const fetchLiquidaciones = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    if (proveedorFilter !== 'all') params.proveedor_id = proveedorFilter;
    try {
      const res = await liquidacionesFleteApi.getAll(params);
      setLiquidaciones(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setLiquidaciones([]);
      toast.error(error.response?.data?.detail || 'Error al cargar liquidaciones');
    }
    setLoading(false);
  }, [statusFilter, proveedorFilter]);

  useEffect(() => {
    fetchLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchLiquidaciones();
  }, [fetchLiquidaciones]);

  const proveedorName = (id) => proveedores.find((p) => p.id === id)?.razon_social || '-';
  const tipoCargaLabel = (code) => tiposCarga.find((t) => t.code === code)?.label || code;

  const openCreateLiq = () => {
    setLiqForm(emptyLiquidacionForm);
    setShowLiqDialog(true);
  };

  const handleSaveLiq = async () => {
    if (!liqForm.proveedor_id || !liqForm.periodo_inicio || !liqForm.periodo_fin || !liqForm.tipo_carga) {
      toast.error('Proveedor, periodo y tipo de carga son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const res = await liquidacionesFleteApi.create(liqForm);
      toast.success(`Liquidación ${res.data?.liquidacion_number || ''} creada`);
      setShowLiqDialog(false);
      fetchLiquidaciones();
      if (res.data?.id) navigate(`/liquidacion-flete/${res.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear la liquidación');
    }
    setSaving(false);
  };

  const handleCloseLiq = async () => {
    setSaving(true);
    try {
      await liquidacionesFleteApi.close(selectedLiq.id);
      toast.success('Liquidación cerrada');
      setShowCloseDialog(false);
      setSelectedLiq(null);
      fetchLiquidaciones();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cerrar la liquidación');
    }
    setSaving(false);
  };

  const handleDeleteLiq = async () => {
    setSaving(true);
    try {
      await liquidacionesFleteApi.delete(selectedLiq.id);
      toast.success('Liquidación eliminada');
      setShowDeleteLiqDialog(false);
      setSelectedLiq(null);
      fetchLiquidaciones();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo eliminar la liquidación');
    }
    setSaving(false);
  };

  const totalACobrar = liquidaciones.reduce((acc, l) => acc + (Number(l.total_a_cobrar) || 0), 0);
  const totalUtilidad = liquidaciones.reduce((acc, l) => acc + (Number(l.total_utilidad_neta) || 0), 0);
  const borradorCount = liquidaciones.filter((l) => l.status === 'borrador').length;

  return (
    <div className="space-y-6 page-fade-in" data-testid="liquidacion-flete-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Liquidación de Flete
          </h1>
          <p className="text-slate-500 mt-1">
            Guía remitente, ticket UNACEM, vale y factura de combustible por viaje — agrupados por proveedor y periodo.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="liquidaciones" data-testid="tab-liquidaciones">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Liquidaciones
          </TabsTrigger>
          <TabsTrigger value="proveedores" data-testid="tab-proveedores">
            <Users className="w-4 h-4 mr-2" />
            Proveedores
          </TabsTrigger>
          <TabsTrigger value="whatsapp" data-testid="tab-whatsapp">
            <MessageSquareText className="w-4 h-4 mr-2" />
            WhatsApp Pendientes
          </TabsTrigger>
        </TabsList>

        {/* ================= LIQUIDACIONES ================= */}
        <TabsContent value="liquidaciones" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white border-l-4 border-l-slate-400">
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Borradores</p>
                <p className="font-heading text-3xl font-bold text-slate-700 mt-1">{borradorCount}</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-l-4 border-l-orange-500">
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total a cobrar</p>
                <p className="font-heading text-2xl font-bold text-orange-600 mt-1">{soles(totalACobrar)}</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-l-4 border-l-green-500">
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Utilidad neta</p>
                <p className="font-heading text-2xl font-bold text-green-600 mt-1">{soles(totalUtilidad)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white section-enter">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="input-label">Proveedor</Label>
                  <Select value={proveedorFilter} onValueChange={setProveedorFilter}>
                    <SelectTrigger className="rounded-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {proveedores.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.razon_social}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="input-label">Estado</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="rounded-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="borrador">Borrador</SelectItem>
                      <SelectItem value="en_revision">En revisión</SelectItem>
                      <SelectItem value="aprobada">Aprobada</SelectItem>
                      <SelectItem value="cerrada">Cerrada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end sm:col-span-2 justify-end">
                  <Button className="btn-action btn-press" onClick={openCreateLiq} data-testid="liquidacion-new-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Liquidación
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white section-enter">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Liquidaciones registradas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="table-dense">
                    <TableHead>N°</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Tipo de carga</TableHead>
                    <TableHead>Total a cobrar</TableHead>
                    <TableHead>Utilidad neta</TableHead>
                    <TableHead>Líneas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-400"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></TableCell></TableRow>
                  ) : liquidaciones.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-400">
                      <FileSpreadsheet className="w-10 h-10 mx-auto mb-3" />
                      <p>No hay liquidaciones para los filtros seleccionados</p>
                    </TableCell></TableRow>
                  ) : (
                    liquidaciones.map((l) => (
                      <TableRow key={l.id} className="table-dense cursor-pointer hover:bg-slate-50" data-testid={`liquidacion-row-${l.id}`} onClick={() => navigate(`/liquidacion-flete/${l.id}`)}>
                        <TableCell className="font-mono">{l.liquidacion_number || '-'}</TableCell>
                        <TableCell>{proveedorName(l.proveedor_id)}</TableCell>
                        <TableCell>{localDate(l.periodo_inicio)} — {localDate(l.periodo_fin)}</TableCell>
                        <TableCell>{tipoCargaLabel(l.tipo_carga)}</TableCell>
                        <TableCell>{soles(l.total_a_cobrar)}</TableCell>
                        <TableCell className="font-bold text-green-600">{soles(l.total_utilidad_neta)}</TableCell>
                        <TableCell>{l.lineas_count ?? 0}</TableCell>
                        <TableCell>{statusBadge(l.status)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" title="Ver detalle" onClick={() => navigate(`/liquidacion-flete/${l.id}`)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {l.status !== 'cerrada' && (
                            <Button size="sm" variant="ghost" title="Cerrar liquidación" onClick={() => { setSelectedLiq(l); setShowCloseDialog(true); }}>
                              <Lock className="w-4 h-4" />
                            </Button>
                          )}
                          {l.status === 'borrador' && (l.lineas_count ?? 0) === 0 && (
                            <Button size="sm" variant="ghost" className="text-red-600" title="Eliminar" onClick={() => { setSelectedLiq(l); setShowDeleteLiqDialog(true); }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= PROVEEDORES ================= */}
        <TabsContent value="proveedores">
          <ProveedoresTab proveedores={proveedores} onChanged={fetchLookups} />
        </TabsContent>

        {/* ================= WHATSAPP PENDIENTES ================= */}
        <TabsContent value="whatsapp">
          <WhatsappPendientesTab liquidaciones={liquidaciones} proveedorName={proveedorName} />
        </TabsContent>
      </Tabs>

      {/* Diálogo nueva liquidación */}
      <Dialog open={showLiqDialog} onOpenChange={setShowLiqDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">Nueva Liquidación</DialogTitle>
            <DialogDescription>Una liquidación agrupa los viajes de un proveedor en un periodo, con un solo tipo de carga.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label className="input-label">Proveedor *</Label>
              <Select value={liqForm.proveedor_id} onValueChange={(v) => setLiqForm({ ...liqForm, proveedor_id: v })}>
                <SelectTrigger className="rounded-sm" data-testid="liq-form-proveedor"><SelectValue placeholder="Seleccionar proveedor..." /></SelectTrigger>
                <SelectContent>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.razon_social}{p.is_tenant_self ? ' (empresa propia)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Periodo inicio *</Label>
                <Input type="date" value={liqForm.periodo_inicio} onChange={(e) => setLiqForm({ ...liqForm, periodo_inicio: e.target.value })} className="rounded-sm" data-testid="liq-form-inicio" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Periodo fin *</Label>
                <Input type="date" value={liqForm.periodo_fin} onChange={(e) => setLiqForm({ ...liqForm, periodo_fin: e.target.value })} className="rounded-sm" data-testid="liq-form-fin" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Tipo de carga *</Label>
              <Select value={liqForm.tipo_carga} onValueChange={(v) => setLiqForm({ ...liqForm, tipo_carga: v })}>
                <SelectTrigger className="rounded-sm" data-testid="liq-form-tipo-carga"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {tiposCarga.map((t) => (
                    <SelectItem key={t.id} value={t.code}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Cliente</Label>
              <Input value={liqForm.cliente_nombre} onChange={(e) => setLiqForm({ ...liqForm, cliente_nombre: e.target.value })} className="rounded-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLiqDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleSaveLiq} disabled={saving} data-testid="liq-form-save-btn">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo cerrar liquidación */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">Cerrar Liquidación</DialogTitle>
            <DialogDescription>Una vez cerrada, ni la liquidación ni sus líneas se pueden editar. Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleCloseLiq} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cerrar liquidación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo eliminar liquidación */}
      <Dialog open={showDeleteLiqDialog} onOpenChange={setShowDeleteLiqDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">Eliminar Liquidación</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteLiqDialog(false)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteLiq} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ================= PROVEEDORES TAB =================
const ProveedoresTab = ({ proveedores, onChanged }) => {
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyProveedorForm);

  const openCreate = () => { setEditingId(null); setForm(emptyProveedorForm); setShowDialog(true); };
  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      tipo: p.tipo || 'empresa',
      razon_social: p.razon_social || '',
      ruc: p.ruc || '',
      dni: p.dni || '',
      celular: p.celular || '',
      banco: p.banco || '',
      cuenta_corriente: p.cuenta_corriente || '',
      cuenta_cci: p.cuenta_cci || '',
      notes: p.notes || '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.razon_social) { toast.error('La razón social es obligatoria'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await proveedoresApi.update(editingId, form);
        toast.success('Proveedor actualizado');
      } else {
        await proveedoresApi.create(form);
        toast.success('Proveedor creado');
      }
      setShowDialog(false);
      onChanged();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar el proveedor');
    }
    setSaving(false);
  };

  const handleDeactivate = async (p) => {
    if (p.is_tenant_self) return;
    if (!window.confirm(`¿Desactivar a ${p.razon_social}?`)) return;
    try {
      await proveedoresApi.delete(p.id);
      toast.success('Proveedor desactivado');
      onChanged();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo desactivar');
    }
  };

  return (
    <Card className="bg-white section-enter">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
          Proveedores de transporte
        </CardTitle>
        <Button className="btn-action btn-press" onClick={openCreate} data-testid="proveedor-new-btn">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="table-dense">
              <TableHead>Razón social</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>RUC / DNI</TableHead>
              <TableHead>Celular</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proveedores.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-3" /><p>No hay proveedores registrados</p>
              </TableCell></TableRow>
            ) : (
              proveedores.map((p) => (
                <TableRow key={p.id} className="table-dense" data-testid={`proveedor-row-${p.id}`}>
                  <TableCell>
                    {p.razon_social}
                    {p.is_tenant_self && <Badge variant="outline" className="ml-2 bg-slate-100 text-slate-600">Empresa propia</Badge>}
                  </TableCell>
                  <TableCell className="capitalize">{p.tipo === 'persona_natural' ? 'Persona natural' : 'Empresa'}</TableCell>
                  <TableCell className="font-mono text-xs">{p.ruc || p.dni || '-'}</TableCell>
                  <TableCell>{p.celular || '-'}</TableCell>
                  <TableCell>{p.banco || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{p.cuenta_corriente || p.cuenta_cci || '-'}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                    {!p.is_tenant_self && (
                      <Button size="sm" variant="ghost" className="text-red-600" title="Desactivar" onClick={() => handleDeactivate(p)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </DialogTitle>
            <DialogDescription>Empresa o persona natural subcontratada que factura el flete por separado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empresa">Empresa</SelectItem>
                    <SelectItem value="persona_natural">Persona natural</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Razón social *</Label>
                <Input value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} className="rounded-sm" data-testid="proveedor-form-razon-social" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">RUC</Label>
                <Input value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} maxLength={11} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">DNI</Label>
                <Input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} maxLength={8} className="rounded-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Celular</Label>
              <Input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} className="rounded-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Banco</Label>
                <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Cuenta corriente</Label>
                <Input value={form.cuenta_corriente} onChange={(e) => setForm({ ...form, cuenta_corriente: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">CCI</Label>
                <Input value={form.cuenta_cci} onChange={(e) => setForm({ ...form, cuenta_cci: e.target.value })} className="rounded-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Notas</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleSave} disabled={saving} data-testid="proveedor-form-save-btn">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? 'Guardar Cambios' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// ================= WHATSAPP PENDIENTES TAB =================
const KIND_LABEL = {
  guia_remitente: 'Guía remitente',
  ticket_unacem: 'Ticket UNACEM',
  vale_combustible: 'Vale de combustible',
  factura_combustible: 'Factura de combustible',
  vale_entrega: 'Vale de entrega',
  unknown: 'Sin clasificar',
};

const confidenceBadge = (confidence) => {
  if (confidence === 'alta') return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Alta</Badge>;
  if (confidence === 'media') return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200">Media</Badge>;
  return <Badge variant="outline" className="bg-slate-100 text-slate-600">Baja</Badge>;
};

const WhatsappPendientesTab = ({ liquidaciones, proveedorName }) => {
  const [loading, setLoading] = useState(true);
  const [pendientes, setPendientes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [targetLiquidacionId, setTargetLiquidacionId] = useState('');

  const fetchPendientes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappPendientesApi.getAll('pendiente');
      setPendientes(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setPendientes([]);
      toast.error('No se pudo cargar la bandeja de WhatsApp');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPendientes(); }, [fetchPendientes]);

  const openAssign = (p) => {
    setSelected(p);
    setTargetLiquidacionId('');
    setShowAssignDialog(true);
  };

  const borradores = liquidaciones.filter((l) => l.status === 'borrador');

  const handleAssign = async () => {
    if (!targetLiquidacionId) { toast.error('Selecciona una liquidación'); return; }
    setSaving(true);
    try {
      await whatsappPendientesApi.asignar(selected.id, { liquidacion_id: targetLiquidacionId });
      toast.success('Documento asignado a la liquidación');
      setShowAssignDialog(false);
      setSelected(null);
      fetchPendientes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo asignar el documento');
    }
    setSaving(false);
  };

  return (
    <Card className="bg-white section-enter">
      <CardHeader>
        <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
          Documentos recibidos por WhatsApp, pendientes de asignar
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="table-dense">
              <TableHead>Recibido</TableHead>
              <TableHead>Tipo detectado</TableHead>
              <TableHead>Confianza</TableHead>
              <TableHead>Chofer/Viaje</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></TableCell></TableRow>
            ) : pendientes.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400">
                <MessageSquareText className="w-10 h-10 mx-auto mb-3" />
                <p>No hay documentos pendientes del bot de WhatsApp</p>
              </TableCell></TableRow>
            ) : (
              pendientes.map((p) => (
                <TableRow key={p.id} className="table-dense" data-testid={`whatsapp-pendiente-${p.id}`}>
                  <TableCell>{p.created_at ? new Date(p.created_at).toLocaleString('es-PE') : '-'}</TableCell>
                  <TableCell>{KIND_LABEL[p.detected_kind] || p.detected_kind}</TableCell>
                  <TableCell>{confidenceBadge(p.confidence)}</TableCell>
                  <TableCell className="font-mono text-xs">{(p.trip_id || '').substring(0, 8) || '-'}</TableCell>
                  <TableCell>
                    <a href={p.file_url?.startsWith('/uploads') ? `${process.env.REACT_APP_BACKEND_URL || ''}${p.file_url}` : p.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" /> Ver
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" className="btn-action" onClick={() => openAssign(p)} data-testid={`whatsapp-assign-btn-${p.id}`}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Asignar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">Asignar Documento</DialogTitle>
            <DialogDescription>
              Se creará una nueva línea en la liquidación elegida, prellenada con lo que el OCR detectó ({KIND_LABEL[selected?.detected_kind] || ''}).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label className="input-label">Liquidación destino (borrador)</Label>
              <Select value={targetLiquidacionId} onValueChange={setTargetLiquidacionId}>
                <SelectTrigger className="rounded-sm"><SelectValue placeholder="Seleccionar liquidación..." /></SelectTrigger>
                <SelectContent>
                  {borradores.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.liquidacion_number} · {proveedorName(l.proveedor_id)} · {localDate(l.periodo_inicio)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {borradores.length === 0 && (
                <p className="text-xs text-slate-400">No hay liquidaciones en borrador. Crea una primero en la pestaña Liquidaciones.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleAssign} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LiquidacionFletePage;
