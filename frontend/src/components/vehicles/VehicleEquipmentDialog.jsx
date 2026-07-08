import React from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Loader2 } from 'lucide-react';

const VehicleEquipmentDialog = ({
  open,
  onOpenChange,
  vehicle,
  items,
  onItemChange,
  saving,
  onSave,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
            Equipamiento EPP
          </DialogTitle>
          <DialogDescription>
            Vehículo: {vehicle?.plate} - {vehicle?.brand} {vehicle?.model}
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
              {items.map((item, index) => (
                <TableRow key={item.name} className="table-dense">
                  <TableCell className="font-medium">{item.label || item.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => onItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                      className="rounded-sm h-8 w-16"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={item.condition}
                      onValueChange={(v) => onItemChange(index, 'condition', v)}
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
                      onChange={(e) => onItemChange(index, 'expiry_date', e.target.value || null)}
                      className="rounded-sm h-8"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="btn-action" onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar Equipamiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleEquipmentDialog;
