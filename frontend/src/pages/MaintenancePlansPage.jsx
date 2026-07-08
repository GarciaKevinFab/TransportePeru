import React, { useState, useEffect, useRef } from 'react';
import { maintenanceApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  FileSpreadsheet, Upload, Loader2, Eye, Trash2, BookOpen, Clock, Calendar,
  Wrench, Filter, Droplet, CircleDot, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

const ACTION_LEGEND = {
  A: { label: 'Ajuste', color: 'bg-purple-100 text-purple-800', emoji: '🔧' },
  C: { label: 'Cambio', color: 'bg-red-100 text-red-800', emoji: '🔄' },
  E: { label: 'Engrase', color: 'bg-yellow-100 text-yellow-800', emoji: '🛢️' },
  I: { label: 'Inspección', color: 'bg-blue-100 text-blue-800', emoji: '👁️' },
  L: { label: 'Limpieza', color: 'bg-green-100 text-green-800', emoji: '🧽' },
};

const COMPONENT_ICON = {
  FILTRO: Filter,
  LUBRICANTE: Droplet,
  REFRIGERANTE: Droplet,
  GRASA: CircleDot,
  Repuesto: Wrench,
};

const MaintenancePlansPage = () => {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [importing, setImporting] = useState(false);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--brand-color)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Planes de Mantenimiento
          </h1>
          <p className="text-slate-500 mt-1">Planes matriciales por modelo de vehículo (estilo E MAX 540)</p>
        </div>
        <div>
          <input type="file" accept=".xlsx,.xls" ref={fileRef} onChange={handleImport} className="hidden" />
          <Button className="btn-action btn-press" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {importing ? 'Importando...' : 'Importar desde Excel'}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <Card className="bg-white section-enter">
        <CardHeader>
          <CardTitle className="font-heading uppercase text-sm tracking-wide flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Leyenda de Códigos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(ACTION_LEGEND).map(([code, info]) => (
              <Badge key={code} className={`${info.color} text-base px-3 py-1`}>
                <span className="font-mono font-bold mr-2">{code}</span>
                {info.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <Card className="bg-white">
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-2">No hay planes de mantenimiento</p>
            <p className="text-sm text-slate-400">Importa el primero desde un archivo Excel</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan, idx) => (
            <Card
              key={plan.id}
              className={`bg-white border-l-4 card-enter card-stagger-${(idx % 4) + 1} hover:shadow-md transition-shadow cursor-pointer`}
              style={{ borderLeftColor: 'var(--brand-color)' }}
              onClick={() => handleView(plan)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <FileSpreadsheet className="w-10 h-10" style={{ color: 'var(--brand-color)' }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(plan); }}
                    className="text-slate-400 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-heading text-lg font-bold uppercase tracking-tight mb-2">
                  {plan.name}
                </h3>
                <div className="space-y-1 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>{plan.intervals?.length || 0} intervalos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3" />
                    <span>{plan.sections?.length || 0} secciones</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {plan.sections?.reduce((sum, s) => sum + (s.tasks?.length || 0), 0) || 0} tareas
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => handleView(plan)}>
                  <Eye className="w-4 h-4 mr-2" /> Ver plan completo
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
              {/* Intervals header */}
              <div className="mb-4">
                <div className="text-xs font-bold uppercase text-slate-500 mb-2">Intervalos de mantenimiento</div>
                <div className="flex flex-wrap gap-2">
                  {selectedPlan.intervals?.map((iv, i) => (
                    <div key={i} className="px-3 py-2 bg-slate-100 rounded border text-xs">
                      <div className="font-bold font-mono">{iv.code}</div>
                      <div className="text-slate-600">{iv.hours}h</div>
                      {iv.km && <div className="text-slate-500">{(iv.km / 1000).toFixed(0)}k km</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Matrix table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-900 text-white z-10">
                    <tr>
                      <th className="text-left p-2 border border-slate-700 min-w-[60px]">#</th>
                      <th className="text-left p-2 border border-slate-700 min-w-[200px]">Descripción</th>
                      <th className="text-left p-2 border border-slate-700">Tipo</th>
                      <th className="text-center p-2 border border-slate-700">Qty</th>
                      {selectedPlan.intervals?.map((iv, i) => (
                        <th key={i} className="text-center p-2 border border-slate-700 min-w-[40px]">
                          <div className="font-bold">{iv.code}</div>
                          <div className="text-[10px] opacity-70">{iv.hours}h</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPlan.sections?.map((section, si) => (
                      <React.Fragment key={si}>
                        <tr className="bg-orange-50">
                          <td colSpan={4 + (selectedPlan.intervals?.length || 0)} className="p-2 border border-slate-300 font-bold uppercase tracking-wide">
                            <span style={{ color: 'var(--brand-color)' }} className="font-mono mr-2">{section.code}</span>
                            {section.name}
                          </td>
                        </tr>
                        {section.tasks?.map((task, ti) => {
                          const Icon = COMPONENT_ICON[task.component_type] || AlertTriangle;
                          return (
                            <tr key={`${si}-${ti}`} className="hover:bg-slate-50">
                              <td className="p-2 border border-slate-200 font-mono">{task.n}</td>
                              <td className="p-2 border border-slate-200">{task.description}</td>
                              <td className="p-2 border border-slate-200">
                                {task.component_type && (
                                  <span className="inline-flex items-center gap-1 text-slate-600">
                                    <Icon className="w-3 h-3" />
                                    <span className="text-[10px]">{task.component_type}</span>
                                  </span>
                                )}
                              </td>
                              <td className="p-2 border border-slate-200 text-center">{task.quantity || '-'}</td>
                              {selectedPlan.intervals?.map((iv, ivi) => {
                                const actionKey = iv.code + '_' + ivi;
                                const action = task.actions?.[actionKey];
                                const info = action ? ACTION_LEGEND[action] : null;
                                return (
                                  <td key={ivi} className="p-1 border border-slate-200 text-center">
                                    {action ? (
                                      <span
                                        className={`inline-block w-6 h-6 rounded text-xs font-bold leading-6 ${info?.color || 'bg-slate-200'}`}
                                        title={info?.label || action}
                                      >
                                        {action}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">·</span>
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

              {selectedPlan.notes && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <strong>Observaciones:</strong> {selectedPlan.notes}
                </div>
              )}
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

export default MaintenancePlansPage;
