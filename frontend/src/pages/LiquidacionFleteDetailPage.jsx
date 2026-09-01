import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  liquidacionesFleteApi,
  liquidacionLineasApi,
  documentosOcrApi,
  proveedoresApi,
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
  ArrowLeft, Plus, Loader2, Lock, Trash2, Pencil, Camera, Image as ImageIcon,
  CheckCircle2, FileSpreadsheet, Sparkles,
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
  borrador: { label: 'Borrador', className: 'bg-grafito-100 text-grafito-600' },
  en_revision: { label: 'En revisión', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  aprobada: { label: 'Aprobada', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  cerrada: { label: 'Cerrada', className: 'bg-green-100 text-green-700 border-green-200' },
};

const DOC_SLOTS = [
  { kind: 'guia_remitente', label: 'Guía remitente', field: 'doc_guia_remitente_url' },
  { kind: 'ticket_unacem', label: 'Ticket UNACEM', field: 'doc_ticket_unacem_url' },
  { kind: 'vale_combustible', label: 'Vale de combustible', field: 'doc_vale_combustible_url' },
  { kind: 'factura_combustible', label: 'Factura de combustible', field: 'doc_factura_combustible_url' },
  { kind: 'vale_entrega', label: 'Vale de entrega', field: 'doc_vale_entrega_url' },
];

const emptyLineaForm = {
  trip_id: '',
  guia_remitente_numero: '',
  guia_remitente_fecha: '',
  cantidad_bolsas: '',
  peso_total_carga: '',
  conductor_nombre: '',
  placa: '',
  precio_unitario: '',
  fecha_vale_combustible: '',
  vale_combustible_numero: '',
  liters: '',
  price_per_liter: '',
  viaticos: '',
  pago_realizo: '',
  notes: '',
};

const resolveFileUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('/uploads')) return `${process.env.REACT_APP_BACKEND_URL || ''}${url}`;
  return url;
};

const LiquidacionFleteDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [liquidacion, setLiquidacion] = useState(null);
  const [proveedor, setProveedor] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [saving, setSaving] = useState(false);

  const [showLineaDialog, setShowLineaDialog] = useState(false);
  const [editingLineaId, setEditingLineaId] = useState(null);
  const [lineaForm, setLineaForm] = useState(emptyLineaForm);
  const [docPreview, setDocPreview] = useState({});   // kind -> dataURL preview (create flow)
  const [pendingDocs, setPendingDocs] = useState({});  // kind -> base64 (create flow, uploaded after save)
  const [docStatus, setDocStatus] = useState({});       // kind -> 'ocr' | 'uploading' | null
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showDeleteLineaDialog, setShowDeleteLineaDialog] = useState(false);
  const [selectedLinea, setSelectedLinea] = useState(null);

  const fileInputs = useRef({});

  const isClosed = liquidacion?.status === 'cerrada';
  const isTonelada = liquidacion?.tipo_carga === 'tonelada';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [liqRes, lineasRes] = await Promise.all([
        liquidacionesFleteApi.getById(id),
        liquidacionesFleteApi.getLineas(id),
      ]);
      setLiquidacion(liqRes.data);
      setLineas(Array.isArray(lineasRes.data) ? lineasRes.data : []);
      if (liqRes.data?.proveedor_id) {
        try {
          const provRes = await proveedoresApi.getById(liqRes.data.proveedor_id);
          setProveedor(provRes.data);
        } catch (e) { /* ignora si no se puede cargar el proveedor */ }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo cargar la liquidación');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreateLinea = () => {
    setEditingLineaId(null);
    setLineaForm(emptyLineaForm);
    setDocPreview({});
    setPendingDocs({});
    setDocStatus({});
    setShowLineaDialog(true);
  };

  const openEditLinea = (linea) => {
    setEditingLineaId(linea.id);
    setLineaForm({
      trip_id: linea.trip_id || '',
      guia_remitente_numero: linea.guia_remitente_numero || '',
      guia_remitente_fecha: (linea.guia_remitente_fecha || '').substring(0, 10),
      cantidad_bolsas: linea.cantidad_bolsas ?? '',
      peso_total_carga: linea.peso_total_carga ?? '',
      conductor_nombre: linea.conductor_nombre || '',
      placa: linea.placa || '',
      precio_unitario: linea.precio_unitario ?? '',
      fecha_vale_combustible: (linea.fecha_vale_combustible || '').substring(0, 10),
      vale_combustible_numero: linea.vale_combustible_numero || '',
      liters: linea.liters ?? '',
      price_per_liter: linea.price_per_liter ?? '',
      viaticos: linea.viaticos ?? '',
      pago_realizo: linea.pago_realizo || '',
      notes: linea.notes || '',
    });
    const preview = {};
    DOC_SLOTS.forEach(({ kind, field }) => {
      if (linea[field]) preview[kind] = resolveFileUrl(linea[field]);
    });
    setDocPreview(preview);
    setPendingDocs({});
    setDocStatus({});
    setShowLineaDialog(true);
  };

  const buildPayload = () => {
    const payload = { ...lineaForm };
    ['cantidad_bolsas', 'peso_total_carga', 'precio_unitario', 'liters', 'price_per_liter', 'viaticos'].forEach((k) => {
      payload[k] = payload[k] === '' ? null : Number(payload[k]);
    });
    if (!payload.trip_id) delete payload.trip_id;
    return payload;
  };

  const handleSaveLinea = async () => {
    if (!lineaForm.precio_unitario) {
      toast.error('El precio unitario es obligatorio');
      return;
    }
    if (isTonelada && !lineaForm.peso_total_carga) {
      toast.error('El peso total de carga es obligatorio para este tipo de carga');
      return;
    }
    if (!isTonelada && !lineaForm.cantidad_bolsas) {
      toast.error('La cantidad de bolsas es obligatoria para este tipo de carga');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      let lineaId = editingLineaId;
      if (editingLineaId) {
        await liquidacionLineasApi.update(editingLineaId, payload);
      } else {
        const res = await liquidacionLineasApi.create(id, payload);
        lineaId = res.data?.id;
        // Sube los documentos capturados antes de que existiera la línea
        const pendingKinds = Object.keys(pendingDocs);
        for (const kind of pendingKinds) {
          try {
            await liquidacionLineasApi.attachDocumento(lineaId, { kind, data: pendingDocs[kind] });
          } catch (e) {
            toast.error(`No se pudo adjuntar ${kind}`);
          }
        }
      }
      toast.success(editingLineaId ? 'Línea actualizada' : 'Línea creada');
      setShowLineaDialog(false);
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar la línea');
    }
    setSaving(false);
  };

  const handleDeleteLinea = async () => {
    setSaving(true);
    try {
      await liquidacionLineasApi.delete(selectedLinea.id);
      toast.success('Línea eliminada');
      setShowDeleteLineaDialog(false);
      setSelectedLinea(null);
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo eliminar la línea');
    }
    setSaving(false);
  };

  const handleCloseLiquidacion = async () => {
    setSaving(true);
    try {
      await liquidacionesFleteApi.close(id);
      toast.success('Liquidación cerrada');
      setShowCloseDialog(false);
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cerrar la liquidación');
    }
    setSaving(false);
  };

  const applyExtracted = (data) => {
    if (!data) return;
    setLineaForm((prev) => ({
      ...prev,
      guia_remitente_numero: prev.guia_remitente_numero || data.numero || prev.guia_remitente_numero,
      guia_remitente_fecha: prev.guia_remitente_fecha || data.fecha_emision || prev.guia_remitente_fecha,
      cantidad_bolsas: prev.cantidad_bolsas || data.cantidad_bultos || data.cantidad_bolsas || prev.cantidad_bolsas,
      peso_total_carga: prev.peso_total_carga || data.peso_neto_kg || data.peso_bruto || prev.peso_total_carga,
      conductor_nombre: prev.conductor_nombre || data.conductor_nombre || prev.conductor_nombre,
      placa: prev.placa || data.placa || data.vehicle_plate || prev.placa,
      fecha_vale_combustible: prev.fecha_vale_combustible || data.fecha || data.date || prev.fecha_vale_combustible,
      vale_combustible_numero: prev.vale_combustible_numero || data.voucher_number || data.numero || prev.vale_combustible_numero,
      liters: prev.liters || data.liters || prev.liters,
      price_per_liter: prev.price_per_liter || data.price_per_liter || prev.price_per_liter,
    }));
  };

  const handleDocCapture = (kind) => (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('El archivo debe ser menor a 8MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      setDocPreview((prev) => ({ ...prev, [kind]: base64Data }));

      setDocStatus((prev) => ({ ...prev, [kind]: 'ocr' }));
      try {
        const ocrRes = await documentosOcrApi.extract({ data: base64Data, kind });
        if (ocrRes.data?.success) {
          applyExtracted(ocrRes.data.extracted_data);
          toast.success('Datos extraídos del documento');
        }
      } catch (err) {
        // OCR es asistencia opcional — un fallo no bloquea adjuntar el documento
      }

      if (editingLineaId) {
        setDocStatus((prev) => ({ ...prev, [kind]: 'uploading' }));
        try {
          const uploadRes = await liquidacionLineasApi.attachDocumento(editingLineaId, { kind, data: base64Data });
          setDocPreview((prev) => ({ ...prev, [kind]: resolveFileUrl(uploadRes.data.url) }));
        } catch (err) {
          toast.error('No se pudo guardar el documento');
        }
      } else {
        setPendingDocs((prev) => ({ ...prev, [kind]: base64Data }));
      }
      setDocStatus((prev) => ({ ...prev, [kind]: null }));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  if (loading || !liquidacion) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-grafito-400" />
      </div>
    );
  }

  const statusMeta = STATUS_LABEL[liquidacion.status] || STATUS_LABEL.borrador;

  return (
    <div className="space-y-6 page-fade-in" data-testid="liquidacion-detail-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/liquidacion-flete')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-grafito-900">
              {liquidacion.liquidacion_number}
            </h1>
            <Badge variant="outline" className={statusMeta.className}>{statusMeta.label}</Badge>
          </div>
          <p className="text-grafito-500 mt-1">
            {proveedor?.razon_social || 'Proveedor'} · {localDate(liquidacion.periodo_inicio)} — {localDate(liquidacion.periodo_fin)} · {liquidacion.cliente_nombre}
          </p>
        </div>
        {!isClosed && (
          <Button variant="outline" onClick={() => setShowCloseDialog(true)} data-testid="close-liquidacion-btn">
            <Lock className="w-4 h-4 mr-2" />
            Cerrar liquidación
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="bg-white border-l-4 border-l-marca-500"><CardContent className="py-4">
          <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">A cobrar</p>
          <p className="font-heading text-xl font-bold text-marca-600 mt-1">{soles(liquidacion.total_a_cobrar)}</p>
        </CardContent></Card>
        <Card className="bg-white border-l-4 border-l-blue-500"><CardContent className="py-4">
          <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">Combustible</p>
          <p className="font-heading text-xl font-bold text-blue-600 mt-1">{soles(liquidacion.total_combustible)}</p>
        </CardContent></Card>
        <Card className="bg-white border-l-4 border-l-purple-500"><CardContent className="py-4">
          <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">Detracción</p>
          <p className="font-heading text-xl font-bold text-purple-600 mt-1">{soles(liquidacion.total_detraccion)}</p>
        </CardContent></Card>
        <Card className="bg-white border-l-4 border-l-grafito-400"><CardContent className="py-4">
          <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">Viáticos</p>
          <p className="font-heading text-xl font-bold text-grafito-700 mt-1">{soles(liquidacion.total_viaticos)}</p>
        </CardContent></Card>
        <Card className="bg-white border-l-4 border-l-green-500"><CardContent className="py-4">
          <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">Utilidad neta</p>
          <p className="font-heading text-xl font-bold text-green-600 mt-1">{soles(liquidacion.total_utilidad_neta)}</p>
        </CardContent></Card>
      </div>

      <Card className="bg-white section-enter">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
            Líneas ({lineas.length})
          </CardTitle>
          {!isClosed && (
            <Button className="btn-action btn-press" onClick={openCreateLinea} data-testid="linea-new-btn">
              <Plus className="w-4 h-4 mr-2" />
              Agregar línea
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="table-dense">
                <TableHead>Guía remitente</TableHead>
                <TableHead>Placa / Conductor</TableHead>
                <TableHead>{isTonelada ? 'Peso (t)' : 'Bolsas'}</TableHead>
                <TableHead>P. Unit.</TableHead>
                <TableHead>A cobrar</TableHead>
                <TableHead>Combustible</TableHead>
                <TableHead>Detracción</TableHead>
                <TableHead>Viáticos</TableHead>
                <TableHead>Utilidad</TableHead>
                <TableHead>Docs</TableHead>
                {!isClosed && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-12 text-grafito-400">
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-3" />
                  <p>Todavía no hay líneas en esta liquidación</p>
                </TableCell></TableRow>
              ) : (
                lineas.map((l) => (
                  <TableRow key={l.id} className="table-dense" data-testid={`linea-row-${l.id}`}>
                    <TableCell className="font-mono text-xs">{l.guia_remitente_numero || '-'}</TableCell>
                    <TableCell>
                      <span className="block">{l.placa || '-'}</span>
                      <span className="block text-xs text-grafito-400">{l.conductor_nombre || '-'}</span>
                    </TableCell>
                    <TableCell>{isTonelada ? (l.peso_total_carga ?? '-') : (l.cantidad_bolsas ?? '-')}</TableCell>
                    <TableCell>{soles(l.precio_unitario)}</TableCell>
                    <TableCell>{soles(l.total_a_cobrar)}</TableCell>
                    <TableCell>{soles(l.total_combustible)}</TableCell>
                    <TableCell>{soles(l.detraccion_amount)}</TableCell>
                    <TableCell>{soles(l.viaticos)}</TableCell>
                    <TableCell className="font-bold text-green-600">{soles(l.utilidad_neta)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {DOC_SLOTS.map(({ kind, field, label }) => (
                          <span
                            key={kind}
                            title={label}
                            className={`w-2 h-2 rounded-full ${l[field] ? 'bg-green-500' : 'bg-grafito-200'}`}
                          />
                        ))}
                      </div>
                    </TableCell>
                    {!isClosed && (
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" title="Editar" onClick={() => openEditLinea(l)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" title="Eliminar" onClick={() => { setSelectedLinea(l); setShowDeleteLineaDialog(true); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diálogo crear/editar línea */}
      <Dialog open={showLineaDialog} onOpenChange={setShowLineaDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {editingLineaId ? 'Editar Línea' : 'Nueva Línea'}
            </DialogTitle>
            <DialogDescription>
              Un viaje por línea. Los totales (a cobrar, combustible, detracción, utilidad) los calcula el servidor.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">N° Guía remitente</Label>
                <Input value={lineaForm.guia_remitente_numero} onChange={(e) => setLineaForm({ ...lineaForm, guia_remitente_numero: e.target.value })} className="rounded-sm" placeholder="EG07-00015087" data-testid="linea-form-guia-numero" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Fecha guía remitente</Label>
                <Input type="date" value={lineaForm.guia_remitente_fecha} onChange={(e) => setLineaForm({ ...lineaForm, guia_remitente_fecha: e.target.value })} className="rounded-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Placa</Label>
                <Input value={lineaForm.placa} onChange={(e) => setLineaForm({ ...lineaForm, placa: e.target.value })} className="rounded-sm" data-testid="linea-form-placa" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Conductor</Label>
                <Input value={lineaForm.conductor_nombre} onChange={(e) => setLineaForm({ ...lineaForm, conductor_nombre: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Viáticos (S/)</Label>
                <Input type="number" step="0.01" value={lineaForm.viaticos} onChange={(e) => setLineaForm({ ...lineaForm, viaticos: e.target.value })} className="rounded-sm" placeholder="Auto según placa" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isTonelada ? (
                <div className="space-y-2">
                  <Label className="input-label">Peso total carga (t) *</Label>
                  <Input type="number" step="0.01" value={lineaForm.peso_total_carga} onChange={(e) => setLineaForm({ ...lineaForm, peso_total_carga: e.target.value })} className="rounded-sm" data-testid="linea-form-peso" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="input-label">Cantidad de bolsas *</Label>
                  <Input type="number" value={lineaForm.cantidad_bolsas} onChange={(e) => setLineaForm({ ...lineaForm, cantidad_bolsas: e.target.value })} className="rounded-sm" data-testid="linea-form-bolsas" />
                </div>
              )}
              <div className="space-y-2">
                <Label className="input-label">Precio unitario (S/{isTonelada ? '/ton' : '/bolsa'}) *</Label>
                <Input type="number" step="0.01" value={lineaForm.precio_unitario} onChange={(e) => setLineaForm({ ...lineaForm, precio_unitario: e.target.value })} className="rounded-sm" data-testid="linea-form-precio" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Fecha vale combustible</Label>
                <Input type="date" value={lineaForm.fecha_vale_combustible} onChange={(e) => setLineaForm({ ...lineaForm, fecha_vale_combustible: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">N° Vale combustible</Label>
                <Input value={lineaForm.vale_combustible_numero} onChange={(e) => setLineaForm({ ...lineaForm, vale_combustible_numero: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Galones</Label>
                <Input type="number" step="0.01" value={lineaForm.liters} onChange={(e) => setLineaForm({ ...lineaForm, liters: e.target.value })} className="rounded-sm" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Precio combustible</Label>
                <Input type="number" step="0.01" value={lineaForm.price_per_liter} onChange={(e) => setLineaForm({ ...lineaForm, price_per_liter: e.target.value })} className="rounded-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Pago lo realizó</Label>
                <Input value={lineaForm.pago_realizo} onChange={(e) => setLineaForm({ ...lineaForm, pago_realizo: e.target.value })} className="rounded-sm" placeholder="Nombre de quién desembolsó" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Notas</Label>
                <Input value={lineaForm.notes} onChange={(e) => setLineaForm({ ...lineaForm, notes: e.target.value })} className="rounded-sm" />
              </div>
            </div>

            {/* Documentos */}
            <div className="space-y-3">
              <Label className="input-label flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Documentos (con extracción automática de datos)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {DOC_SLOTS.map(({ kind, label }) => (
                  <div key={kind} className="border rounded-lg p-3 space-y-2 bg-grafito-50">
                    <p className="text-xs font-semibold text-grafito-600">{label}</p>
                    {docPreview[kind] ? (
                      <img src={docPreview[kind]} alt={label} className="w-full h-24 object-cover rounded" />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-white border border-dashed rounded text-grafito-300">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="file" accept="image/*,application/pdf" capture="environment"
                        ref={(el) => { fileInputs.current[`${kind}-cam`] = el; }}
                        onChange={handleDocCapture(kind)} className="hidden"
                      />
                      <input
                        type="file" accept="image/*,application/pdf"
                        ref={(el) => { fileInputs.current[`${kind}-file`] = el; }}
                        onChange={handleDocCapture(kind)} className="hidden"
                      />
                      <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => fileInputs.current[`${kind}-cam`]?.click()}>
                        <Camera className="w-3.5 h-3.5" />
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => fileInputs.current[`${kind}-file`]?.click()}>
                        <ImageIcon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {docStatus[kind] === 'ocr' && <p className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Extrayendo datos...</p>}
                    {docStatus[kind] === 'uploading' && <p className="text-xs text-grafito-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Guardando...</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLineaDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleSaveLinea} disabled={saving} data-testid="linea-form-save-btn">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingLineaId ? 'Guardar Cambios' : 'Crear Línea'}
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
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleCloseLiquidacion} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Cerrar liquidación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo eliminar línea */}
      <Dialog open={showDeleteLineaDialog} onOpenChange={setShowDeleteLineaDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">Eliminar Línea</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteLineaDialog(false)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteLinea} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LiquidacionFleteDetailPage;
