import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Boxes,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Truck,
  CircleDot,
  User,
  Shield,
  ShieldCheck,
  Trash,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { unitsApi, vehiclesApi, usersApi } from '../services/api';
import EstadoVacio from '../components/EstadoVacio';

// EPP de unidad por defecto (conos, botiquín, extintor, chalecos)
const DEFAULT_EPP_ITEMS = [
  { name: 'conos', label: 'Conos de seguridad', quantity: 2, condition: 'bueno', expiry_date: null },
  { name: 'botiquin', label: 'Botiquín', quantity: 1, condition: 'bueno', expiry_date: null },
  { name: 'extintor', label: 'Extintor', quantity: 1, condition: 'bueno', expiry_date: null },
  { name: 'chalecos', label: 'Chalecos reflectantes', quantity: 2, condition: 'bueno', expiry_date: null },
];

const CONDITION_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'bueno', label: 'Bueno' },
  { value: 'regular', label: 'Regular' },
  { value: 'malo', label: 'Malo' },
  { value: 'vencido', label: 'Vencido' },
];

const emptyForm = {
  tracto_id: '',
  carreta_id: '',
  driver_id: '',
  epp_items: DEFAULT_EPP_ITEMS.map((it) => ({ ...it })),
};

const getUnitStatusBadge = (status) => {
  const map = {
    activa: { label: 'Activa', className: 'border-green-300 text-green-700 bg-green-50' },
    disponible: { label: 'Disponible', className: 'border-green-300 text-green-700 bg-green-50' },
    en_viaje: { label: 'En Viaje', className: 'border-blue-300 text-blue-700 bg-blue-50' },
    inactiva: { label: 'Inactiva', className: 'border-slate-300 text-slate-600 bg-slate-50' },
  };
  const cfg = map[status] || { label: status || 'Sin estado', className: 'border-slate-300 text-slate-600 bg-slate-50' };
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
};

const UnitsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'flota';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // --- Data loading (defensivo: la UI no debe romperse si el backend aún no responde) ---
  const loadUnits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await unitsApi.getAll();
      const data = res?.data;
      setUnits(Array.isArray(data) ? data : Array.isArray(data?.units) ? data.units : []);
    } catch (err) {
      // Endpoint puede no estar listo todavía; mostrar estado vacío sin romper.
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalogs = useCallback(async () => {
    try {
      const res = await vehiclesApi.getAll();
      const data = res?.data;
      setVehicles(Array.isArray(data) ? data : Array.isArray(data?.vehicles) ? data.vehicles : []);
    } catch (err) {
      setVehicles([]);
    }
    try {
      const res = await usersApi.getAll({ role: 'chofer' });
      const data = res?.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];
      setDrivers(list.filter((u) => !u.role || u.role === 'chofer'));
    } catch (err) {
      setDrivers([]);
    }
  }, []);

  useEffect(() => {
    loadUnits();
    loadCatalogs();
  }, [loadUnits, loadCatalogs]);

  const tractos = useMemo(
    () => vehicles.filter((v) => v.vehicle_type === 'tracto'),
    [vehicles]
  );
  const carretas = useMemo(
    () => vehicles.filter((v) => v.vehicle_type === 'carreta'),
    [vehicles]
  );

  // --- Resolución de placas / nombres (usa datos de la unidad o cae al catálogo) ---
  const getVehiclePlate = useCallback(
    (id) => vehicles.find((v) => v.id === id)?.plate || null,
    [vehicles]
  );
  const getDriverName = useCallback(
    (id) => {
      const d = drivers.find((u) => u.id === id);
      return d ? d.name || d.full_name || d.username : null;
    },
    [drivers]
  );

  const resolveTractoPlate = (unit) =>
    unit.tracto_plate || unit.tracto_placa || getVehiclePlate(unit.tracto_id) || '-';
  const resolveCarretaPlate = (unit) =>
    unit.carreta_plate || unit.carreta_placa || getVehiclePlate(unit.carreta_id) || '-';
  const resolveDriverName = (unit) =>
    unit.driver_name || unit.chofer_name || getDriverName(unit.driver_id) || null;
  const getEppItems = (unit) => (Array.isArray(unit.epp_items) ? unit.epp_items : []);

  // --- Form handlers ---
  const openCreate = () => {
    setFormMode('create');
    setSelectedUnit(null);
    setForm({ ...emptyForm, epp_items: DEFAULT_EPP_ITEMS.map((it) => ({ ...it })) });
    setShowFormDialog(true);
  };

  const openEdit = (unit) => {
    setFormMode('edit');
    setSelectedUnit(unit);
    const eppItems = getEppItems(unit);
    setForm({
      tracto_id: unit.tracto_id || '',
      carreta_id: unit.carreta_id || '',
      driver_id: unit.driver_id || '',
      epp_items: eppItems.length ? eppItems.map((it) => ({ ...it })) : DEFAULT_EPP_ITEMS.map((it) => ({ ...it })),
    });
    setShowFormDialog(true);
  };

  const openDelete = (unit) => {
    setSelectedUnit(unit);
    setShowDeleteDialog(true);
  };

  const setFormField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateEppItem = (index, field, value) => {
    setForm((prev) => {
      const items = [...prev.epp_items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, epp_items: items };
    });
  };

  const addEppItem = () => {
    setForm((prev) => ({
      ...prev,
      epp_items: [
        ...prev.epp_items,
        { name: '', label: '', quantity: 1, condition: 'bueno', expiry_date: null },
      ],
    }));
  };

  const removeEppItem = (index) => {
    setForm((prev) => ({
      ...prev,
      epp_items: prev.epp_items.filter((_, i) => i !== index),
    }));
  };

  const buildPayload = () => ({
    tracto_id: form.tracto_id,
    carreta_id: form.carreta_id || null,
    driver_id: form.driver_id || null,
    epp_items: form.epp_items
      .filter((it) => (it.name || it.label || '').trim() !== '')
      .map((it) => ({
        name: (it.name || it.label || '').trim(),
        label: it.label || undefined,
        quantity: Number(it.quantity) || 0,
        condition: it.condition || 'pendiente',
        expiry_date: it.expiry_date || null,
      })),
  });

  const handleSave = async () => {
    if (!form.tracto_id) {
      toast.error('Debe seleccionar un tracto');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (formMode === 'create') {
        await unitsApi.create(payload);
        toast.success('Unidad creada correctamente');
      } else {
        await unitsApi.update(selectedUnit.id, payload);
        toast.success('Unidad actualizada correctamente');
      }
      setShowFormDialog(false);
      await loadUnits();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo guardar la unidad');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUnit) return;
    setSaving(true);
    try {
      await unitsApi.delete(selectedUnit.id);
      toast.success('Unidad eliminada');
      setShowDeleteDialog(false);
      setSelectedUnit(null);
      await loadUnits();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo eliminar la unidad');
    } finally {
      setSaving(false);
    }
  };

  /* Un solo menu de acciones para la tabla (escritorio) y las tarjetas (movil), igual que AccionesViaje en TripsPage: una accion nueva aparece en ambas vistas o en ninguna. */
  const AccionesUnidad = ({ unit }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid={`unit-actions-${unit.id}`}>
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isAdmin && (
          <DropdownMenuItem onClick={() => openEdit(unit)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem className="text-red-600" onClick={() => openDelete(unit)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6 page-fade-in" data-testid="units-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Unidades
          </h1>
          <p className="text-slate-500 mt-1">
            Tracto + carreta + chofer + EPP de unidad
          </p>
        </div>
        {isAdmin && (
          <Button
            className="btn-action btn-press btn-shine tap-scale rounded-lg"
            onClick={openCreate}
            data-testid="new-unit-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Unidad
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="bg-white section-enter section-stagger-1">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-marca-500" />
            </div>
          ) : units.length === 0 ? (
            /* Vacio con guia: una unidad se arma sobre un tracto. Sin tractos
               en el catalogo, el dialogo de creacion abre con un selector
               vacio; mejor llevar a la persona a Vehiculos primero. */
            <div data-testid="units-empty">
              {tractos.length === 0 ? (
                <EstadoVacio
                  icono={Boxes}
                  titulo="Antes de armar unidades, registra tus vehículos"
                  texto="Una unidad acopla un tracto con su carreta y su chofer. Carga primero tu flota y vuelve aquí."
                  enlace={{ texto: 'Ir a Vehículos', onClick: () => navigate('/vehicles') }}
                />
              ) : (
                <EstadoVacio
                  icono={Boxes}
                  titulo="Arma tu primera unidad"
                  texto="Acopla tracto, carreta y chofer, con su EPP al día. La unidad lista es la que sale a ruta sin observaciones."
                  accion={isAdmin ? { texto: 'Nueva unidad', onClick: openCreate } : undefined}
                />
              )}
            </div>
          ) : (
            <>
            {/* Movil: tarjetas. Seis columnas en 375px esconden estado y acciones tras un arrastre lateral que nadie descubre. */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {units.map((unit) => {
                const epp = getEppItems(unit);
                const eppTotal = epp.length;
                const eppOk = epp.filter((it) => it.condition === 'bueno').length;
                const driverName = resolveDriverName(unit);
                return (
                  <div key={unit.id} className="flex items-start gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold truncate">{resolveTractoPlate(unit)}</span>
                        {getUnitStatusBadge(unit.status || unit.estado)}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        Carreta: <span className="font-mono">{resolveCarretaPlate(unit)}</span>
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        {driverName ? (
                          <span className="inline-flex items-center gap-1 truncate">
                            <User className="h-3 w-3 text-green-600" />
                            {driverName}
                          </span>
                        ) : (
                          <span className="text-slate-400">Sin asignar</span>
                        )}
                        {eppTotal === 0 ? (
                          <span className="text-slate-400">Sin EPP</span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-green-600" />
                            EPP {eppOk}/{eppTotal} OK
                          </span>
                        )}
                      </p>
                    </div>
                    <AccionesUnidad unit={unit} />
                  </div>
                );
              })}
            </div>

            {/* Escritorio: la tabla de siempre */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="table-dense">
                  <TableHead>Placa Tracto</TableHead>
                  <TableHead>Placa Carreta</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>EPP</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => {
                  const epp = getEppItems(unit);
                  const eppTotal = epp.length;
                  const eppOk = epp.filter((it) => it.condition === 'bueno').length;
                  const driverName = resolveDriverName(unit);
                  return (
                    <TableRow key={unit.id} className="table-dense table-row-lift" data-testid={`unit-row-${unit.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-marca-500" />
                          <span className="font-mono font-bold text-slate-900">
                            {resolveTractoPlate(unit)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CircleDot className="w-4 h-4 text-slate-400" />
                          <span className="font-mono">{resolveCarretaPlate(unit)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {driverName ? (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-green-600" />
                            <span className="text-sm">{driverName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>{getUnitStatusBadge(unit.status || unit.estado)}</TableCell>
                      <TableCell>
                        {eppTotal === 0 ? (
                          <span className="text-xs text-slate-400">Sin EPP</span>
                        ) : (
                          <Badge variant="outline" className="border-slate-300 text-slate-700 bg-slate-50">
                            <ShieldCheck className="w-3 h-3 mr-1 text-green-600" />
                            {eppOk}/{eppTotal} OK
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <AccionesUnidad unit={unit} />
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

      {/* Create / Edit Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[640px] max-h-[85vh] overflow-y-auto" data-testid="unit-form-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {formMode === 'create' ? 'Nueva Unidad' : 'Editar Unidad'}
            </DialogTitle>
            <DialogDescription>
              Acople un tracto y una carreta, asigne un chofer y gestione el EPP de la unidad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tracto */}
            <div className="space-y-1.5">
              <Label>Tracto *</Label>
              <Select value={form.tracto_id} onValueChange={(v) => setFormField('tracto_id', v)}>
                <SelectTrigger className="rounded-sm" data-testid="unit-tracto-select">
                  <SelectValue placeholder="Seleccione un tracto" />
                </SelectTrigger>
                <SelectContent>
                  {tractos.length === 0 ? (
                    <SelectItem value="__none" disabled>Sin tractos disponibles</SelectItem>
                  ) : (
                    tractos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate} {v.brand ? `- ${v.brand}` : ''} {v.model || ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Carreta */}
            <div className="space-y-1.5">
              <Label>Carreta</Label>
              <Select value={form.carreta_id} onValueChange={(v) => setFormField('carreta_id', v)}>
                <SelectTrigger className="rounded-sm" data-testid="unit-carreta-select">
                  <SelectValue placeholder="Seleccione una carreta (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {carretas.length === 0 ? (
                    <SelectItem value="__none" disabled>Sin carretas disponibles</SelectItem>
                  ) : (
                    carretas.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate} {v.brand ? `- ${v.brand}` : ''} {v.model || ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Chofer */}
            <div className="space-y-1.5">
              <Label>Chofer</Label>
              <Select value={form.driver_id} onValueChange={(v) => setFormField('driver_id', v)}>
                <SelectTrigger className="rounded-sm" data-testid="unit-driver-select">
                  <SelectValue placeholder="Asignar chofer (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.length === 0 ? (
                    <SelectItem value="__none" disabled>Sin choferes disponibles</SelectItem>
                  ) : (
                    drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name || d.full_name || d.username}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* EPP de unidad */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-500" />
                  EPP de la unidad
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addEppItem} data-testid="add-epp-item-btn">
                  <Plus className="w-3 h-3 mr-1" />
                  Añadir ítem
                </Button>
              </div>

              {form.epp_items.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">No hay ítems de EPP. Añada conos, botiquín, extintor o chalecos.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-dense">
                        <TableHead>Elemento</TableHead>
                        <TableHead className="w-16">Cant.</TableHead>
                        <TableHead className="w-28">Estado</TableHead>
                        <TableHead className="w-36">Vencimiento</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.epp_items.map((item, index) => (
                        <TableRow key={index} className="table-dense">
                          <TableCell>
                            <Input
                              value={item.label ?? item.name ?? ''}
                              placeholder="Nombre del ítem"
                              onChange={(e) => {
                                updateEppItem(index, 'label', e.target.value);
                                updateEppItem(index, 'name', e.target.value);
                              }}
                              className="rounded-sm h-8"
                              data-testid={`epp-name-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateEppItem(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                              className="rounded-sm h-8 w-16"
                              data-testid={`epp-qty-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.condition}
                              onValueChange={(v) => updateEppItem(index, 'condition', v)}
                            >
                              <SelectTrigger className="rounded-sm h-8" data-testid={`epp-condition-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CONDITION_OPTIONS.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={item.expiry_date || ''}
                              onChange={(e) => updateEppItem(index, 'expiry_date', e.target.value || null)}
                              className="rounded-sm h-8"
                              data-testid={`epp-expiry-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500"
                              onClick={() => removeEppItem(index)}
                              data-testid={`remove-epp-item-${index}`}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleSave} disabled={saving} data-testid="save-unit-btn">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {formMode === 'create' ? 'Crear Unidad' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar la unidad{' '}
              <strong>{selectedUnit ? resolveTractoPlate(selectedUnit) : ''}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving} data-testid="confirm-delete-unit-btn">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnitsPage;
