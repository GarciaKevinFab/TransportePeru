import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Loader2 } from 'lucide-react';

const EMPTY_FORM = {
  plate: '',
  vehicle_type: 'tracto',
  brand: '',
  model: '',
  year: '',
  vin: '',
  color: '',
  fuel_capacity: '',
  tire_config: '6',
  status: 'disponible',
};

/**
 * Dialog de crear/editar vehículo.
 * mode: 'create' | 'edit'. En edición se precarga desde `vehicle` y se
 * muestra el campo Estado. onSave recibe el payload ya normalizado y debe
 * devolver true si la operación fue exitosa (para cerrar el dialog).
 */
const VehicleFormDialog = ({ mode, open, onOpenChange, vehicle, saving, onSave }) => {
  const isEdit = mode === 'edit';
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (isEdit && vehicle) {
      setFormData({
        plate: vehicle.plate || '',
        vehicle_type: vehicle.vehicle_type || 'tracto',
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        year: vehicle.year?.toString() || '',
        vin: vehicle.vin || '',
        color: vehicle.color || '',
        fuel_capacity: vehicle.fuel_capacity?.toString() || '',
        tire_config: vehicle.tire_config || '6',
        status: vehicle.status || 'disponible',
      });
    } else if (!isEdit) {
      setFormData(EMPTY_FORM);
    }
  }, [open, vehicle, isEdit]);

  const handleSubmit = async () => {
    const payload = {
      ...formData,
      year: formData.year ? parseInt(formData.year) : null,
      fuel_capacity: formData.fuel_capacity ? parseFloat(formData.fuel_capacity) : null,
    };
    const ok = await onSave(payload);
    if (ok) onOpenChange(false);
  };

  const row1Class = isEdit
    ? 'grid grid-cols-2 gap-4'
    : 'grid grid-cols-1 sm:grid-cols-2 gap-4';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
            {isEdit ? 'Editar Vehículo' : 'Nuevo Vehículo'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Modifica los datos del vehículo ${vehicle?.plate || ''}`
              : 'Ingresa los datos del nuevo vehículo'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className={row1Class}>
            <div className="space-y-2">
              <Label className="input-label">Placa *</Label>
              <Input
                value={formData.plate}
                onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                placeholder="ABC-123"
                className="rounded-sm uppercase"
                data-testid={isEdit ? undefined : 'vehicle-plate-input'}
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Tipo *</Label>
              <Select
                value={formData.vehicle_type}
                onValueChange={(v) => setFormData({ ...formData, vehicle_type: v })}
              >
                <SelectTrigger className="rounded-sm" data-testid={isEdit ? undefined : 'vehicle-type-select'}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tracto">Tracto</SelectItem>
                  <SelectItem value="carreta">Carreta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="input-label">Marca</Label>
              <Input
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Volvo, Scania, etc."
                className="rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Modelo</Label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="FH16, R500, etc."
                className="rounded-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="input-label">Año</Label>
              <Input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                placeholder="2024"
                className="rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">Color</Label>
              <Input
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="Blanco"
                className="rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="input-label">{isEdit ? 'Cap. Combustible' : 'Cap. Combustible (L)'}</Label>
              <Input
                type="number"
                value={formData.fuel_capacity}
                onChange={(e) => setFormData({ ...formData, fuel_capacity: e.target.value })}
                placeholder="400"
                className="rounded-sm"
              />
            </div>
          </div>
          {isEdit ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">VIN</Label>
                <Input
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                  placeholder="VIN"
                  className="rounded-sm uppercase font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponible">Disponible</SelectItem>
                    <SelectItem value="en_viaje">En Viaje</SelectItem>
                    <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
                    <SelectItem value="fuera_servicio">Fuera de Servicio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="input-label">VIN</Label>
              <Input
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                placeholder="Número de identificación vehicular"
                className="rounded-sm uppercase font-mono"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="btn-action"
            onClick={handleSubmit}
            disabled={!formData.plate || saving}
            data-testid={isEdit ? undefined : 'save-vehicle-btn'}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Actualizar' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleFormDialog;
