import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Building2, Plus, Loader2, Users, Truck, Route, MoreVertical, Edit, Trash2, BarChart3, ArrowRightLeft,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const CompaniesPage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyStats, setCompanyStats] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/companies');
      setCompanies(res.data);
    } catch (error) {
      toast.error('Error al cargar empresas');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '', ruc: '', address: '', phone: '', email: '',
      admin_name: '', admin_email: '', admin_password: '',
    });
    setSelectedCompany(null);
  };

  const handleCreateCompany = async () => {
    if (!formData.name) {
      toast.error('Ingrese el nombre de la empresa');
      return;
    }
    setSaving(true);
    try {
      await api.post('/companies', formData);
      toast.success('Empresa creada exitosamente');
      setShowCreateDialog(false);
      resetForm();
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear empresa');
    }
    setSaving(false);
  };

  const handleEditCompany = (company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name || '',
      ruc: company.ruc || '',
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || '',
      admin_name: '', admin_email: '', admin_password: '',
    });
    setShowEditDialog(true);
  };

  const handleUpdateCompany = async () => {
    if (!selectedCompany) return;
    setSaving(true);
    try {
      await api.put(`/companies/${selectedCompany.id}`, {
        name: formData.name,
        ruc: formData.ruc,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
      });
      toast.success('Empresa actualizada');
      setShowEditDialog(false);
      resetForm();
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar');
    }
    setSaving(false);
  };

  const handleDeleteCompany = async (companyId) => {
    if (!confirm('¿Eliminar esta empresa y TODOS sus datos? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/companies/${companyId}`);
      toast.success('Empresa eliminada');
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleSwitchCompany = async (company) => {
    try {
      const res = await api.post(`/companies/${company.id}/switch`);
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      toast.success(`Cambiado a: ${company.name}`);
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cambiar de empresa');
    }
  };

  const handleViewStats = async (company) => {
    setSelectedCompany(company);
    try {
      const res = await api.get(`/companies/${company.id}/stats`);
      setCompanyStats(res.data);
      setShowStatsDialog(true);
    } catch (error) {
      toast.error('Error al cargar estadísticas');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-fade-in" data-testid="companies-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Gestión de Empresas
          </h1>
          <p className="text-slate-500 mt-1">Administración multi-tenant</p>
        </div>
        <Button className="btn-action btn-press" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Empresa
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white card-enter card-stagger-1">
          <CardContent className="p-4">
            <Building2 className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-3xl font-bold">{companies.length}</p>
            <p className="text-blue-100">Empresas Registradas</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white card-enter card-stagger-2">
          <CardContent className="p-4">
            <Users className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-3xl font-bold">
              {companies.reduce((sum, c) => sum + (c.user_count || 0), 0) || '-'}
            </p>
            <p className="text-green-100">Usuarios Totales</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white card-enter card-stagger-3">
          <CardContent className="p-4">
            <Truck className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-3xl font-bold">
              {companies.reduce((sum, c) => sum + (c.vehicle_count || 0), 0) || '-'}
            </p>
            <p className="text-orange-100">Vehículos Totales</p>
          </CardContent>
        </Card>
      </div>

      {/* Companies Table */}
      <Card className="bg-white section-enter section-stagger-1">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
            Listado de Empresas
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {companies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay empresas registradas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>RUC</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id} className="hover:bg-orange-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{company.name}</p>
                          <p className="text-xs text-slate-500">{company.address || '-'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{company.ruc || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {company.email && <p>{company.email}</p>}
                        {company.phone && <p className="text-slate-500">{company.phone}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-500">
                        {company.created_at ? format(new Date(company.created_at), 'dd/MM/yyyy') : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isSuperAdmin && (
                            <DropdownMenuItem onClick={() => handleSwitchCompany(company)}>
                              <ArrowRightLeft className="w-4 h-4 mr-2" />
                              Entrar a esta empresa
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleViewStats(company)}>
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Ver Estadísticas
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditCompany(company)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteCompany(company.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase">
              Nueva Empresa
            </DialogTitle>
            <DialogDescription>
              Crear una nueva empresa en el sistema multi-tenant
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre de Empresa *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Mi Empresa S.A.C."
                />
              </div>
              <div className="space-y-2">
                <Label>RUC</Label>
                <Input
                  value={formData.ruc}
                  onChange={(e) => setFormData({ ...formData, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  placeholder="20123456789"
                  maxLength={11}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Av. Principal 123, Lima"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+51 1 234 5678"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contacto@empresa.com"
                />
              </div>
            </div>
            
            <div className="border-t pt-4 mt-2">
              <h4 className="font-bold text-slate-700 mb-3">Administrador de la Empresa</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre del Admin</Label>
                  <Input
                    value={formData.admin_name}
                    onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                    placeholder="Juan Pérez"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email del Admin</Label>
                  <Input
                    type="email"
                    value={formData.admin_email}
                    onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                    placeholder="admin@empresa.com"
                  />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label>Contraseña del Admin</Label>
                <Input
                  type="password"
                  value={formData.admin_password}
                  onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowCreateDialog(false); }}>
              Cancelar
            </Button>
            <Button className="btn-action" onClick={handleCreateCompany} disabled={!formData.name || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Empresa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>RUC</Label>
                <Input
                  value={formData.ruc}
                  onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowEditDialog(false); }}>
              Cancelar
            </Button>
            <Button className="btn-action" onClick={handleUpdateCompany} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Estadísticas: {selectedCompany?.name}</DialogTitle>
          </DialogHeader>
          {companyStats && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <Card className="bg-blue-50">
                <CardContent className="p-4 text-center">
                  <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-900">{companyStats.users}</p>
                  <p className="text-sm text-blue-600">Usuarios</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50">
                <CardContent className="p-4 text-center">
                  <Truck className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-900">{companyStats.vehicles}</p>
                  <p className="text-sm text-green-600">Vehículos</p>
                </CardContent>
              </Card>
              <Card className="bg-orange-50">
                <CardContent className="p-4 text-center">
                  <Route className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-orange-900">{companyStats.trips}</p>
                  <p className="text-sm text-orange-600">Viajes</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-50">
                <CardContent className="p-4 text-center">
                  <BarChart3 className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-900">{companyStats.active_trips}</p>
                  <p className="text-sm text-purple-600">Viajes Activos</p>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompaniesPage;
