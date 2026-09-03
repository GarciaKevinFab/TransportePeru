import React, { useState, useEffect } from 'react';
import { usersApi } from '../services/api';
import EstadoVacio from '../components/EstadoVacio';
import api from '../services/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
  Users,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Key,
  Loader2,
  User,
  Truck,
  Shield,
  Trash2,
  HardHat,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import EncabezadoPagina from '../components/EncabezadoPagina';
import { EsqueletoTabla } from '../components/Esqueletos';

const ROLES = [
  { value: 'admin', label: 'Administrador', icon: Shield, color: 'bg-purple-100 text-purple-800' },
  { value: 'operaciones', label: 'Operaciones', icon: User, color: 'bg-grafito-200 text-grafito-800' },
  { value: 'flota', label: 'Flota', icon: Truck, color: 'bg-green-100 text-green-800' },
  { value: 'mantenimiento', label: 'Mantenimiento', icon: User, color: 'bg-yellow-100 text-yellow-800' },
  { value: 'almacen', label: 'Almacén', icon: User, color: 'bg-marca-100 text-marca-800' },
  { value: 'contabilidad', label: 'Contabilidad', icon: User, color: 'bg-teal-100 text-teal-800' },
  { value: 'chofer', label: 'Chofer', icon: Truck, color: 'bg-grafito-100 text-grafito-800' },
];

const UsersPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResetPinDialog, setShowResetPinDialog] = useState(false);
  const [showEppDialog, setShowEppDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [eppData, setEppData] = useState({
    casco: { assigned: false, date: '', condition: 'bueno', size: '' },
    chaleco: { assigned: false, date: '', condition: 'bueno', size: '' },
    guantes: { assigned: false, date: '', condition: 'bueno', size: '' },
    botines: { assigned: false, date: '', condition: 'bueno', size: '' },
    lentes: { assigned: false, date: '', condition: 'bueno', size: '' },
    tapones: { assigned: false, date: '', condition: 'bueno', size: '' },
  });
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    dni: '',
    role: 'chofer',
    password: '',
    pin: '',
    license_number: '',
    phone: '',
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await usersApi.getAll();
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (error) {
      toast.error('Error al cargar usuarios');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    let filtered = users;
    
    if (searchTerm) {
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.dni?.includes(searchTerm)
      );
    }
    
    if (roleFilter !== 'all') {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }
    
    setFilteredUsers(filtered);
  }, [searchTerm, roleFilter, users]);

  const handleCreateUser = async () => {
    setSaving(true);
    try {
      await usersApi.create(formData);
      toast.success('Usuario creado exitosamente');
      setShowCreateDialog(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear usuario');
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!selectedUser || newPassword.length < 8) return;
    setSaving(true);
    try {
      await usersApi.resetPassword(selectedUser.id, newPassword);
      toast.success('Contraseña actualizada');
      setShowResetPasswordDialog(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al resetear la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPin = async () => {
    if (!selectedUser || !newPin) return;
    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      toast.error('El PIN debe ser de 6 dígitos numéricos');
      return;
    }
    
    setSaving(true);
    try {
      await usersApi.resetPin(selectedUser.id, newPin);
      toast.success('PIN reseteado exitosamente');
      setShowResetPinDialog(false);
      setNewPin('');
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al resetear PIN');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      dni: '',
      role: 'chofer',
      password: '',
      pin: '',
      license_number: '',
      phone: '',
    });
    setSelectedUser(null);
  };

  const DEFAULT_EPP = {
    casco: { assigned: false, date: '', condition: 'bueno', size: '' },
    chaleco: { assigned: false, date: '', condition: 'bueno', size: '' },
    guantes: { assigned: false, date: '', condition: 'bueno', size: '' },
    botines: { assigned: false, date: '', condition: 'bueno', size: '' },
    lentes: { assigned: false, date: '', condition: 'bueno', size: '' },
    tapones: { assigned: false, date: '', condition: 'bueno', size: '' },
  };

  const openEppDialog = (userItem) => {
    setSelectedUser(userItem);
    const merged = { ...DEFAULT_EPP };
    Object.keys(merged).forEach(k => {
      if (userItem.epp?.[k]) merged[k] = { ...merged[k], ...userItem.epp[k] };
    });
    setEppData(merged);
    setShowEppDialog(true);
  };

  const saveEpp = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await usersApi.update(selectedUser.id, { epp: eppData });
      toast.success('EPP actualizado');
      setShowEppDialog(false);
      fetchUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al guardar');
    }
    setSaving(false);
  };

  const handleEditUser = (userItem) => {
    setSelectedUser(userItem);
    setFormData({
      name: userItem.name || '',
      email: userItem.email || '',
      dni: userItem.dni || '',
      role: userItem.role || 'chofer',
      password: '',
      pin: '',
      license_number: userItem.license_number || '',
      phone: userItem.phone || '',
    });
    setShowEditDialog(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const updateData = { ...formData };
      if (!updateData.password) delete updateData.password;
      if (!updateData.pin) delete updateData.pin;
      
      await api.put(`/users/${selectedUser.id}`, updateData);
      toast.success('Usuario actualizado');
      setShowEditDialog(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar usuario');
    }
    setSaving(false);
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await api.delete(`/users/${userId}`);
      toast.success('Usuario eliminado');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar usuario');
    }
  };

  const getRoleBadge = (role) => {
    const roleConfig = ROLES.find((r) => r.value === role);
    if (!roleConfig) return <Badge>{role}</Badge>;
    return (
      <Badge className={roleConfig.color}>
        {roleConfig.label}
      </Badge>
    );
  };

  const isDriver = formData.role === 'chofer';

  /* Un solo menu para la tabla (escritorio) y las tarjetas (movil), igual que
     AccionesViaje en TripsPage: una accion nueva aparece en ambas vistas o en
     ninguna. */
  const AccionesUsuario = ({ userItem }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isAdmin && (
          <DropdownMenuItem onClick={() => handleEditUser(userItem)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </DropdownMenuItem>
        )}
        {userItem.role === 'chofer' && (
          <DropdownMenuItem
            onClick={() => {
              setSelectedUser(userItem);
              setShowResetPinDialog(true);
            }}
          >
            <Key className="w-4 h-4 mr-2" />
            Resetear PIN
          </DropdownMenuItem>
        )}
        {/* Los choferes entran con DNI y PIN; los demas con correo y
            contrasena. Cada uno ve solo el reseteo que le sirve. */}
        {userItem.role !== 'chofer' && isAdmin && (
          <DropdownMenuItem
            onClick={() => {
              setSelectedUser(userItem);
              setNewPassword('');
              setShowResetPasswordDialog(true);
            }}
          >
            <Key className="w-4 h-4 mr-2" />
            Resetear contraseña
          </DropdownMenuItem>
        )}
        {userItem.role === 'chofer' && isAdmin && (
          <DropdownMenuItem onClick={() => openEppDialog(userItem)}>
            <HardHat className="w-4 h-4 mr-2" />
            Asignar EPP
          </DropdownMenuItem>
        )}
        {isAdmin && userItem.role !== 'owner' && (
          <DropdownMenuItem
            onClick={() => handleDeleteUser(userItem.id)}
            className="text-red-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6 page-fade-in" data-testid="users-page">
      {/* Header */}
      <EncabezadoPagina
        titulo="Usuarios"
        subtitulo="Gestión de usuarios y permisos del sistema"
        acciones={(
          <>
            <Button className="btn-action btn-press" onClick={() => setShowCreateDialog(true)} data-testid="new-user-btn">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Usuario
            </Button>
          </>
        )}
      />

      {/* Filters */}
      <Card className="bg-white section-enter card-3d shadow-card-hover">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-grafito-400" />
              <Input
                placeholder="Buscar por nombre, email o DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-sm"
                data-testid="search-users-input"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-sm" data-testid="role-filter">
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-white section-enter section-stagger-1">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <EsqueletoTabla />
          ) : filteredUsers.length === 0 ? (
            users.length > 0 ? (
              <EstadoVacio
                icono={Users}
                titulo="Sin resultados"
                texto="Ningún usuario coincide con la búsqueda o el filtro."
                filtrado
              />
            ) : (
              <EstadoVacio
                icono={Users}
                titulo="Registra a tu equipo"
                texto="Empieza por tus choferes: sin al menos uno no podrás asignar viajes. Los choferes entran con DNI y PIN; el resto con correo y contraseña."
                accion={isAdmin ? { texto: 'Nuevo usuario', onClick: () => setShowCreateDialog(true) } : undefined}
              />
            )
          ) : (
            <>
            {/* Movil: tarjetas. Seis columnas en 375px esconden el estado y
                las acciones tras un arrastre lateral que nadie descubre. */}
            <div className="md:hidden divide-y divide-grafito-100 dark:divide-grafito-800">
              {filteredUsers.map((userItem) => (
                <div key={userItem.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="w-10 h-10 shrink-0 bg-grafito-100 rounded-full flex items-center justify-center text-grafito-600 font-bold">
                    {userItem.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{userItem.name}</span>
                      {getRoleBadge(userItem.role)}
                      {!userItem.is_active && (
                        <Badge className="bg-red-100 text-red-800">Inactivo</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-grafito-500">
                      {userItem.email || (userItem.dni ? `DNI: ${userItem.dni}` : '-')}
                      {userItem.phone ? ` · ${userItem.phone}` : ''}
                    </p>
                    {userItem.license_number && (
                      <p className="mt-0.5 font-mono text-xs text-grafito-500">
                        Lic. {userItem.license_number}
                      </p>
                    )}
                  </div>
                  <AccionesUsuario userItem={userItem} />
                </div>
              ))}
            </div>

            {/* Escritorio: la tabla de siempre */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="table-dense">
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Licencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((userItem) => (
                  <TableRow key={userItem.id} className="table-dense hover:bg-marca-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-grafito-100 rounded-full flex items-center justify-center text-grafito-600 font-bold">
                          {userItem.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{userItem.name}</p>
                          {userItem.dni && (
                            <p className="text-xs text-grafito-500 font-mono">DNI: {userItem.dni}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        {userItem.email && <p className="text-sm">{userItem.email}</p>}
                        {userItem.phone && <p className="text-xs text-grafito-500">{userItem.phone}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(userItem.role)}</TableCell>
                    <TableCell>
                      {userItem.license_number ? (
                        <span className="font-mono text-sm">{userItem.license_number}</span>
                      ) : (
                        <span className="text-grafito-400">-</span>
                      )}
                      {userItem.role === 'chofer' && userItem.epp && (
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {['casco', 'chaleco', 'guantes', 'botines'].map(k => (
                            <span
                              key={k}
                              title={k}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${userItem.epp?.[k]?.assigned ? 'bg-green-100 text-green-700' : 'bg-grafito-100 text-grafito-400'}`}
                            >
                              {k.substring(0, 3)}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={userItem.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {userItem.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <AccionesUsuario userItem={userItem} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLES.slice(0, 4).map((role, idx) => (
          <Card key={role.value} className={`bg-white card-enter card-stagger-${idx + 1} card-3d shadow-card-hover`}>
            <CardContent className="py-4 text-center">
              <p className="font-heading text-3xl font-bold text-grafito-900">
                {users.filter((u) => u.role === role.value).length}
              </p>
              <p className="text-xs uppercase tracking-widest text-grafito-500 mt-1">{role.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nuevo Usuario
            </DialogTitle>
            <DialogDescription>
              Crear un nuevo usuario del sistema
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label className="input-label">Nombre Completo *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Juan Pérez"
                className="rounded-sm"
                data-testid="user-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Rol *</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v })}
              >
                <SelectTrigger className="rounded-sm" data-testid="user-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {isDriver ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="input-label">DNI *</Label>
                    <Input
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                      placeholder="12345678"
                      maxLength={8}
                      className="rounded-sm font-mono"
                      data-testid="user-dni-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="input-label">PIN (6 dígitos) *</Label>
                    <Input
                      type="password"
                      value={formData.pin}
                      onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="••••••"
                      maxLength={6}
                      className="rounded-sm font-mono text-center"
                      data-testid="user-pin-input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="input-label">Número de Licencia</Label>
                    <Input
                      value={formData.license_number}
                      onChange={(e) => setFormData({ ...formData, license_number: e.target.value.toUpperCase() })}
                      placeholder="Q12345678"
                      className="rounded-sm uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="input-label">Teléfono</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+51 987 654 321"
                      className="rounded-sm"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="input-label">Correo Electrónico *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="usuario@empresa.com"
                    className="rounded-sm"
                    data-testid="user-email-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="input-label">Contraseña *</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="rounded-sm"
                    data-testid="user-password-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="input-label">Teléfono</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+51 987 654 321"
                    className="rounded-sm"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleCreateUser}
              disabled={!formData.name || saving || (isDriver ? !formData.dni || !formData.pin : !formData.email || !formData.password)}
              data-testid="save-user-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password: la unica via de recuperacion que existe para quien
          entra con correo. No hay envio de correo en el sistema, asi que la
          contrasena la fija aqui el dueno o un admin y se la entrega a la
          persona por fuera. */}
      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resetear contraseña</DialogTitle>
            <DialogDescription>
              Nueva contraseña para {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="input-label">Nueva contraseña (mínimo 8 caracteres)</Label>
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Escríbela o pega una generada"
                className="rounded-sm font-mono"
                data-testid="reset-password-input"
              />
            </div>
            <p className="text-xs text-grafito-500">
              Se muestra en claro a propósito: tienes que poder copiarla para
              entregársela. Hazlo por un canal privado y pídele que la cambie.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPasswordDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleResetPassword}
              disabled={newPassword.length < 8 || saving}
              data-testid="confirm-reset-password-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Resetear contraseña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset PIN Dialog */}
      <Dialog open={showResetPinDialog} onOpenChange={setShowResetPinDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resetear PIN</DialogTitle>
            <DialogDescription>
              Ingresa el nuevo PIN para {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="input-label">Nuevo PIN (6 dígitos)</Label>
              <Input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                maxLength={6}
                className="rounded-sm font-mono text-center text-lg"
                data-testid="reset-pin-input"
              />
            </div>
            <p className="text-xs text-grafito-500">
              El usuario deberá cambiar su PIN en el próximo inicio de sesión.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPinDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleResetPin}
              disabled={newPin.length !== 6 || saving}
              data-testid="confirm-reset-pin-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Resetear PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EPP Dialog (drivers only) */}
      <Dialog open={showEppDialog} onOpenChange={setShowEppDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide flex items-center gap-2">
              <HardHat className="w-5 h-5" />
              EPP de {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Equipo de Protección Personal entregado al chofer
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {[
              { key: 'casco', label: 'Casco de Seguridad' },
              { key: 'chaleco', label: 'Chaleco Reflectivo' },
              { key: 'guantes', label: 'Guantes' },
              { key: 'botines', label: 'Botines de Seguridad' },
              { key: 'lentes', label: 'Lentes de Seguridad' },
              { key: 'tapones', label: 'Tapones Auditivos' },
            ].map(({ key, label }) => {
              const item = eppData[key] || { assigned: false };
              return (
                <div key={key} className={`p-3 rounded-lg border-2 transition-all ${item.assigned ? 'bg-green-50 border-green-300' : 'bg-grafito-50 border-grafito-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={item.assigned || false}
                        onChange={(e) => setEppData({ ...eppData, [key]: { ...item, assigned: e.target.checked } })}
                        className="w-5 h-5"
                      />
                      <span className="font-semibold">{label}</span>
                      {item.assigned ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-grafito-300" />}
                    </label>
                  </div>
                  {item.assigned && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 pl-7">
                      <div>
                        <Label className="text-xs">Fecha entrega</Label>
                        <Input
                          type="date"
                          value={item.date || ''}
                          onChange={(e) => setEppData({ ...eppData, [key]: { ...item, date: e.target.value } })}
                          className="text-sm h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Talla</Label>
                        <Input
                          value={item.size || ''}
                          onChange={(e) => setEppData({ ...eppData, [key]: { ...item, size: e.target.value } })}
                          placeholder="S/M/L/XL"
                          className="text-sm h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Estado</Label>
                        <Select value={item.condition || 'bueno'} onValueChange={(v) => setEppData({ ...eppData, [key]: { ...item, condition: v } })}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nuevo">Nuevo</SelectItem>
                            <SelectItem value="bueno">Bueno</SelectItem>
                            <SelectItem value="regular">Regular</SelectItem>
                            <SelectItem value="malo">Malo - Reponer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEppDialog(false)}>Cancelar</Button>
            <Button className="btn-action btn-press" onClick={saveEpp} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar EPP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowEditDialog(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Editar Usuario
            </DialogTitle>
            <DialogDescription>
              Modifica los datos de {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Nombre *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre completo"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Rol *</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">DNI</Label>
                <Input
                  value={formData.dni}
                  onChange={(e) => setFormData({ ...formData, dni: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  placeholder="12345678"
                  maxLength={8}
                  className="rounded-sm font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Teléfono</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+51 999 999 999"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Nro. Licencia</Label>
                <Input
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value.toUpperCase() })}
                  placeholder="Q12345678"
                  className="rounded-sm font-mono"
                />
              </div>
            </div>
            {/* Aqui habia dos campos, "Nueva Contraseña" y "Nuevo PIN", que NO
                hacian nada: update_user descarta password_hash y pin_hash, y
                USER_COLS filtra password y pin. Quien los usaba se quedaba
                convencido de haber cambiado una clave que seguia siendo la
                vieja - y descubriendolo el dia que no podia entrar.
                Las credenciales se cambian desde el menu de cada usuario, que
                usa los endpoints que si las escriben. */}
            <p className="rounded-sm border border-grafito-200 dark:border-grafito-700 bg-grafito-50 dark:bg-grafito-800/50 px-3 py-2.5 text-xs text-grafito-600 dark:text-grafito-300">
              Las credenciales no se cambian desde aquí. Usa el menú (⋯) de la
              fila del usuario: <strong>Resetear contraseña</strong> para quienes
              entran con correo, o <strong>Resetear PIN</strong> para los choferes.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowEditDialog(false); }}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleUpdateUser}
              disabled={!formData.name || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
