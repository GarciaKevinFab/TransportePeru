import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { CircleDot, Shield, User } from 'lucide-react';
import { getStatusBadge } from './vehicleBadges';

const VehicleDetailDialog = ({
  open,
  onOpenChange,
  vehicle,
  equipmentItems,
  getDriverName,
  onViewTires,
  onEditEquipment,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
            Detalle del Vehículo
          </DialogTitle>
          <DialogDescription>
            {vehicle?.plate} - {vehicle?.vehicle_type === 'tracto' ? 'Tracto' : 'Carreta'}
          </DialogDescription>
        </DialogHeader>
        {vehicle && (
          <div className="py-4 space-y-4">
            {/* Vehicle Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs uppercase text-grafito-500 font-bold">Placa</p>
                <p className="font-mono font-bold text-lg">{vehicle.plate}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-grafito-500 font-bold">Marca / Modelo</p>
                <p className="font-medium">{vehicle.brand || '-'} {vehicle.model || ''}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-grafito-500 font-bold">Año</p>
                <p className="font-medium">{vehicle.year || '-'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-grafito-500 font-bold">VIN</p>
                <p className="font-mono text-sm">{vehicle.vin || '-'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-grafito-500 font-bold">Odómetro</p>
                <p className="font-mono">{vehicle.odometer?.toLocaleString() || 0} km</p>
              </div>
              <div>
                <p className="text-xs uppercase text-grafito-500 font-bold">Estado</p>
                {getStatusBadge(vehicle.status)}
              </div>
            </div>

            {/* Assigned Driver */}
            <div className="p-3 bg-grafito-50 rounded-sm">
              <p className="text-xs uppercase text-grafito-500 font-bold mb-1">Chofer Asignado</p>
              {getDriverName(vehicle.assigned_driver_id) ? (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-green-600" />
                  <span className="font-medium">{getDriverName(vehicle.assigned_driver_id)}</span>
                </div>
              ) : (
                <span className="text-grafito-400">Sin chofer asignado</span>
              )}
            </div>

            {/* EPP Summary */}
            <div>
              <p className="text-xs uppercase text-grafito-500 font-bold mb-2">Equipamiento EPP</p>
              <div className="grid grid-cols-2 gap-2">
                {equipmentItems.map((item) => (
                  <div key={item.name} className={`flex items-center justify-between p-2 rounded-sm text-sm ${
                    item.condition === 'bueno' ? 'bg-green-50 border border-green-200' :
                    item.condition === 'regular' ? 'bg-yellow-50 border border-yellow-200' :
                    item.condition === 'malo' || item.condition === 'vencido' ? 'bg-red-50 border border-red-200' :
                    'bg-grafito-50 border border-grafito-200'
                  }`}>
                    <span>{item.label || item.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{item.quantity}</Badge>
                      <span className={`text-xs capitalize ${
                        item.condition === 'bueno' ? 'text-green-600' :
                        item.condition === 'regular' ? 'text-yellow-600' :
                        item.condition === 'malo' || item.condition === 'vencido' ? 'text-red-600' :
                        'text-grafito-400'
                      }`}>{item.condition}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => {
            onOpenChange(false);
            if (vehicle) onViewTires(vehicle);
          }}>
            <CircleDot className="w-4 h-4 mr-2" />
            Ver Llantas
          </Button>
          <Button variant="outline" onClick={() => {
            onOpenChange(false);
            if (vehicle) onEditEquipment(vehicle);
          }}>
            <Shield className="w-4 h-4 mr-2" />
            Editar EPP
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleDetailDialog;
