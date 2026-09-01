import React, { useState, useEffect, useRef, useCallback } from 'react';
import { documentsApi, documentTypesApi, vehiclesApi, usersApi, uploadApi } from '../services/api';
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
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Upload,
  Download,
  Ban,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import EstadoVacio from '../components/EstadoVacio';

// Los archivos locales se sirven en `${BACKEND_URL}/uploads/...` (URL relativa);
// los de S3 ya vienen como URL absoluta.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const resolveFileUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const DocumentsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [entityType, setEntityType] = useState('vehicle');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // For creating documents
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // File upload
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    document_type_id: '',
    entity_type: 'vehicle',
    entity_id: '',
    number: '',
    issue_date: '',
    expiry_date: '',
    notes: '',
    file_url: '',
  });

  const fetchData = useCallback(async () => {
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
  }, [entityType]);

  // Equivalente exacto al array [entityType] anterior: lo unico que fetchData
  // lee de fuera es entityType.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleCreateDocument = async () => {
    setSaving(true);
    try {
      let fileUrl = formData.file_url || '';

      // Subir el archivo adjunto (si lo hay) antes de crear el documento.
      if (selectedFile) {
        try {
          const uploadRes = await uploadApi.upload(selectedFile, 'documents', formData.entity_id);
          fileUrl = uploadRes.data?.url || '';
        } catch (uploadErr) {
          toast.error(uploadErr.response?.data?.detail || 'Error al subir el archivo');
          setSaving(false);
          return;
        }
      }

      await documentsApi.create({
        ...formData,
        file_url: fileUrl || null,
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
      file_url: '',
    });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Regla: la Revisión Técnica solo aplica a vehículos que superan los 4 años.
  const isRevisionTecnica = (docType) =>
    (docType?.name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .includes('revision tecnica');

  const revisionTecnicaNoAplica = (docType, entity) => {
    if (entityType !== 'vehicle' || !isRevisionTecnica(docType)) return false;
    const year = entity?.year;
    if (!year) return false;
    const currentYear = new Date().getFullYear();
    return currentYear - year <= 4;
  };

  const FileLink = ({ doc }) =>
    doc?.file_url ? (
      <a
        href={resolveFileUrl(doc.file_url)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-grafito-400 hover:text-marca-500"
        title="Ver / descargar archivo"
        onClick={(e) => e.stopPropagation()}
        data-testid="doc-file-link"
      >
        <Download className="w-3 h-3" />
      </a>
    ) : null;

  const getStatusCell = (doc, docType, entity) => {
    // "No aplica" (Revisión Técnica en vehículos de 4 años o menos)
    if (revisionTecnicaNoAplica(docType, entity)) {
      return (
        <div
          className="doc-cell flex items-center justify-center gap-1 bg-grafito-100 text-grafito-400 border border-grafito-200 rounded"
          data-testid="doc-cell-no-aplica"
        >
          <Ban className="w-3 h-3" />
          <span>No aplica</span>
        </div>
      );
    }

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
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-grafito-900">
            Documentos
          </h1>
          <p className="text-grafito-500 mt-1">
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
        <TabsList className="bg-grafito-100 rounded-sm">
          <TabsTrigger
            value="vehicle"
            className="rounded-sm data-[state=active]:bg-grafito-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide"
          >
            Vehículos
          </TabsTrigger>
          <TabsTrigger
            value="user"
            className="rounded-sm data-[state=active]:bg-grafito-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide"
          >
            Choferes
          </TabsTrigger>
        </TabsList>

        <TabsContent value={entityType} className="mt-4">
          <Card className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
                  Matriz de Documentos - {entityType === 'vehicle' ? 'Vehículos' : 'Choferes'}
                </CardTitle>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-100 border border-green-500" />
                    <span className="text-xs text-grafito-500">Vigente</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-500" />
                    <span className="text-xs text-grafito-500">Por vencer</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-100 border border-red-500" />
                    <span className="text-xs text-grafito-500">Vencido</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-marca-500" />
                </div>
              ) : !matrix?.matrix?.length ? (
                /* La matriz vacia no es "sin documentos": es que aun no hay
                   filas (vehiculos o choferes) a las que colgarlos. La guia
                   lleva a crear el requisito, no a un formulario que va a
                   fallar. */
                entityType === 'vehicle' ? (
                  <EstadoVacio
                    icono={FileText}
                    titulo="Antes de cargar documentos, registra tus vehículos"
                    texto="Cada fila de esta matriz es un vehículo con sus SOAT, revisiones y permisos. Carga primero tu flota y vuelve aquí."
                    enlace={{ texto: 'Ir a Vehículos', onClick: () => navigate('/vehicles') }}
                  />
                ) : (
                  <EstadoVacio
                    icono={FileText}
                    titulo="Antes de cargar documentos, registra a tus choferes"
                    texto="Cada fila de esta matriz es un chofer con su licencia y demás documentos. Créalos en Usuarios y vuelve aquí."
                    enlace={{ texto: 'Ir a Usuarios', onClick: () => navigate('/users') }}
                  />
                )
              ) : (
                <>
                {/* Movil: tarjetas por entidad. La matriz entera no cabe en
                    375px, y el scroll lateral esconde justo los vencimientos
                    que la pagina existe para mostrar. */}
                <div className="md:hidden divide-y divide-grafito-100 dark:divide-grafito-800">
                  {matrix.matrix.map((row) => (
                    <div key={row.entity.id} className="px-4 py-3.5">
                      <p className="font-medium">
                        {entityType === 'vehicle' ? (
                          <span className="font-mono">{row.entity.plate}</span>
                        ) : (
                          row.entity.name
                        )}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                        {matrix.document_types.map((dt) => (
                          <div key={dt.id} className="min-w-0">
                            <p className="truncate text-[11px] uppercase tracking-wide text-grafito-500">
                              {dt.name}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1">
                              {getStatusCell(row.documents[dt.id], dt, row.entity)}
                              <FileLink doc={row.documents[dt.id]} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Escritorio: la matriz de siempre */}
                <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead className="sticky left-0 bg-grafito-100 z-10">
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
                      <TableRow key={row.entity.id} className="table-dense hover:bg-marca-50">
                        <TableCell className="sticky left-0 bg-white z-10 font-medium">
                          {entityType === 'vehicle' ? (
                            <span className="font-mono">{row.entity.plate}</span>
                          ) : (
                            row.entity.name
                          )}
                        </TableCell>
                        {matrix.document_types.map((dt) => (
                          <TableCell key={dt.id} className="text-center p-2">
                            <div className="flex items-center justify-center gap-1">
                              {getStatusCell(row.documents[dt.id], dt, row.entity)}
                              <FileLink doc={row.documents[dt.id]} />
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                </>
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
                <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">Vigentes</p>
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
                <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">Por Vencer</p>
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
                <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">Vencidos</p>
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
        <Card className="bg-white border-l-4 border-l-grafito-500 card-enter card-stagger-4">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-grafito-500 font-bold">Pendientes</p>
                <p className="font-heading text-3xl font-bold text-grafito-600 mt-1">
                  {matrix?.matrix?.reduce((acc, row) => 
                    acc + Object.values(row.documents).filter(d => !d).length, 0) || 0}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-grafito-500" />
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
            <div className="space-y-2">
              <Label className="input-label">Archivo Adjunto</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                data-testid="doc-file-input"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start border-dashed rounded-sm"
                onClick={() => fileInputRef.current?.click()}
                data-testid="doc-file-upload-btn"
              >
                <Upload className="w-4 h-4 mr-2" />
                {selectedFile ? 'Cambiar archivo' : 'Subir archivo (PDF o imagen)'}
              </Button>
              {selectedFile && (
                <div className="flex items-center justify-between gap-2 text-xs text-grafito-600 bg-grafito-50 rounded-sm px-2 py-1">
                  <span className="flex items-center gap-1 truncate">
                    <Paperclip className="w-3 h-3 shrink-0" />
                    <span className="truncate">{selectedFile.name}</span>
                  </span>
                  <button
                    type="button"
                    className="text-grafito-400 hover:text-red-500 shrink-0"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    data-testid="doc-file-remove-btn"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              )}
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
