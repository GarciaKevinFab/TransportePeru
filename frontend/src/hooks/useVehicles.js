import { useState, useEffect, useMemo, useCallback } from 'react';
import { vehiclesApi, usersApi, couplingsApi } from '../services/api';
import { toast } from 'sonner';

const DEFAULT_FILTERS = {
  search: '',
  type: 'all',
  status: 'all',
};

/**
 * Encapsula el estado y las operaciones de la página de Vehículos:
 * lista, choferes, acoplamientos (couplings), filtros/búsqueda y las
 * llamadas API de crear/editar/eliminar/asignar/acoplar/equipamiento.
 * Mantiene exactamente el mismo comportamiento observable (toasts,
 * endpoints y refetch) que tenía VehiclesPage.
 */
export function useVehicles() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [couplings, setCouplings] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const [vehiclesRes, driversRes, couplingsRes] = await Promise.all([
        vehiclesApi.getAll(),
        usersApi.getAll({ role: 'chofer' }),
        couplingsApi.getAll().catch(() => ({ data: [] })),
      ]);
      setVehicles(vehiclesRes.data);
      setDrivers(driversRes.data);
      // Keep only active couplings (no end_date)
      const active = (couplingsRes.data || []).filter((c) => !c.end_date);
      setCouplings(active);
    } catch (error) {
      toast.error('Error al cargar vehículos');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const filteredVehicles = useMemo(() => {
    let filtered = vehicles;

    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.plate.toLowerCase().includes(term) ||
          v.brand?.toLowerCase().includes(term) ||
          v.model?.toLowerCase().includes(term)
      );
    }

    if (filters.type !== 'all') {
      filtered = filtered.filter((v) => v.vehicle_type === filters.type);
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter((v) => v.status === filters.status);
    }

    return filtered;
  }, [vehicles, filters]);

  // --- Coupling helpers ---
  const getActiveCouplingForVehicle = useCallback(
    (vehicleId) =>
      couplings.find((c) => c.tracto_id === vehicleId || c.carreta_id === vehicleId),
    [couplings]
  );

  const isVehicleCoupled = useCallback(
    (vehicleId) => !!getActiveCouplingForVehicle(vehicleId),
    [getActiveCouplingForVehicle]
  );

  const getCoupledPartnerPlate = useCallback(
    (vehicle) => {
      const coupling = getActiveCouplingForVehicle(vehicle.id);
      if (!coupling) return null;
      const partnerId =
        vehicle.vehicle_type === 'tracto' ? coupling.carreta_id : coupling.tracto_id;
      const partner = vehicles.find((v) => v.id === partnerId);
      return partner?.plate || null;
    },
    [getActiveCouplingForVehicle, vehicles]
  );

  const getDriverName = useCallback(
    (driverId) => {
      if (!driverId) return null;
      const driver = drivers.find((d) => d.id === driverId);
      return driver?.name || null;
    },
    [drivers]
  );

  // --- Operations ---
  const createVehicle = async (payload) => {
    setSaving(true);
    let ok = false;
    try {
      await vehiclesApi.create(payload);
      toast.success('Vehículo creado exitosamente');
      fetchVehicles();
      ok = true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear vehículo');
    }
    setSaving(false);
    return ok;
  };

  const updateVehicle = async (id, payload) => {
    setSaving(true);
    let ok = false;
    try {
      await vehiclesApi.update(id, payload);
      toast.success('Vehículo actualizado');
      fetchVehicles();
      ok = true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar vehículo');
    }
    setSaving(false);
    return ok;
  };

  const deleteVehicle = async (id) => {
    setSaving(true);
    let ok = false;
    try {
      await vehiclesApi.delete(id);
      toast.success('Vehículo eliminado');
      fetchVehicles();
      ok = true;
    } catch (error) {
      toast.error('Error al eliminar vehículo');
    }
    setSaving(false);
    return ok;
  };

  const assignDriver = async (id, driverId) => {
    setSaving(true);
    let ok = false;
    try {
      await vehiclesApi.assignDriver(id, driverId);
      toast.success(driverId ? 'Chofer asignado exitosamente' : 'Chofer desasignado');
      fetchVehicles();
      ok = true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al asignar chofer');
    }
    setSaving(false);
    return ok;
  };

  const createCoupling = async (tractoId, carretaId) => {
    setSaving(true);
    let ok = false;
    try {
      await couplingsApi.create({ tracto_id: tractoId, carreta_id: carretaId });
      toast.success('Carreta acoplada exitosamente');
      fetchVehicles();
      ok = true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al acoplar carreta');
    }
    setSaving(false);
    return ok;
  };

  const uncouple = async (vehicle) => {
    const coupling = getActiveCouplingForVehicle(vehicle.id);
    if (!coupling) {
      toast.error('Vehículo no está acoplado');
      return false;
    }
    if (!window.confirm('¿Desacoplar este vehículo?')) return false;
    try {
      await couplingsApi.update(coupling.id, { end_date: new Date().toISOString() });
      toast.success('Vehículo desacoplado');
      fetchVehicles();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al desacoplar');
      return false;
    }
  };

  const getEquipment = async (id) => {
    try {
      const res = await vehiclesApi.getEquipment(id);
      return res.data.items || [];
    } catch {
      return [];
    }
  };

  const saveEquipment = async (id, items) => {
    setSaving(true);
    let ok = false;
    try {
      await vehiclesApi.updateEquipment(id, { items });
      toast.success('Equipamiento actualizado');
      ok = true;
    } catch (error) {
      toast.error('Error al guardar equipamiento');
    }
    setSaving(false);
    return ok;
  };

  return {
    // state
    loading,
    saving,
    vehicles,
    drivers,
    couplings,
    filters,
    setFilters,
    filteredVehicles,
    refetch: fetchVehicles,
    // helpers
    getActiveCouplingForVehicle,
    isVehicleCoupled,
    getCoupledPartnerPlate,
    getDriverName,
    // operations
    createVehicle,
    updateVehicle,
    deleteVehicle,
    assignDriver,
    createCoupling,
    uncouple,
    getEquipment,
    saveEquipment,
  };
}

export default useVehicles;
