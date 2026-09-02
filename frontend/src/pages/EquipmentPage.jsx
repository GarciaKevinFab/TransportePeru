import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { vehiclesApi, usersApi } from '../services/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
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
  Shield,
  Loader2,
  Search,
  Truck,
  AlertTriangle,
  CheckCircle,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import EstadoVacio from '../components/EstadoVacio';
import { EsqueletoPagina } from '../components/Esqueletos';
import TarjetaMetrica from '../components/TarjetaMetrica';

const EquipmentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [equipmentMap, setEquipmentMap] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [equipmentItems, setEquipmentItems] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('none');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, driversRes] = await Promise.all([
        vehiclesApi.getAll(),
        usersApi.getAll({ role: 'chofer' }),
      ]);
      setVehicles(vehiclesRes.data);
      setDrivers(driversRes.data);

      // Fetch equipment for all vehicles
      const eqMap = {};
      await Promise.all(
        vehiclesRes.data.map(async (v) => {
          try {
            const res = await vehiclesApi.getEquipment(v.id);
            eqMap[v.id] = res.data.items || [];
          } catch {
            eqMap[v.id] = [];
          }
        })
      );
      setEquipmentMap(eqMap);
    } catch (error) {
      toast.error('Error al cargar datos');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getDriverName = (driverId) => {
    if (!driverId) return null;
    return drivers.find(d => d.id === driverId)?.name || null;
  };

  const getEquipmentStatus = (items) => {
    if (!items || items.length === 0) return { label: 'Sin datos', color: 'bg-grafito-100 text-grafito-600' };
    const total = items.length;
    const good = items.filter(i => i.condition === 'bueno' && i.quantity > 0).length;
    const bad = items.filter(i => i.condition === 'malo' || i.condition === 'vencido').length;
    const pending = items.filter(i => i.condition === 'pendiente' || i.quantity === 0).length;

    if (bad > 0) return { label: `${bad} con problemas`, color: 'bg-red-100 text-red-700' };
    if (pending > 0) return { label: `${pending} pendientes`, color: 'bg-yellow-100 text-yellow-700' };
    if (good === total) return { label: 'Completo', color: 'bg-green-100 text-green-700' };
    return { label: `${good}/${total}`, color: 'bg-grafito-200 text-grafito-800' };
  };

  const handleOpenEdit = async (vehicle) => {
    setSelectedVehicle(vehicle);
    try {
      const res = await vehiclesApi.getEquipment(vehicle.id);
      setEquipmentItems(res.data.items || []);
    } catch {
      setEquipmentItems([]);
    }
    setShowEditDialog(true);
  };

  const handleSaveEquipment = async () => {
    if (!selectedVehicle) return;
    setSaving(true);
    try {
      await vehiclesApi.updateEquipment(selectedVehicle.id, { items: equipmentItems });
      toast.success('Equipamiento actualizado');
      setShowEditDialog(false);
      // Update local map
      setEquipmentMap(prev => ({ ...prev, [selectedVehicle.id]: equipmentItems }));
    } catch (error) {
      toast.error('Error al guardar equipamiento');
    }
    setSaving(false);
  };

  const handleOpenAssign = (vehicle) => {
    setSelectedVehicle(vehicle);
    setSelectedDriverId(vehicle.assigned_driver_id || 'none');
    setShowAssignDialog(true);
  };

  const handleAssignDriver = async () => {
    if (!selectedVehicle) return;
    setSaving(true);
    const driverId = selectedDriverId === 'none' ? null : selectedDriverId;
    try {
      await vehiclesApi.assignDriver(selectedVehicle.id, driverId);
      toast.success(driverId ? 'Chofer asignado' : 'Chofer desasignado');
      setShowAssignDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al asignar chofer');
    }
    setSaving(false);
  };

  const updateEquipmentItem = (index, field, value) => {
    const updated = [...equipmentItems];
    updated[index] = { ...updated[index], [field]: value };
    setEquipmentItems(updated);
  };

  const filteredVehicles = vehicles.filter(v =>
    v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalVehicles = vehicles.length;
  const completeEPP = vehicles.filter(v => {
    const items = equipmentMap[v.id] || [];
    return items.length > 0 && items.every(i => i.condition === 'bueno' && i.quantity > 0);
  }).length;
  const pendingEPP = totalVehicles - completeEPP;
  const assignedDrivers = vehicles.filter(v => v.assigned_driver_id).length;

  /* Un solo menu de acciones para la tabla (escritorio) y las tarjetas (movil), igual que AccionesViaje en TripsPage: una accion nueva aparece en ambas vistas o en ninguna. */
  const AccionesEquipo = ({ vehicle }) => (
    <div className="flex flex-col items-end gap-2 md:flex-row md:justify-end">
      {isAdmin && (
        <Button size="sm" variant="outline" onClick={() => handleOpenAssign(vehicle)}>
          <UserCheck className="w-4 h-4 mr-1" />
          Chofer
        </Button>
      )}
      <Button size="sm" className="btn-action" onClick={() => handleOpenEdit(vehicle)}>
        <Shield className="w-4 h-4 mr-1" />
        EPP
      </Button>
    </div>
  );

  if (loading) {
    return (
      <EsqueletoPagina />
    );
  }

  return (
    <div className="space-y-6 page-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-grafito-900">
          Equipamiento y Asignaciones
        </h1>
        <p className="text-grafito-500 mt-1">
          Gestión de EPP por vehículo y asignación de choferes
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TarjetaMetrica
          titulo="Vehículos"
          valor={totalVehicles}
          icono={Truck}
          tono="neutro"
          className="card-enter card-stagger-1"
        />
        <TarjetaMetrica
          titulo="EPP Completo"
          valor={completeEPP}
          icono={CheckCircle}
          tono="ok"
          className="card-enter card-stagger-2"
        />
        <TarjetaMetrica
          titulo="EPP Pendiente"
          valor={pendingEPP}
          icono={AlertTriangle}
          tono="aviso"
          className="card-enter card-stagger-3"
        />
        <TarjetaMetrica
          titulo="Con Chofer"
          valor={assignedDrivers}
          icono={UserCheck}
          tono="marca"
          className="card-enter card-stagger-4"
        />
      </div>

      {/* Search */}
      <Card className="bg-white">
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-grafito-400" />
            <Input
              placeholder="Buscar por placa o marca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-white section-enter section-stagger-1">
        <CardContent className="p-0 overflow-x-auto">
          {filteredVehicles.length === 0 ? (
            /* Vacio con guia: el EPP se cuelga de un vehiculo ya registrado.
               Sin flota no hay nada que equipar; el alta vive en Vehiculos. */
            vehicles.length > 0 ? (
              <EstadoVacio
                icono={Shield}
                titulo="Sin resultados"
                texto="Ningún vehículo coincide con la búsqueda."
                filtrado
              />
            ) : (
              <EstadoVacio
                icono={Shield}
                titulo="Antes de asignar EPP, registra tus vehículos"
                texto="El equipamiento y el chofer se asignan sobre cada vehículo de tu flota. Carga primero tus tractos y carretas."
                enlace={{ texto: 'Ir a Vehículos', onClick: () => navigate('/vehicles') }}
              />
            )
          ) : (
            <>
            {/* Movil: tarjetas. Seis columnas en 375px esconden estado y acciones tras un arrastre lateral que nadie descubre. */}
            <div className="md:hidden divide-y divide-grafito-100 dark:divide-grafito-800">
              {filteredVehicles.map((vehicle) => {
                const eqStatus = getEquipmentStatus(equipmentMap[vehicle.id]);
                const driverName = getDriverName(vehicle.assigned_driver_id);
                return (
                  <div key={vehicle.id} className="flex items-start gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold truncate">{vehicle.plate}</span>
                        <Badge className={eqStatus.color}>{eqStatus.label}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-grafito-500">
                        {vehicle.vehicle_type === 'tracto' ? 'Tracto' : 'Carreta'}
                        {' · '}
                        {vehicle.brand || '-'} {vehicle.model || ''}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-grafito-500">
                        {driverName ? (
                          <span className="inline-flex items-center gap-1 truncate text-green-700 font-medium">
                            <UserCheck className="h-3 w-3" />
                            {driverName}
                          </span>
                        ) : (
                          <span className="text-grafito-400">Sin chofer asignado</span>
                        )}
                      </p>
                    </div>
                    <AccionesEquipo vehicle={vehicle} />
                  </div>
                );
              })}
            </div>

            {/* Escritorio: la tabla de siempre */}
            <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="table-dense">
                <TableHead>Placa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Marca / Modelo</TableHead>
                <TableHead>Chofer Asignado</TableHead>
                <TableHead>Estado EPP</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.map((vehicle) => {
                const eqStatus = getEquipmentStatus(equipmentMap[vehicle.id]);
                const driverName = getDriverName(vehicle.assigned_driver_id);
                return (
                  <TableRow key={vehicle.id} className="table-dense hover:bg-marca-50">
                    <TableCell className="font-mono font-bold">{vehicle.plate}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={vehicle.vehicle_type === 'tracto' ? 'border-marca-300 text-marca-700 bg-marca-50' : 'border-grafito-300 text-grafito-700 bg-grafito-50'}>
                        {vehicle.vehicle_type === 'tracto' ? 'Tracto' : 'Carreta'}
                      </Badge>
                    </TableCell>
                    <TableCell>{vehicle.brand || '-'} {vehicle.model || ''}</TableCell>
                    <TableCell>
                      {driverName ? (
                        <span className="text-green-700 font-medium">{driverName}</span>
                      ) : (
                        <span className="text-grafito-400">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={eqStatus.color}>{eqStatus.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <AccionesEquipo vehicle={vehicle} />
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

      {/* Edit Equipment Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Equipamiento EPP
            </DialogTitle>
            <DialogDescription>
              Vehículo: {selectedVehicle?.plate} - {selectedVehicle?.brand} {selectedVehicle?.model}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="table-dense">
                  <TableHead>Elemento</TableHead>
                  <TableHead className="w-20">Cant.</TableHead>
                  <TableHead className="w-32">Estado</TableHead>
                  <TableHead className="w-36">Vencimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipmentItems.map((item, index) => (
                  <TableRow key={item.name} className="table-dense">
                    <TableCell className="font-medium">{item.label || item.name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateEquipmentItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="rounded-sm h-8 w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.condition}
                        onValueChange={(v) => updateEquipmentItem(index, 'condition', v)}
                      >
                        <SelectTrigger className="rounded-sm h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendiente">Pendiente</SelectItem>
                          <SelectItem value="bueno">Bueno</SelectItem>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="malo">Malo</SelectItem>
                          <SelectItem value="vencido">Vencido</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={item.expiry_date || ''}
                        onChange={(e) => updateEquipmentItem(index, 'expiry_date', e.target.value || null)}
                        className="rounded-sm h-8"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleSaveEquipment} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Driver Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Asignar Chofer
            </DialogTitle>
            <DialogDescription>
              Vehículo: {selectedVehicle?.plate}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="input-label">Chofer</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Seleccionar chofer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} {d.license_number ? `(${d.license_number})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleAssignDriver} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EquipmentPage;
