import React from 'react';
import { Card, CardContent } from '../ui/card';
import EstadoVacio from '../EstadoVacio';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Truck,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Loader2,
  CircleDot,
  UserCheck,
  Shield,
  User,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';
import { getStatusBadge, getTypeBadge } from './vehicleBadges';

const VehicleTable = ({
  vehicles,
  totalVehiculos = 0,
  onCreate,
  loading,
  isAdmin,
  isVehicleCoupled,
  getCoupledPartnerPlate,
  getDriverName,
  onViewDetail,
  onEdit,
  onViewTires,
  onAssignDriver,
  onOpenEquipment,
  onOpenCoupling,
  onUncouple,
  onShowCoupledPartner,
  onDelete,
}) => {
  /* Un solo menu para la tabla (escritorio) y las tarjetas (movil), igual que
     AccionesViaje en TripsPage: una accion nueva aparece en ambas vistas o en
     ninguna. */
  const AccionesVehiculo = ({ vehicle }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid={`vehicle-actions-${vehicle.plate}`}>
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onViewDetail(vehicle)}>
          <Eye className="w-4 h-4 mr-2" />
          Ver Detalles
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onClick={() => onEdit(vehicle)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onViewTires(vehicle)}>
          <CircleDot className="w-4 h-4 mr-2" />
          Ver Llantas
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onClick={() => onAssignDriver(vehicle)}>
            <UserCheck className="w-4 h-4 mr-2" />
            Asignar Chofer
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onOpenEquipment(vehicle)}>
          <Shield className="w-4 h-4 mr-2" />
          Equipamiento EPP
        </DropdownMenuItem>
        {vehicle.vehicle_type === 'tracto' && !isVehicleCoupled(vehicle.id) && (
          <DropdownMenuItem onClick={() => onOpenCoupling(vehicle)}>
            <LinkIcon className="w-4 h-4 mr-2" />
            Acoplar Carreta
          </DropdownMenuItem>
        )}
        {isVehicleCoupled(vehicle.id) && (
          <DropdownMenuItem onClick={() => onUncouple(vehicle)}>
            <Unlink className="w-4 h-4 mr-2" />
            Desacoplar
          </DropdownMenuItem>
        )}
        {vehicle.vehicle_type === 'carreta' && isVehicleCoupled(vehicle.id) && (
          <DropdownMenuItem onClick={() => onShowCoupledPartner(vehicle)}>
            <Eye className="w-4 h-4 mr-2" />
            Ver Tracto Acoplado
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => onDelete(vehicle)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Card className="bg-white section-enter section-stagger-1">
      <CardContent className="p-0 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : vehicles.length === 0 ? (
          totalVehiculos === 0 ? (
            <EstadoVacio
              icono={Truck}
              titulo="Registra tu primer vehículo"
              texto="Con tus tractos y carretas cargados podrás programar viajes, controlar llantas y recibir alertas de vencimientos."
              accion={onCreate ? { texto: 'Nuevo vehículo', onClick: onCreate } : undefined}
            />
          ) : (
            <EstadoVacio
              icono={Truck}
              titulo="Sin resultados"
              texto="Ningún vehículo coincide con la búsqueda o el filtro. Límpialos para ver la flota completa."
              filtrado
            />
          )
        ) : (
          <>
          {/* Movil: tarjetas. Ocho columnas en 375px esconden estado y
              acciones tras un arrastre lateral que nadie descubre. */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {vehicle.plate}
                    </span>
                    {getStatusBadge(vehicle.status)}
                    {isVehicleCoupled(vehicle.id) && (
                      <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50 text-[10px]">
                        <LinkIcon className="w-3 h-3 mr-1" />
                        {getCoupledPartnerPlate(vehicle) || 'Acoplado'}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || '-'}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {getTypeBadge(vehicle.vehicle_type)}
                    <span className="font-mono">{vehicle.odometer?.toLocaleString() || 0} km</span>
                    {getDriverName(vehicle.assigned_driver_id) ? (
                      <span className="inline-flex items-center gap-1 truncate">
                        <User className="h-3 w-3 text-green-600" />
                        {getDriverName(vehicle.assigned_driver_id)}
                      </span>
                    ) : (
                      <span className="text-slate-400">Sin chofer</span>
                    )}
                  </p>
                </div>
                <AccionesVehiculo vehicle={vehicle} />
              </div>
            ))}
          </div>

          {/* Escritorio: la tabla de siempre */}
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="table-dense">
                <TableHead>Placa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Marca / Modelo</TableHead>
                <TableHead>Año</TableHead>
                <TableHead>Chofer Asignado</TableHead>
                <TableHead>Odómetro</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => (
                <TableRow key={vehicle.id} className="table-dense table-row-lift">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {vehicle.plate}
                      </span>
                      {isVehicleCoupled(vehicle.id) && (
                        <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50 text-[10px]">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          {getCoupledPartnerPlate(vehicle) || 'Acoplado'}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(vehicle.vehicle_type)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{vehicle.brand || '-'}</p>
                      <p className="text-xs text-slate-500">{vehicle.model || '-'}</p>
                    </div>
                  </TableCell>
                  <TableCell>{vehicle.year || '-'}</TableCell>
                  <TableCell>
                    {getDriverName(vehicle.assigned_driver_id) ? (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-green-600" />
                        <span className="text-sm">{getDriverName(vehicle.assigned_driver_id)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Sin asignar</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">
                      {vehicle.odometer?.toLocaleString() || 0} km
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                  <TableCell className="text-right">
                    <AccionesVehiculo vehicle={vehicle} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default VehicleTable;
