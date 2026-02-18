import React, { useState, useEffect } from 'react';
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
import { Switch } from '../components/ui/switch';
import {
  Settings,
  Plus,
  Loader2,
  FileText,
  ClipboardList,
  Building2,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

const SettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('company');
  
  // Data
  const [company, setCompany] = useState(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  
  // Dialogs
  const [showDocTypeDialog, setShowDocTypeDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingDocType, setEditingDocType] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  // Forms
  const [docTypeForm, setDocTypeForm] = useState({
    name: '',
    applies_to: 'vehiculo',
    is_critical: false,
    requires_expiry: true,
    block_rule: 'solo_alerta',
  });
  
  const [templateForm, setTemplateForm] = useState({
    name: '',
    vehicle_type: '',
    items: [],
    is_active: true,
  });
  
  const [companyForm, setCompanyForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    config: {},
  });
  
  const [newChecklistItem, setNewChecklistItem] = useState({
    category: '',
    item: '',
    is_critical: false,
    requires_photo: false,
  });

  const blockRules = [
    { value: 'solo_alerta', label: 'Solo Alerta', description: 'Solo muestra advertencia' },
    { value: 'bloquea_asignacion', label: 'Bloquea Asignación', description: 'No permite asignar a viaje' },
    { value: 'bloquea_inicio', label: 'Bloquea Inicio', description: 'No permite iniciar viaje' },
  ];

  const appliesTo = [
    { value: 'vehiculo', label: 'Vehículo' },
    { value: 'chofer', label: 'Chofer' },
    { value: 'empresa', label: 'Empresa' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [companyRes, docTypesRes, templatesRes] = await Promise.all([
        api.get('/config/company'),
        api.get('/config/document-types'),
        api.get('/config/checklist-templates'),
      ]);
      setCompany(companyRes.data);
      setCompanyForm({
        name: companyRes.data?.name || '',
        address: companyRes.data?.address || '',
        phone: companyRes.data?.phone || '',
        email: companyRes.data?.email || '',
        config: companyRes.data?.config || {},
      });
      setDocumentTypes(docTypesRes.data);
      setChecklistTemplates(templatesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      await api.put('/config/company', companyForm);
      toast.success('Configuración guardada');
      fetchData();
    } catch (error) {
      toast.error('Error al guardar configuración');
    }
    setSaving(false);
  };

  const handleSaveDocType = async () => {
    if (!docTypeForm.name) {
      toast.error('El nombre es requerido');
      return;
    }
    
    setSaving(true);
    try {
      if (editingDocType) {
        await api.put(`/config/document-types/${editingDocType.id}`, docTypeForm);
        toast.success('Tipo de documento actualizado');
      } else {
        await api.post('/config/document-types', docTypeForm);
        toast.success('Tipo de documento creado');
      }
      setShowDocTypeDialog(false);
      setEditingDocType(null);
      setDocTypeForm({
        name: '',
        applies_to: 'vehiculo',
        is_critical: false,
        requires_expiry: true,
        block_rule: 'solo_alerta',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar');
    }
    setSaving(false);
  };

  const handleDeleteDocType = async (id) => {
    if (!confirm('¿Eliminar este tipo de documento?')) return;
    
    try {
      await api.delete(`/config/document-types/${id}`);
      toast.success('Tipo de documento eliminado');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleEditDocType = (docType) => {
    setEditingDocType(docType);
    setDocTypeForm({
      name: docType.name,
      applies_to: docType.applies_to,
      is_critical: docType.is_critical,
      requires_expiry: docType.requires_expiry,
      block_rule: docType.block_rule,
    });
    setShowDocTypeDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name) {
      toast.error('El nombre es requerido');
      return;
    }
    
    setSaving(true);
    try {
      if (editingTemplate) {
        await api.put(`/config/checklist-templates/${editingTemplate.id}`, templateForm);
        toast.success('Plantilla actualizada');
      } else {
        await api.post('/config/checklist-templates', templateForm);
        toast.success('Plantilla creada');
      }
      setShowTemplateDialog(false);
      setEditingTemplate(null);
      setTemplateForm({
        name: '',
        vehicle_type: '',
        items: [],
        is_active: true,
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar');
    }
    setSaving(false);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      vehicle_type: template.vehicle_type || '',
      items: template.items || [],
      is_active: template.is_active,
    });
    setShowTemplateDialog(true);
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.category || !newChecklistItem.item) {
      toast.error('Categoría e ítem son requeridos');
      return;
    }
    
    setTemplateForm({
      ...templateForm,
      items: [...templateForm.items, { ...newChecklistItem, id: Date.now().toString() }],
    });
    setNewChecklistItem({
      category: '',
      item: '',
      is_critical: false,
      requires_photo: false,
    });
  };

  const handleRemoveChecklistItem = (index) => {
    setTemplateForm({
      ...templateForm,
      items: templateForm.items.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="settings-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Configuración
          </h1>
          <p className="text-slate-500 mt-1">
            Configuración general del sistema
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 rounded-sm">
          <TabsTrigger value="company" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <Building2 className="w-4 h-4 mr-2" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <FileText className="w-4 h-4 mr-2" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="checklists" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            <ClipboardList className="w-4 h-4 mr-2" />
            Checklists
          </TabsTrigger>
        </TabsList>

        {/* Company Tab */}
        <TabsContent value="company" className="mt-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="font-heading uppercase text-lg">Datos de la Empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="input-label">Nombre de la Empresa</Label>
                  <Input
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    className="rounded-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="input-label">RUC</Label>
                  <Input value={company?.ruc || ''} disabled className="rounded-sm bg-slate-50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Dirección</Label>
                <Input
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="rounded-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="input-label">Teléfono</Label>
                  <Input
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    className="rounded-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="input-label">Email</Label>
                  <Input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="rounded-sm"
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h3 className="font-bold uppercase text-sm text-slate-500 mb-4">Configuración Operativa</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Requerir checklist para iniciar viaje</p>
                      <p className="text-sm text-slate-500">El chofer debe completar el checklist antes de iniciar</p>
                    </div>
                    <Switch
                      checked={companyForm.config?.require_checklist_for_start ?? true}
                      onCheckedChange={(checked) => setCompanyForm({
                        ...companyForm,
                        config: { ...companyForm.config, require_checklist_for_start: checked }
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Bloquear viaje con checklist crítico</p>
                      <p className="text-sm text-slate-500">No permite iniciar si hay items críticos fallidos</p>
                    </div>
                    <Switch
                      checked={companyForm.config?.block_trip_on_critical_checklist ?? true}
                      onCheckedChange={(checked) => setCompanyForm({
                        ...companyForm,
                        config: { ...companyForm.config, block_trip_on_critical_checklist: checked }
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Crear incidencia automática</p>
                      <p className="text-sm text-slate-500">Crea incidente cuando hay checklist crítico</p>
                    </div>
                    <Switch
                      checked={companyForm.config?.auto_create_issue_on_critical ?? true}
                      onCheckedChange={(checked) => setCompanyForm({
                        ...companyForm,
                        config: { ...companyForm.config, auto_create_issue_on_critical: checked }
                      })}
                    />
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <Button className="btn-action" onClick={handleSaveCompany} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading uppercase text-lg">Tipos de Documento</CardTitle>
              <Button className="btn-action" onClick={() => {
                setEditingDocType(null);
                setDocTypeForm({
                  name: '',
                  applies_to: 'vehiculo',
                  is_critical: false,
                  requires_expiry: true,
                  block_rule: 'solo_alerta',
                });
                setShowDocTypeDialog(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Tipo
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="table-dense">
                    <TableHead>Nombre</TableHead>
                    <TableHead>Aplica a</TableHead>
                    <TableHead>Crítico</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Regla de Bloqueo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentTypes.map((dt) => (
                    <TableRow key={dt.id} className="table-dense">
                      <TableCell className="font-medium">{dt.name}</TableCell>
                      <TableCell className="capitalize">{dt.applies_to}</TableCell>
                      <TableCell>
                        {dt.is_critical ? (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {dt.requires_expiry ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          dt.block_rule === 'bloquea_inicio' ? 'bg-red-100 text-red-700' :
                          dt.block_rule === 'bloquea_asignacion' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100'
                        }>
                          {blockRules.find(r => r.value === dt.block_rule)?.label || dt.block_rule}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => handleEditDocType(dt)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteDocType(dt.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checklists Tab */}
        <TabsContent value="checklists" className="mt-4">
          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading uppercase text-lg">Plantillas de Checklist</CardTitle>
              <Button className="btn-action" onClick={() => {
                setEditingTemplate(null);
                setTemplateForm({
                  name: '',
                  vehicle_type: '',
                  items: [],
                  is_active: true,
                });
                setShowTemplateDialog(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Plantilla
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {checklistTemplates.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-2" />
                  <p>No hay plantillas de checklist</p>
                  <p className="text-sm">Se usará la plantilla por defecto del sistema</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo Vehículo</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checklistTemplates.map((t) => (
                      <TableRow key={t.id} className="table-dense">
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="capitalize">{t.vehicle_type || 'Todos'}</TableCell>
                        <TableCell>{t.items?.length || 0} items</TableCell>
                        <TableCell>
                          <Badge className={t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                            {t.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleEditTemplate(t)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Document Type Dialog */}
      <Dialog open={showDocTypeDialog} onOpenChange={setShowDocTypeDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {editingDocType ? 'Editar Tipo de Documento' : 'Nuevo Tipo de Documento'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="input-label">Nombre *</Label>
              <Input
                value={docTypeForm.name}
                onChange={(e) => setDocTypeForm({ ...docTypeForm, name: e.target.value })}
                className="rounded-sm"
                placeholder="Ej: SOAT, Revisión Técnica..."
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Aplica a</Label>
              <Select value={docTypeForm.applies_to} onValueChange={(v) => setDocTypeForm({ ...docTypeForm, applies_to: v })}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {appliesTo.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Regla de Bloqueo</Label>
              <Select value={docTypeForm.block_rule} onValueChange={(v) => setDocTypeForm({ ...docTypeForm, block_rule: v })}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {blockRules.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <p>{r.label}</p>
                        <p className="text-xs text-slate-500">{r.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Es documento crítico</Label>
              <Switch
                checked={docTypeForm.is_critical}
                onCheckedChange={(checked) => setDocTypeForm({ ...docTypeForm, is_critical: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Requiere fecha de vencimiento</Label>
              <Switch
                checked={docTypeForm.requires_expiry}
                onCheckedChange={(checked) => setDocTypeForm({ ...docTypeForm, requires_expiry: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocTypeDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleSaveDocType} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingDocType ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklist Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla de Checklist'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Nombre *</Label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="rounded-sm"
                  placeholder="Ej: Checklist Tracto..."
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Tipo de Vehículo</Label>
                <Select value={templateForm.vehicle_type} onValueChange={(v) => setTemplateForm({ ...templateForm, vehicle_type: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="tracto">Tracto</SelectItem>
                    <SelectItem value="carreta">Carreta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Plantilla Activa</Label>
              <Switch
                checked={templateForm.is_active}
                onCheckedChange={(checked) => setTemplateForm({ ...templateForm, is_active: checked })}
              />
            </div>
            
            <div className="border-t pt-4">
              <h3 className="font-bold uppercase text-sm text-slate-500 mb-4">Items del Checklist</h3>
              
              {/* Add Item Form */}
              <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-slate-50 rounded-sm">
                <Input
                  placeholder="Categoría"
                  value={newChecklistItem.category}
                  onChange={(e) => setNewChecklistItem({ ...newChecklistItem, category: e.target.value })}
                  className="rounded-sm"
                />
                <Input
                  placeholder="Item a verificar"
                  value={newChecklistItem.item}
                  onChange={(e) => setNewChecklistItem({ ...newChecklistItem, item: e.target.value })}
                  className="rounded-sm"
                />
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={newChecklistItem.is_critical}
                      onChange={(e) => setNewChecklistItem({ ...newChecklistItem, is_critical: e.target.checked })}
                    />
                    Crítico
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={newChecklistItem.requires_photo}
                      onChange={(e) => setNewChecklistItem({ ...newChecklistItem, requires_photo: e.target.checked })}
                    />
                    Foto
                  </label>
                </div>
                <Button size="sm" onClick={handleAddChecklistItem}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Items List */}
              {templateForm.items.length === 0 ? (
                <p className="text-center text-slate-400 py-4">No hay items. Agregue items usando el formulario de arriba.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {templateForm.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                        <span>{item.item}</span>
                        {item.is_critical && <AlertTriangle className="w-4 h-4 text-red-500" />}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveChecklistItem(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleSaveTemplate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
