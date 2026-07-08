import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
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
import { Loader2, Link as LinkIcon } from 'lucide-react';

/**
 * Dialog para acoplar una carreta a un tracto.
 * onCreate(carretaId) debe devolver true si el acople fue exitoso.
 */
export const CouplingDialog = ({
  open,
  onOpenChange,
  vehicle,
  vehicles,
  isVehicleCoupled,
  saving,
  onCreate,
}) => {
  const [selectedCarretaId, setSelectedCarretaId] = useState('');

  useEffect(() => {
    if (open) setSelectedCarretaId('');
  }, [open]);

  const availableCarretas = vehicles.filter(
    (v) => v.vehicle_type === 'carreta' && !isVehicleCoupled(v.id)
  );

  const handleCreate = async () => {
    const ok = await onCreate(selectedCarretaId);
    if (ok) {
      setSelectedCarretaId('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
            Acoplar Carreta
          </DialogTitle>
          <DialogDescription>
            Tracto: <strong>{vehicle?.plate}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label className="input-label">Carreta Disponible *</Label>
            <Select value={selectedCarretaId} onValueChange={setSelectedCarretaId}>
              <SelectTrigger className="rounded-sm" data-testid="coupling-carreta-select">
                <SelectValue placeholder="Seleccionar carreta..." />
              </SelectTrigger>
              <SelectContent>
                {availableCarretas.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plate} {v.brand ? `- ${v.brand}` : ''} {v.model ? v.model : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableCarretas.length === 0 && (
              <p className="text-xs text-slate-500">No hay carretas disponibles para acoplar.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="btn-action"
            onClick={handleCreate}
            disabled={!selectedCarretaId || saving}
            data-testid="save-coupling-btn"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <LinkIcon className="w-4 h-4 mr-2" />
            Acoplar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Dialog informativo: muestra el tracto acoplado a una carreta.
 */
export const CouplingInfoDialog = ({
  open,
  onOpenChange,
  vehicle,
  vehicles,
  getActiveCouplingForVehicle,
  getDriverName,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
            Tracto Acoplado
          </DialogTitle>
          <DialogDescription>
            Carreta: <strong>{vehicle?.plate}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {(() => {
            if (!vehicle) return null;
            const coupling = getActiveCouplingForVehicle(vehicle.id);
            if (!coupling) return <p className="text-slate-500">Sin tracto acoplado.</p>;
            const tracto = vehicles.find((v) => v.id === coupling.tracto_id);
            if (!tracto) return <p className="text-slate-500">Tracto no encontrado.</p>;
            return (
              <div className="space-y-3 p-4 bg-slate-50 rounded-sm">
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">Placa</p>
                  <p className="font-mono font-bold text-lg">{tracto.plate}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">Marca / Modelo</p>
                  <p>{tracto.brand || '-'} {tracto.model || ''}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 font-bold">Chofer</p>
                  <p>{getDriverName(tracto.assigned_driver_id) || 'Sin asignar'}</p>
                </div>
                {coupling.start_date && (
                  <div>
                    <p className="text-xs uppercase text-slate-500 font-bold">Acoplado desde</p>
                    <p className="text-sm">{coupling.start_date.substring(0, 10)}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
