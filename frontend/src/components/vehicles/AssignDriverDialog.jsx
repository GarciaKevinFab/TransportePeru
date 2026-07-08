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
import { Loader2 } from 'lucide-react';

/**
 * Dialog de asignación de chofer. onAssign(driverId) recibe el id del
 * chofer o null (sin asignar) y debe devolver true si tuvo éxito.
 */
const AssignDriverDialog = ({ open, onOpenChange, vehicle, drivers, saving, onAssign }) => {
  const [selectedDriverId, setSelectedDriverId] = useState('none');

  useEffect(() => {
    if (open) {
      setSelectedDriverId(vehicle?.assigned_driver_id || 'none');
    }
  }, [open, vehicle]);

  const handleSave = async () => {
    const driverId = selectedDriverId === 'none' ? null : selectedDriverId;
    const ok = await onAssign(driverId);
    if (ok) {
      setSelectedDriverId('none');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
            Asignar Chofer
          </DialogTitle>
          <DialogDescription>
            Vehículo: {vehicle?.plate}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="btn-action"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignDriverDialog;
