import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  Truck,
  Plus,
  Search,
  Filter,
  Loader2,
  CircleDot,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useVehicles } from '../hooks/useVehicles';
import VehicleTable from '../components/vehicles/VehicleTable';
import VehicleFormDialog from '../components/vehicles/VehicleFormDialog';
import VehicleDetailDialog from '../components/vehicles/VehicleDetailDialog';
import VehicleEquipmentDialog from '../components/vehicles/VehicleEquipmentDialog';
import AssignDriverDialog from '../components/vehicles/AssignDriverDialog';
import { CouplingDialog, CouplingInfoDialog } from '../components/vehicles/CouplingDialogs';

const VehiclesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const {
    loading,
    saving,
    vehicles,
    drivers,
    filters,
    setFilters,
    filteredVehicles,
    isVehicleCoupled,
    getCoupledPartnerPlate,
    getActiveCouplingForVehicle,
    getDriverName,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    assignDriver,
    createCoupling,
    uncouple,
    getEquipment,
    saveEquipment,
  } = useVehicles();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAssignDriverDialog, setShowAssignDriverDialog] = useState(false);
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCouplingDialog, setShowCouplingDialog] = useState(false);
  const [showCouplingInfoDialog, setShowCouplingInfoDialog] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [equipmentItems, setEquipmentItems] = useState([]);

  // --- Row action handlers ---
  const onViewTires = (vehicle) => navigate(`/vehicles/${vehicle.id}/tires`);

  const handleViewDetail = async (vehicle) => {
    setSelectedVehicle(vehicle);
    setEquipmentItems(await getEquipment(vehicle.id));
    setShowDetailDialog(true);
  };

  const handleEditVehicle = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowEditDialog(true);
  };

  const handleOpenAssignDriver = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowAssignDriverDialog(true);
  };

  const handleOpenEquipment = async (vehicle) => {
    setSelectedVehicle(vehicle);
    setEquipmentItems(await getEquipment(vehicle.id));
    setShowEquipmentDialog(true);
  };

  const handleOpenCoupling = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowCouplingDialog(true);
  };

  const handleShowCoupledPartner = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowCouplingInfoDialog(true);
  };

  const handleOpenDelete = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowDeleteDialog(true);
  };

  const updateEquipmentItem = (index, field, value) => {
    setEquipmentItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveEquipment = async () => {
    if (!selectedVehicle) return;
    const ok = await saveEquipment(selectedVehicle.id, equipmentItems);
    if (ok) setShowEquipmentDialog(false);
  };

  const handleDeleteVehicle = async () => {
    if (!selectedVehicle) return;
    const ok = await deleteVehicle(selectedVehicle.id);
    if (ok) {
      setShowDeleteDialog(false);
      setSelectedVehicle(null);
    }
  };

  const handleCreateCoupling = (carretaId) => {
    if (!selectedVehicle || !carretaId) {
      toast.error('Seleccione una carreta');
      return false;
    }
    return createCoupling(selectedVehicle.id, carretaId);
  };

  return (
    <div className="space-y-6 page-fade-in" data-testid="vehicles-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Vehículos
          </h1>
          <p className="text-slate-500 mt-1">
            Gestión de tractos y carretas de la flota
          </p>
        </div>
        <Button className="btn-action btn-press btn-shine tap-scale rounded-lg" onClick={() => setShowCreateDialog(true)} data-testid="new-vehicle-btn">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Vehículo
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-white section-enter">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por placa, marca o modelo..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="pl-10 rounded-sm"
                data-testid="search-vehicles-input"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="w-full sm:w-[140px] rounded-sm" data-testid="type-filter">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="tracto">Tracto</SelectItem>
                  <SelectItem value="carreta">Carreta</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="w-full sm:w-[160px] rounded-sm" data-testid="status-filter">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="en_viaje">En Viaje</SelectItem>
                  <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
                  <SelectItem value="fuera_servicio">Fuera de Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <VehicleTable
        vehicles={filteredVehicles}
        loading={loading}
        isAdmin={isAdmin}
        isVehicleCoupled={isVehicleCoupled}
        getCoupledPartnerPlate={getCoupledPartnerPlate}
        getDriverName={getDriverName}
        onViewDetail={handleViewDetail}
        onEdit={handleEditVehicle}
        onViewTires={onViewTires}
        onAssignDriver={handleOpenAssignDriver}
        onOpenEquipment={handleOpenEquipment}
        onOpenCoupling={handleOpenCoupling}
        onUncouple={uncouple}
        onShowCoupledPartner={handleShowCoupledPartner}
        onDelete={handleOpenDelete}
      />

      {/* Stats - bento */}
      <div className="bento-grid">
        {[
          { value: vehicles.filter((v) => v.vehicle_type === 'tracto').length, label: 'Tractos', icon: Truck, color: 'var(--brand-color)' },
          { value: vehicles.filter((v) => v.vehicle_type === 'carreta').length, label: 'Carretas', icon: CircleDot, color: '#475569' },
          { value: vehicles.filter((v) => v.status === 'disponible').length, label: 'Disponibles', icon: UserCheck, color: '#16a34a' },
          { value: vehicles.filter((v) => v.status === 'en_viaje').length, label: 'En Viaje', icon: Truck, color: '#2563eb' },
        ].map((stat, idx) => (
          <div
            key={stat.label}
            className={`metric-tile card-3d card-enter card-stagger-${idx + 1}`}
            style={{ borderLeftColor: stat.color }}
          >
            <stat.icon
              className="metric-watermark"
              style={{ width: '110px', height: '110px', color: stat.color }}
              aria-hidden
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="metric-label">{stat.label}</p>
                <p className="metric-value number-flip mt-1" style={{ color: stat.color }}>{stat.value}</p>
              </div>
              <div
                className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center icon-3d"
                style={{
                  backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${stat.color} 18%, #ffffff) 0%, color-mix(in srgb, ${stat.color} 8%, #ffffff) 100%)`,
                  color: stat.color,
                }}
              >
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <VehicleFormDialog
        mode="create"
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        vehicle={null}
        saving={saving}
        onSave={createVehicle}
      />

      {/* Edit Dialog */}
      <VehicleFormDialog
        mode="edit"
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        vehicle={selectedVehicle}
        saving={saving}
        onSave={(payload) => updateVehicle(selectedVehicle.id, payload)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar el vehículo{' '}
              <strong>{selectedVehicle?.plate}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteVehicle}
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Detail Dialog */}
      <VehicleDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        vehicle={selectedVehicle}
        equipmentItems={equipmentItems}
        getDriverName={getDriverName}
        onViewTires={onViewTires}
        onEditEquipment={handleOpenEquipment}
      />

      {/* Assign Driver Dialog */}
      <AssignDriverDialog
        open={showAssignDriverDialog}
        onOpenChange={setShowAssignDriverDialog}
        vehicle={selectedVehicle}
        drivers={drivers}
        saving={saving}
        onAssign={(driverId) => assignDriver(selectedVehicle.id, driverId)}
      />

      {/* Equipment EPP Dialog */}
      <VehicleEquipmentDialog
        open={showEquipmentDialog}
        onOpenChange={setShowEquipmentDialog}
        vehicle={selectedVehicle}
        items={equipmentItems}
        onItemChange={updateEquipmentItem}
        saving={saving}
        onSave={handleSaveEquipment}
      />

      {/* Coupling Dialog (Acoplar Carreta) */}
      <CouplingDialog
        open={showCouplingDialog}
        onOpenChange={setShowCouplingDialog}
        vehicle={selectedVehicle}
        vehicles={vehicles}
        isVehicleCoupled={isVehicleCoupled}
        saving={saving}
        onCreate={handleCreateCoupling}
      />

      {/* Coupling Info Dialog (Ver Tracto Acoplado) */}
      <CouplingInfoDialog
        open={showCouplingInfoDialog}
        onOpenChange={setShowCouplingInfoDialog}
        vehicle={selectedVehicle}
        vehicles={vehicles}
        getActiveCouplingForVehicle={getActiveCouplingForVehicle}
        getDriverName={getDriverName}
      />
    </div>
  );
};

export default VehiclesPage;
