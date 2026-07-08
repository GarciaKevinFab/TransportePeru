import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tiresApi, vehiclesApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  ArrowLeft,
  Loader2,
  CircleDot,
  TrendingDown,
  Gauge,
  Route,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const minDepth = (depths) => {
  if (!Array.isArray(depths) || depths.length === 0) return null;
  const nums = depths.filter((d) => typeof d === 'number' && !Number.isNaN(d));
  return nums.length ? Math.min(...nums) : null;
};

const TireGraphsPage = () => {
  const { vehicleId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState(null);
  const [tires, setTires] = useState([]);
  const [selectedTireId, setSelectedTireId] = useState('');
  const [inspections, setInspections] = useState([]);
  const [loadingInspections, setLoadingInspections] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [vehicleRes, tiresRes] = await Promise.all([
          vehiclesApi.getById(vehicleId),
          tiresApi.getByVehicle(vehicleId),
        ]);
        setVehicle(vehicleRes.data);
        const mounted = tiresRes.data || [];
        setTires(mounted);
        if (mounted.length > 0) {
          setSelectedTireId(mounted[0].id);
        }
      } catch (error) {
        toast.error('Error al cargar datos del vehículo');
        navigate('/vehicles');
      }
      setLoading(false);
    };
    fetchData();
  }, [vehicleId, navigate]);

  useEffect(() => {
    if (!selectedTireId) {
      setInspections([]);
      return;
    }
    const fetchInspections = async () => {
      setLoadingInspections(true);
      try {
        const res = await tiresApi.getInspections(selectedTireId);
        setInspections(res.data || []);
      } catch (error) {
        toast.error('Error al cargar inspecciones de la llanta');
        setInspections([]);
      }
      setLoadingInspections(false);
    };
    fetchInspections();
  }, [selectedTireId]);

  const selectedTire = useMemo(
    () => tires.find((t) => t.id === selectedTireId) || null,
    [tires, selectedTireId]
  );

  // Backend returns inspections sorted by inspection_date DESC.
  // Reverse to chronological order and build one point per inspection.
  const chartData = useMemo(() => {
    return [...inspections]
      .reverse()
      .map((insp) => ({
        date: formatDate(insp.inspection_date),
        depth: minDepth(insp.depths),
        pressure:
          typeof insp.pressure === 'number' && insp.pressure > 0 ? insp.pressure : null,
        odometer: insp.odometer ?? null,
      }));
  }, [inspections]);

  const hasPressure = useMemo(
    () => chartData.some((d) => d.pressure !== null),
    [chartData]
  );
  const hasDepth = useMemo(() => chartData.some((d) => d.depth !== null), [chartData]);

  const formatMoney = (value) =>
    typeof value === 'number' ? `S/ ${value.toFixed(2)}` : '-';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tire-graphs-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/vehicles')}
          data-testid="tire-graphs-back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Gráficas de Llantas
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <Badge variant="outline" className="font-mono text-lg">
              {vehicle?.plate}
            </Badge>
            <span className="text-slate-500">
              {vehicle?.brand} {vehicle?.model} -{' '}
              {vehicle?.vehicle_type === 'tracto' ? 'Tracto' : 'Carreta'}
            </span>
          </div>
        </div>
      </div>

      {/* Tire selector */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
            Seleccionar Llanta Montada
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tires.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CircleDot className="w-12 h-12 mx-auto mb-2" />
              <p>No hay llantas montadas en este vehículo</p>
            </div>
          ) : (
            <div className="max-w-md">
              <Select value={selectedTireId} onValueChange={setSelectedTireId}>
                <SelectTrigger className="rounded-sm" data-testid="tire-graphs-select">
                  <SelectValue placeholder="Seleccionar llanta" />
                </SelectTrigger>
                <SelectContent>
                  {tires.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.current_position ? `[${t.current_position}] ` : ''}
                      {t.serial} - {t.brand} {t.dimension}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTire && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-sm bg-blue-50">
                    <Route className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">Km Recorridos</p>
                    <p className="font-heading text-2xl font-bold text-slate-900 font-mono">
                      {(selectedTire.total_km || 0).toLocaleString()} km
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-sm bg-green-50">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">Costo / Km</p>
                    <p className="font-heading text-2xl font-bold text-slate-900 font-mono">
                      {formatMoney(selectedTire.cost_per_km)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-sm bg-orange-50">
                    <TrendingDown className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">Costo / mm</p>
                    <p className="font-heading text-2xl font-bold text-slate-900 font-mono">
                      {formatMoney(selectedTire.cost_per_mm)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Depth chart */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Evolución de Profundidad (mm)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingInspections ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : !hasDepth ? (
                <div className="text-center py-12 text-slate-400" data-testid="tire-graphs-depth-empty">
                  <CircleDot className="w-12 h-12 mx-auto mb-2" />
                  <p>Sin inspecciones registradas para esta llanta</p>
                </div>
              ) : (
                <div className="w-full h-72" data-testid="tire-graphs-depth-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="#94a3b8"
                        label={{ value: 'mm', angle: -90, position: 'insideLeft', fontSize: 12 }}
                      />
                      <Tooltip formatter={(value) => [`${value} mm`, 'Profundidad mín.']} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="depth"
                        name="Profundidad mín. (mm)"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pressure chart */}
          {hasPressure && (
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  Evolución de Presión (PSI)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-72" data-testid="tire-graphs-pressure-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="#94a3b8"
                        label={{ value: 'PSI', angle: -90, position: 'insideLeft', fontSize: 12 }}
                      />
                      <Tooltip formatter={(value) => [`${value} PSI`, 'Presión']} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="pressure"
                        name="Presión (PSI)"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default TireGraphsPage;
