import React from 'react';
import { Badge } from '../ui/badge';
import { Truck, CircleDot } from 'lucide-react';

export const getStatusBadge = (status) => {
  const classes = {
    disponible: 'pill-success',
    en_viaje: 'pill-info',
    en_mantenimiento: 'pill-warning',
    fuera_servicio: 'pill-danger',
  };
  const labels = {
    disponible: 'Disponible',
    en_viaje: 'En Viaje',
    en_mantenimiento: 'En Mantenimiento',
    fuera_servicio: 'Fuera de Servicio',
  };
  return (
    <span className={classes[status] || 'pill-gradient'}>
      {labels[status] || status}
    </span>
  );
};

export const getTypeBadge = (type) => {
  return type === 'tracto' ? (
    <Badge variant="outline" className="border-marca-300 text-marca-700 bg-marca-50">
      <Truck className="w-3 h-3 mr-1" />
      Tracto
    </Badge>
  ) : (
    <Badge variant="outline" className="border-slate-300 text-slate-700 bg-slate-50">
      <CircleDot className="w-3 h-3 mr-1" />
      Carreta
    </Badge>
  );
};
