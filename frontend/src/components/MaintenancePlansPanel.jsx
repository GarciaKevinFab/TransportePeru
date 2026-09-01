import React, { useState, useEffect, useRef } from 'react';
import { maintenanceApi } from '../services/api';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  FileSpreadsheet, Upload, Loader2, Eye, Trash2, BookOpen, Clock,
  Wrench, Filter, Droplet, CircleDot, AlertTriangle, Truck, Link2,
} from 'lucide-react';
import { toast } from 'sonner';

const ACTION_LEGEND = {
  A: { label: 'Ajuste', color: 'bg-purple-100 text-purple-800' },
  C: { label: 'Cambio', color: 'bg-red-100 text-red-800' },
  E: { label: 'Engrase', color: 'bg-yellow-100 text-yellow-800' },
  I: { label: 'Inspección', color: 'bg-blue-100 text-blue-800' },
  L: { label: 'Limpieza', color: 'bg-green-100 text-green-800' },
};

const COMPONENT_ICON = {
  FILTRO: Filter, LUBRICANTE: Droplet, REFRIGERANTE: Droplet, GRASA: CircleDot, Repuesto: Wrench,
};

const MaintenancePlansPanel = ({ vehicles = [] }) => {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [importing, setImporting] = useState(false);
  const [assignVehicleIds, setAssignVehicleIds] = useState([]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await maintenanceApi.getMatrixPlans();
      setPlans(res.data);
    } catch (e) {
      toast.error('Error al cargar planes');
    }
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await maintenanceApi.importMatrixPlanExcel(file);
      toast.success(`Importado: ${res.data.tasks_count} tareas, ${res.data.sections_count} secciones`);
      fetchPlans();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al importar');
    }
    setImporting(false);
    e.target.value = '';
  };

  const handleView = async (plan) => {
    try {
      const res = await maintenanceApi.getMatrixPlan(plan.id);
      setSelectedPlan(res.data);
      setShowViewer(true);
    } catch (e) {
      toast.error('Error al cargar plan');
    }
  };

  const handleDelete = async (plan) => {
    if (!confirm(`¿Eliminar el plan "${plan.name}"?`)) return;
    try {
      await maintenanceApi.deleteMatrixPlan(plan.id);
      toast.success('Plan eliminado');
      fetchPlans();
    } catch (e) {
      toast.error('Error al eliminar');
    }
  };

  const openAssignDialog = (plan) => {
    setSelectedPlan(plan);
    setAssignVehicleIds(plan.applies_to_vehicle_ids || []);
    setShowAssign(true);
  };

  const toggleVehicle = (vid) => {
    setAssignVehicleIds(prev =>
      prev.includes(vid) ? prev.filter(x => x !== vid) : [...prev, vid]
    );
  };

  const saveAssignment = async () => {
    try {
      await maintenanceApi.updateMatrixPlan(selectedPlan.id, {
        applies_to_vehicle_ids: assignVehicleIds,
      });
      toast.success('Asignación guardada');
      setShowAssign(false);
      fetchPlans();
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  const getAssignedPlate = (id) => {
    const v = vehicles.find(x => x.id === id);
    return v ? v.plate : id.substring(0, 8);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--brand-color)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <Card className="bg-white">
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-grafito-500" />
            <div>
              <p className="text-sm font-bold">Planes preventivos por modelo de vehículo</p>
              <p className="text-xs text-grafito-500">Importa un Excel (estilo E MAX 540) o crea uno desde cero</p>
            </div>
          </div>
          <div>
            <input type="file" accept=".xlsx,.xls" ref={fileRef} onChange={handleImport} className="hidden" />
            <Button className="btn-action btn-press" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {importing ? 'Importando...' : 'Importar Excel'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-white">
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold uppercase text-grafito-500 mr-2">Leyenda:</span>
            {Object.entries(ACTION_LEGEND).map(([code, info]) => (
              <Badge key={code} className={`${info.color} text-xs`}>
                <span className="font-mono font-bold mr-1">{code}</span>
                {info.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <Card className="bg-white border-dashed">
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="w-16 h-16 text-grafito-300 mx-auto mb-4" />
            <p className="text-grafito-500 mb-2">No hay planes de mantenimiento</p>
            <p className="text-sm text-grafito-400">Importa el primero desde un archivo Excel</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan, idx) => (
            <Card
              key={plan.id}
              className={`bg-white border-l-4 card-enter card-stagger-${(idx % 4) + 1} hover:shadow-md transition-shadow`}
              style={{ borderLeftColor: 'var(--brand-color)' }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <FileSpreadsheet className="w-10 h-10" style={{ color: 'var(--brand-color)' }} />
                  <button
                    onClick={() => handleDelete(plan)}
                    className="text-grafito-400 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-heading text-lg font-bold uppercase tracking-tight mb-2">
                  {plan.name}
                </h3>
                <div className="space-y-1 text-sm text-grafito-600 mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>{plan.intervals?.length || 0} intervalos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3" />
                    <span>{plan.sections?.length || 0} secciones · {plan.sections?.reduce((s,sec)=>s+(sec.tasks?.length||0),0) || 0} tareas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-3 h-3" />
                    <span className="font-semibold" style={{ color: 'var(--brand-color)' }}>
                      {plan.applies_to_vehicle_ids?.length || 0} vehículo(s) asignado(s)
                    </span>
                  </div>
                </div>
                {plan.applies_to_vehicle_ids?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {plan.applies_to_vehicle_ids.slice(0, 4).map(vid => (
                      <Badge key={vid} variant="outline" className="text-[10px]">
                        {getAssignedPlate(vid)}
                      </Badge>
                    ))}
                    {plan.applies_to_vehicle_ids.length > 4 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{plan.applies_to_vehicle_ids.length - 4}
                      </Badge>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleView(plan)}>
                    <Eye className="w-3 h-3 mr-1" /> Ver
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openAssignDialog(plan)}>
                    <Link2 className="w-3 h-3 mr-1" /> Asignar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign vehicles dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-wide">
              Asignar a Vehículos
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-grafito-600">
              Selecciona los vehículos a los que aplica el plan <strong>{selectedPlan?.name}</strong>
            </p>
            {vehicles.length === 0 ? (
              <p className="text-sm text-grafito-500">No hay vehículos disponibles</p>
            ) : (
              <div className="space-y-2">
                {/* Group by type — 'otros' captura cualquier vehículo sin tipo tracto/carreta */}
                {[
                  { key: 'tracto', label: 'Tractos' },
                  { key: 'carreta', label: 'Carretas' },
                  { key: 'otros', label: 'Otros' },
                ].map(({ key, label }) => {
                  const list = key === 'otros'
                    ? vehicles.filter(v => v.vehicle_type !== 'tracto' && v.vehicle_type !== 'carreta')
                    : vehicles.filter(v => v.vehicle_type === key);
                  if (list.length === 0) return null;
                  const selectedInGroup = list.filter(v => assignVehicleIds.includes(v.id)).length;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mt-3 mb-1">
                        <div className="text-xs font-bold uppercase text-grafito-500">{label}</div>
                        {selectedInGroup > 0 && (
                          <Badge variant="outline" className="text-[10px]">{selectedInGroup} seleccionado(s)</Badge>
                        )}
                      </div>
                      {list.map(v => (
                        <label key={v.id} className="flex items-center gap-2 p-2 hover:bg-grafito-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assignVehicleIds.includes(v.id)}
                            onChange={() => toggleVehicle(v.id)}
                            className="w-4 h-4"
                          />
                          <Truck className="w-4 h-4 text-grafito-400" />
                          <span className="font-mono font-bold">{v.plate}</span>
                          <span className="text-sm text-grafito-500">{v.brand} {v.model}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancelar</Button>
            <Button className="btn-action btn-press" onClick={saveAssignment}>
              Guardar ({assignVehicleIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Viewer Dialog */}
      <Dialog open={showViewer} onOpenChange={setShowViewer}>
        <DialogContent className="max-w-[98vw] sm:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {selectedPlan?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedPlan && (
            <div className="flex-1 overflow-auto">
              <div className="mb-4">
                <div className="text-xs font-bold uppercase text-grafito-500 mb-2">Intervalos</div>
                <div className="flex flex-wrap gap-2">
                  {selectedPlan.intervals?.map((iv, i) => (
                    <div key={i} className="px-3 py-2 bg-grafito-100 rounded border text-xs">
                      <div className="font-bold font-mono">{iv.code}</div>
                      <div className="text-grafito-600">{iv.hours}h</div>
                      {iv.km && <div className="text-grafito-500">{(iv.km / 1000).toFixed(0)}k km</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-grafito-900 text-white z-10">
                    <tr>
                      <th className="text-left p-2 border border-grafito-700 min-w-[50px]">#</th>
                      <th className="text-left p-2 border border-grafito-700 min-w-[200px]">Descripción</th>
                      <th className="text-left p-2 border border-grafito-700">Tipo</th>
                      <th className="text-center p-2 border border-grafito-700">Qty</th>
                      {selectedPlan.intervals?.map((iv, i) => (
                        <th key={i} className="text-center p-2 border border-grafito-700 min-w-[40px]">
                          <div className="font-bold">{iv.code}</div>
                          <div className="text-[10px] opacity-70">{iv.hours}h</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPlan.sections?.map((section, si) => (
                      <React.Fragment key={si}>
                        <tr className="bg-marca-50">
                          <td colSpan={4 + (selectedPlan.intervals?.length || 0)} className="p-2 border border-grafito-300 font-bold uppercase tracking-wide">
                            <span style={{ color: 'var(--brand-color)' }} className="font-mono mr-2">{section.code}</span>
                            {section.name}
                          </td>
                        </tr>
                        {section.tasks?.map((task, ti) => {
                          const Icon = COMPONENT_ICON[task.component_type] || AlertTriangle;
                          return (
                            <tr key={`${si}-${ti}`} className="hover:bg-grafito-50">
                              <td className="p-2 border border-grafito-200 font-mono">{task.n}</td>
                              <td className="p-2 border border-grafito-200">{task.description}</td>
                              <td className="p-2 border border-grafito-200">
                                {task.component_type && (
                                  <span className="inline-flex items-center gap-1 text-grafito-600">
                                    <Icon className="w-3 h-3" />
                                    <span className="text-[10px]">{task.component_type}</span>
                                  </span>
                                )}
                              </td>
                              <td className="p-2 border border-grafito-200 text-center">{task.quantity || '-'}</td>
                              {selectedPlan.intervals?.map((iv, ivi) => {
                                const actionKey = iv.code + '_' + ivi;
                                const action = task.actions?.[actionKey];
                                const info = action ? ACTION_LEGEND[action] : null;
                                return (
                                  <td key={ivi} className="p-1 border border-grafito-200 text-center">
                                    {action ? (
                                      <span
                                        className={`inline-block w-6 h-6 rounded text-xs font-bold leading-6 ${info?.color || 'bg-grafito-200'}`}
                                        title={info?.label || action}
                                      >
                                        {action}
                                      </span>
                                    ) : (
                                      <span className="text-grafito-300">·</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewer(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaintenancePlansPanel;
