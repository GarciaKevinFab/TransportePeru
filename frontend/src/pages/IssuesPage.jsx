import React, { useState, useEffect } from 'react';
import { issuesApi, vehiclesApi, usersApi, tripsApi } from '../services/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
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
import {
  AlertTriangle,
  Plus,
  Loader2,
  Search,
  CheckCircle,
  AlertCircle,
  Car,
  User,
  FileText,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import EstadoVacio from '../components/EstadoVacio';

const IssuesPage = () => {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    issue_type: 'incidente',
    severity: 'media',
    title: '',
    description: '',
    vehicle_id: '',
    driver_id: '',
    trip_id: '',
    cost: '',
  });
  
  const [resolveData, setResolveData] = useState({
    resolution: '',
  });

  const issueTypes = [
    { value: 'incidente', label: 'Incidente', icon: AlertTriangle, color: 'text-marca-500' },
    { value: 'multa', label: 'Multa', icon: FileText, color: 'text-red-500' },
    { value: 'siniestro', label: 'Siniestro', icon: Car, color: 'text-red-600' },
    { value: 'checklist_critico', label: 'Checklist Crítico', icon: AlertCircle, color: 'text-yellow-500' },
    { value: 'llanta_critica', label: 'Llanta Crítica', icon: AlertCircle, color: 'text-marca-600' },
    { value: 'otro', label: 'Otro', icon: AlertTriangle, color: 'text-slate-500' },
  ];

  const severities = [
    { value: 'baja', label: 'Baja', color: 'bg-slate-100 text-slate-700' },
    { value: 'media', label: 'Media', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'alta', label: 'Alta', color: 'bg-marca-100 text-marca-700' },
    { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-700' },
  ];

  const statuses = [
    { value: 'abierto', label: 'Abierto', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'en_proceso', label: 'En Proceso', color: 'bg-blue-100 text-blue-700' },
    { value: 'cerrado', label: 'Cerrado', color: 'bg-green-100 text-green-700' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [issuesRes, vehiclesRes, driversRes, tripsRes] = await Promise.all([
        issuesApi.getAll(),
        vehiclesApi.getAll(),
        usersApi.getAll({ role: 'chofer' }),
        tripsApi.getAll(),
      ]);
      setIssues(issuesRes.data);
      setVehicles(vehiclesRes.data);
      setDrivers(driversRes.data);
      setTrips(tripsRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         issue.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         issue.issue_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || issue.severity === severityFilter;
    const matchesType = typeFilter === 'all' || issue.issue_type === typeFilter;
    return matchesSearch && matchesStatus && matchesSeverity && matchesType;
  });

  const handleCreateIssue = async () => {
    if (!formData.title || !formData.description) {
      toast.error('Título y descripción son requeridos');
      return;
    }
    
    setSaving(true);
    try {
      await issuesApi.create({
        ...formData,
        cost: parseFloat(formData.cost) || 0,
      });
      toast.success('Incidente creado exitosamente');
      setShowCreateDialog(false);
      setFormData({
        issue_type: 'incidente',
        severity: 'media',
        title: '',
        description: '',
        vehicle_id: '',
        driver_id: '',
        trip_id: '',
        cost: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear incidente');
    }
    setSaving(false);
  };

  const handleResolveIssue = async () => {
    if (!selectedIssue) return;
    
    setSaving(true);
    try {
      await issuesApi.update(selectedIssue.id, {
        status: 'cerrado',
        resolution: resolveData.resolution,
      });
      toast.success('Incidente resuelto');
      setShowDetailDialog(false);
      setSelectedIssue(null);
      setResolveData({ resolution: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al resolver incidente');
    }
    setSaving(false);
  };

  const handleUpdateStatus = async (issueId, newStatus) => {
    try {
      await issuesApi.update(issueId, { status: newStatus });
      toast.success('Estado actualizado');
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const getVehiclePlate = (id) => vehicles.find(v => v.id === id)?.plate || '-';
  const getDriverName = (id) => drivers.find(d => d.id === id)?.name || '-';
  const getTypeInfo = (type) => issueTypes.find(t => t.value === type) || issueTypes[5];
  const getSeverityInfo = (sev) => severities.find(s => s.value === sev) || severities[1];
  const getStatusInfo = (status) => statuses.find(s => s.value === status) || statuses[0];

  /* Un solo menu de acciones para la tabla (escritorio) y las tarjetas (movil), igual que AccionesViaje en TripsPage: una accion nueva aparece en ambas vistas o en ninguna. */
  const AccionesIncidente = ({ issue }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => {
          setSelectedIssue(issue);
          setShowDetailDialog(true);
        }}>
          <FileText className="w-4 h-4 mr-2" />
          Ver Detalle
        </DropdownMenuItem>
        {issue.status === 'abierto' && (
          <DropdownMenuItem onClick={() => handleUpdateStatus(issue.id, 'en_proceso')}>
            <AlertCircle className="w-4 h-4 mr-2" />
            Marcar En Proceso
          </DropdownMenuItem>
        )}
        {issue.status !== 'cerrado' && (
          <DropdownMenuItem onClick={() => {
            setSelectedIssue(issue);
            setShowDetailDialog(true);
          }}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Resolver
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const openIssues = issues.filter(i => i.status === 'abierto').length;
  const criticalIssues = issues.filter(i => i.severity === 'critica' && i.status !== 'cerrado').length;
  const totalCost = issues.reduce((a, b) => a + (b.cost || 0), 0);

  return (
    <div className="space-y-6 page-fade-in" data-testid="issues-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Incidentes
          </h1>
          <p className="text-slate-500 mt-1">
            Gestión de incidentes, multas y siniestros
          </p>
        </div>
        <Button className="btn-action btn-press" onClick={() => setShowCreateDialog(true)} data-testid="new-issue-btn">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Incidente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-yellow-500 card-enter card-stagger-1">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Abiertos</p>
                <p className="font-heading text-3xl font-bold text-yellow-600 mt-1">{openIssues}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-red-500 card-enter card-stagger-2">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Críticos</p>
                <p className="font-heading text-3xl font-bold text-red-600 mt-1">{criticalIssues}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-green-500 card-enter card-stagger-3">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Resueltos</p>
                <p className="font-heading text-3xl font-bold text-green-600 mt-1">
                  {issues.filter(i => i.status === 'cerrado').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-marca-500 card-enter card-stagger-4">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Costo Total</p>
                <p className="font-heading text-2xl font-bold text-marca-600 mt-1">
                  S/ {totalCost.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white section-enter">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por título, descripción o número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-sm"
                data-testid="issue-search-input"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px] rounded-sm">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {statuses.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full sm:w-[150px] rounded-sm">
                  <SelectValue placeholder="Severidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {severities.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[150px] rounded-sm">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {issueTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues Table */}
      <Card className="bg-white section-enter section-stagger-1">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-marca-500" />
            </div>
          ) : filteredIssues.length === 0 ? (
            /* Vacio con guia: si hay incidentes pero el filtro no casa, no se
               ofrece crear otro; si la lista total esta vacia, el vacio es la
               invitacion a registrar el primero. */
            issues.length > 0 ? (
              <EstadoVacio
                icono={AlertTriangle}
                titulo="Sin resultados"
                texto="Ningún incidente coincide con la búsqueda o los filtros."
                filtrado
              />
            ) : (
              <EstadoVacio
                icono={AlertTriangle}
                titulo="Registra tu primer incidente"
                texto="Multas, siniestros y hallazgos críticos quedan aquí con su costo, para que nada se pierda en un cuaderno."
                accion={{ texto: 'Nuevo incidente', onClick: () => setShowCreateDialog(true) }}
              />
            )
          ) : (
            <>
            {/* Movil: tarjetas. Diez columnas en 375px esconden estado y acciones tras un arrastre lateral que nadie descubre. */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredIssues.map((issue) => {
                const typeInfo = getTypeInfo(issue.issue_type);
                const TypeIcon = typeInfo.icon;
                return (
                  <div key={issue.id} className="flex items-start gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{issue.title}</span>
                        <Badge className={getStatusInfo(issue.status).color}>
                          {getStatusInfo(issue.status).label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        <span className="font-mono font-bold">{issue.issue_number || '-'}</span>
                        {' · '}
                        {typeInfo.label}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        <Badge className={getSeverityInfo(issue.severity).color}>
                          {getSeverityInfo(issue.severity).label}
                        </Badge>
                        <span className="inline-flex items-center gap-1">
                          <TypeIcon className={`h-3 w-3 ${typeInfo.color}`} />
                          {getVehiclePlate(issue.vehicle_id)}
                        </span>
                        <span>S/ {issue.cost?.toFixed(2) || '0.00'}</span>
                        <span>{format(new Date(issue.created_at), 'dd/MM/yy', { locale: es })}</span>
                      </p>
                    </div>
                    <AccionesIncidente issue={issue} />
                  </div>
                );
              })}
            </div>

            {/* Escritorio: la tabla de siempre */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="table-dense">
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIssues.map((issue) => {
                  const typeInfo = getTypeInfo(issue.issue_type);
                  const TypeIcon = typeInfo.icon;
                  return (
                    <TableRow key={issue.id} className="table-dense cursor-pointer hover:bg-slate-50">
                      <TableCell className="font-mono font-bold">{issue.issue_number || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypeIcon className={`w-4 h-4 ${typeInfo.color}`} />
                          <span className="text-sm">{typeInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="font-medium truncate">{issue.title}</p>
                      </TableCell>
                      <TableCell>{getVehiclePlate(issue.vehicle_id)}</TableCell>
                      <TableCell>{getDriverName(issue.driver_id)}</TableCell>
                      <TableCell>
                        <Badge className={getSeverityInfo(issue.severity).color}>
                          {getSeverityInfo(issue.severity).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusInfo(issue.status).color}>
                          {getStatusInfo(issue.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell>S/ {issue.cost?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {format(new Date(issue.created_at), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <AccionesIncidente issue={issue} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nuevo Incidente
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Tipo de Incidente *</Label>
                <Select value={formData.issue_type} onValueChange={(v) => setFormData({ ...formData, issue_type: v })}>
                  <SelectTrigger className="rounded-sm" data-testid="issue-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {issueTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Severidad *</Label>
                <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {severities.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Breve descripción del incidente"
                className="rounded-sm"
                data-testid="issue-title-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Descripción Detallada *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe el incidente con todos los detalles relevantes..."
                className="rounded-sm"
                rows={4}
                data-testid="issue-description-input"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Vehículo</Label>
                <Select value={formData.vehicle_id} onValueChange={(v) => setFormData({ ...formData, vehicle_id: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.plate} - {v.brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Chofer</Label>
                <Select value={formData.driver_id} onValueChange={(v) => setFormData({ ...formData, driver_id: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Viaje Relacionado</Label>
                <Select value={formData.trip_id || "none"} onValueChange={(v) => setFormData({ ...formData, trip_id: v === "none" ? "" : v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {trips.slice(0, 20).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.client_name || 'Sin cliente'} - {format(new Date(t.scheduled_date), 'dd/MM')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Costo Estimado (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  placeholder="0.00"
                  className="rounded-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button 
              className="btn-action" 
              onClick={handleCreateIssue}
              disabled={!formData.title || !formData.description || saving}
              data-testid="save-issue-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Incidente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail/Resolve Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {selectedIssue?.issue_number} - {selectedIssue?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedIssue && (
            <div className="py-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-slate-50 rounded-sm">
                  <p className="text-xs uppercase text-slate-500 font-bold">Tipo</p>
                  <p className="font-medium mt-1">{getTypeInfo(selectedIssue.issue_type).label}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-sm">
                  <p className="text-xs uppercase text-slate-500 font-bold">Severidad</p>
                  <Badge className={getSeverityInfo(selectedIssue.severity).color + ' mt-1'}>
                    {getSeverityInfo(selectedIssue.severity).label}
                  </Badge>
                </div>
                <div className="p-3 bg-slate-50 rounded-sm">
                  <p className="text-xs uppercase text-slate-500 font-bold">Estado</p>
                  <Badge className={getStatusInfo(selectedIssue.status).color + ' mt-1'}>
                    {getStatusInfo(selectedIssue.status).label}
                  </Badge>
                </div>
                <div className="p-3 bg-slate-50 rounded-sm">
                  <p className="text-xs uppercase text-slate-500 font-bold">Costo</p>
                  <p className="font-medium mt-1">S/ {selectedIssue.cost?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
              
              <div className="p-3 bg-slate-50 rounded-sm mb-4">
                <p className="text-xs uppercase text-slate-500 font-bold mb-2">Descripción</p>
                <p className="text-sm text-slate-700">{selectedIssue.description}</p>
              </div>

              {selectedIssue.vehicle_id && (
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                  <Car className="w-4 h-4" />
                  <span>Vehículo: {getVehiclePlate(selectedIssue.vehicle_id)}</span>
                </div>
              )}
              {selectedIssue.driver_id && (
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                  <User className="w-4 h-4" />
                  <span>Chofer: {getDriverName(selectedIssue.driver_id)}</span>
                </div>
              )}

              {selectedIssue.resolution && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-sm mb-4">
                  <p className="text-xs uppercase text-green-700 font-bold mb-1">Resolución</p>
                  <p className="text-sm text-green-800">{selectedIssue.resolution}</p>
                </div>
              )}

              {selectedIssue.status !== 'cerrado' && (
                <div className="border-t pt-4">
                  <Label className="input-label">Resolución</Label>
                  <Textarea
                    value={resolveData.resolution}
                    onChange={(e) => setResolveData({ resolution: e.target.value })}
                    placeholder="Describe cómo se resolvió el incidente..."
                    className="rounded-sm mt-2"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDetailDialog(false);
              setSelectedIssue(null);
              setResolveData({ resolution: '' });
            }}>
              Cerrar
            </Button>
            {selectedIssue?.status !== 'cerrado' && (
              <Button 
                className="btn-action bg-green-600 hover:bg-green-700" 
                onClick={handleResolveIssue}
                disabled={saving}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <CheckCircle className="w-4 h-4 mr-2" />
                Resolver Incidente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IssuesPage;
