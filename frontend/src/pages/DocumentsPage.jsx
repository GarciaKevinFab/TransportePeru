import React, { useState, useEffect } from 'react';
import { documentsApi, documentTypesApi, vehiclesApi, usersApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
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
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  FileText,
  Plus,
  Loader2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

const DocumentsPage = () => {
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [entityType, setEntityType] = useState('vehicle');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // For creating documents
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    document_type_id: '',
    entity_type: 'vehicle',
    entity_id: '',
    number: '',
    issue_date: '',
    expiry_date: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const appliesTo = entityType === 'vehicle' ? 'vehiculo' : 'chofer';
      const [matrixRes, typesRes, vehiclesRes, driversRes] = await Promise.all([
        documentsApi.getMatrix(entityType),
        documentTypesApi.getAll({ applies_to: appliesTo }),
        vehiclesApi.getAll(),
        usersApi.getAll({ role: 'chofer' }),
      ]);
      setMatrix(matrixRes.data);
      // Use types from matrix response if available, otherwise from types endpoint
      setDocumentTypes(matrixRes.data.document_types || typesRes.data);
      setVehicles(vehiclesRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      toast.error('Error al cargar documentos');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [entityType]);

  const handleCreateDocument = async () => {
    setSaving(true);
    try {
      await documentsApi.create({
        ...formData,
        issue_date: formData.issue_date ? new Date(formData.issue_date).toISOString() : null,
        expiry_date: formData.expiry_date ? new Date(formData.expiry_date).toISOString() : null,
      });
      toast.success('Documento creado exitosamente');
      setShowCreateDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear documento');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFormData({
      document_type_id: '',
      entity_type: entityType,
      entity_id: '',
      number: '',
      issue_date: '',
      expiry_date: '',
      notes: '',
    });
  };

  const getStatusCell = (doc, docType) => {
    if (!doc) {
      return (
        <div className="doc-cell pendiente flex items-center justify-center gap-1">
          <XCircle className="w-3 h-3" />
          <span>Sin doc</span>
        </div>
      );
    }

    const expiryDate = doc.expiry_date ? new Date(doc.expiry_date) : null;
    const daysUntil = expiryDate ? differenceInDays(expiryDate, new Date()) : null;

    if (daysUntil !== null) {
      if (daysUntil < 0) {
        return (
          <div className="doc-cell vencido flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Vencido</span>
          </div>
        );
      } else if (daysUntil <= 30) {
        return (
          <div className="doc-cell por-vencer flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{daysUntil}d</span>
          </div>
        );
      } else {
        return (
          <div className="doc-cell vigente flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>{format(expiryDate, 'dd/MM/yy')}</span>
          </div>
        );
      }
    }

    return (
      <div className="doc-cell vigente flex items-center justify-center gap-1">
        <CheckCircle className="w-3 h-3" />
        <span>OK</span>
      </div>
    );
  };

  const entities = entityType === 'vehicle' ? vehicles : drivers;

  return (
    <div className="space-y-6 page-fade-in" data-testid="documents-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Documentos
          </h1>
          <p className="text-slate-500 mt-1">
            Matriz de documentos y vencimientos
          </p>
        </div>
        <Button
          className="btn-action btn-press"
          onClick={() => {
            setFormData({ ...formData, entity_type: entityType });
            setShowCreateDialog(true);
          }}
          data-testid="new-document-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Documento
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={entityType} onValueChange={setEntityType}>
        <TabsList className="bg-slate-100 rounded-sm">
          <TabsTrigger
            value="vehicle"
            className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide"
          >
            Vehículos
          </TabsTrigger>
          <TabsTrigger
            value="user"
            className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide"
          >
            Choferes
          </TabsTrigger>
        </TabsList>

        <TabsContent value={entityType} className="mt-4">
          <Card className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                  Matriz de Documentos - {entityType === 'vehicle' ? 'Vehículos' : 'Choferes'}
                </CardTitle>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-100 border border-green-500" />
                    <span className="text-xs text-slate-500">Vigente</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-500" />
                    <span className="text-xs text-slate-500">Por vencer</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-100 border border-red-500" />
                    <span className="text-xs text-slate-500">Vencido</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : !matrix?.matrix?.length ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <FileText className="w-12 h-12 mb-2" />
                  <p>No hay datos para mostrar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead className="sticky left-0 bg-slate-100 z-10">
                        {entityType === 'vehicle' ? 'Placa' : 'Nombre'}
                      </TableHead>
                      {matrix.document_types.map((dt) => (
                        <TableHead key={dt.id} className="text-center min-w-[100px]">
                          <div className="flex flex-col items-center">
                            <span>{dt.name}</span>
                            {dt.is_critical && (
                              <Badge variant="destructive" className="text-[10px] mt-1">
                                Crítico
                              </Badge>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrix.matrix.map((row) => (
                      <TableRow key={row.entity.id} className="table-dense hover:bg-orange-50">
                        <TableCell className="sticky left-0 bg-white z-10 font-medium">
                          {entityType === 'vehicle' ? (
                            <span className="font-mono">{row.entity.plate}</span>
                          ) : (
                            row.entity.name
                          )}
                        </TableCell>
                        {matrix.document_types.map((dt) => (
                          <TableCell key={dt.id} className="text-center p-2">
                            {getStatusCell(row.documents[dt.id], dt)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-green-500 card-enter card-stagger-1">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Vigentes</p>
                <p className="font-heading text-3xl font-bold text-green-600 mt-1">
                  {matrix?.matrix?.reduce((acc, row) => 
                    acc + Object.values(row.documents).filter(d => {
                      if (!d?.expiry_date) return true;
                      return differenceInDays(new Date(d.expiry_date), new Date()) > 30;
                    }).length, 0) || 0}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-yellow-500 card-enter card-stagger-2">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Por Vencer</p>
                <p className="font-heading text-3xl font-bold text-yellow-600 mt-1">
                  {matrix?.matrix?.reduce((acc, row) => 
                    acc + Object.values(row.documents).filter(d => {
                      if (!d?.expiry_date) return false;
                      const days = differenceInDays(new Date(d.expiry_date), new Date());
                      return days >= 0 && days <= 30;
                    }).length, 0) || 0}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-red-500 card-enter card-stagger-3">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Vencidos</p>
                <p className="font-heading text-3xl font-bold text-red-600 mt-1">
                  {matrix?.matrix?.reduce((acc, row) => 
                    acc + Object.values(row.documents).filter(d => {
                      if (!d?.expiry_date) return false;
                      return differenceInDays(new Date(d.expiry_date), new Date()) < 0;
                    }).length, 0) || 0}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-slate-500 card-enter card-stagger-4">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Pendientes</p>
                <p className="font-heading text-3xl font-bold text-slate-600 mt-1">
                  {matrix?.matrix?.reduce((acc, row) => 
                    acc + Object.values(row.documents).filter(d => !d).length, 0) || 0}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-slate-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Document Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nuevo Documento
            </DialogTitle>
            <DialogDescription>
              Registrar un nuevo documento para {entityType === 'vehicle' ? 'vehículo' : 'chofer'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="input-label">
                {entityType === 'vehicle' ? 'Vehículo' : 'Chofer'} *
              </Label>
              <Select
                value={formData.entity_id}
                onValueChange={(v) => setFormData({ ...formData, entity_id: v })}
              >
                <SelectTrigger className="rounded-sm" data-testid="doc-entity-select">
                  <SelectValue placeholder={`Seleccionar ${entityType === 'vehicle' ? 'vehículo' : 'chofer'}`} />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {entityType === 'vehicle' ? `${e.plate} - ${e.brand}` : e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Tipo de Documento *</Label>
              <Select
                value={formData.document_type_id}
                onValueChange={(v) => setFormData({ ...formData, document_type_id: v })}
              >
                <SelectTrigger className="rounded-sm" data-testid="doc-type-select">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id}>
                      {dt.name} {dt.is_critical && '(Crítico)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Número de Documento</Label>
              <Input
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                placeholder="Número o código"
                className="rounded-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Fecha de Emisión</Label>
                <Input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Fecha de Vencimiento</Label>
                <Input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  className="rounded-sm"
                  data-testid="doc-expiry-input"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleCreateDocument}
              disabled={!formData.entity_id || !formData.document_type_id || saving}
              data-testid="save-document-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsPage;
