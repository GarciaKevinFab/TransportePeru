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
  ReferenceLine,
} from 'recharts';
import {
  ArrowLeft,
  Loader2,
  CircleDot,
  TrendingDown,
  Gauge,
  Route,
  DollarSign,
  Hourglass,
  CalendarClock,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { EsqueletoPagina } from '../components/Esqueletos';

// Profundidad mínima legal / crítica (mm). El backend usa 3mm por defecto.
const CRITICAL_DEPTH_MM = 3;

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
  const [projection, setProjection] = useState(null);
  const [loadingProjection, setLoadingProjection] = useState(false);

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

  // Proyección de vida de la llanta (opcional: nunca bloquea la página).
  useEffect(() => {
    if (!selectedTireId) {
      setProjection(null);
      return;
    }
    let cancelled = false;
    const fetchProjection = async () => {
      setLoadingProjection(true);
      try {
        const res = await tiresApi.getProjection(selectedTireId);
        if (!cancelled) setProjection(res.data || null);
      } catch (error) {
        if (!cancelled) setProjection(null);
      }
      if (!cancelled) setLoadingProjection(false);
    };
    fetchProjection();
    return () => {
      cancelled = true;
    };
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

  // Se necesitan al menos 2 inspecciones para estimar una tendencia de desgaste.
  const enoughForProjection = inspections.length >= 2;

  // Serie de profundidad con una línea de proyección (tendencia) que parte del
  // último punto real y llega al umbral crítico en la fecha estimada de cambio.
  const depthChartData = useMemo(() => {
    const base = chartData.map((d) => ({ ...d, projected: null }));
    const lastIdx = base.length - 1;
    if (
      projection &&
      !projection.needs_review &&
      projection.estimated_change_date &&
      lastIdx >= 0 &&
      base[lastIdx].depth !== null
    ) {
      base[lastIdx] = { ...base[lastIdx], projected: base[lastIdx].depth };
      base.push({
        date: formatDate(projection.estimated_change_date),
        depth: null,
        pressure: null,
        odometer: null,
        projected: CRITICAL_DEPTH_MM,
      });
    }
    return base;
  }, [chartData, projection]);

  const hasProjectionLine = useMemo(
    () => depthChartData.some((d) => d.projected !== null),
    [depthChartData]
  );

  const wearRatePer1000 = useMemo(() => {
    const rate = projection?.wear_rate_mm_per_km;
    return typeof rate === 'number' && !Number.isNaN(rate) ? rate * 1000 : null;
  }, [projection]);

  const formatKm = (value) =>
    typeof value === 'number' && !Number.isNaN(value)
      ? `${Math.round(value).toLocaleString('es-PE')} km`
      : '—';

  const formatMoney = (value) =>
    typeof value === 'number' ? `S/ ${value.toFixed(2)}` : '-';

  if (loading) {
    return (
      <EsqueletoPagina />
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
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-grafito-900">
            Gráficas de Llantas
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <Badge variant="outline" className="font-mono text-lg">
              {vehicle?.plate}
            </Badge>
            <span className="text-grafito-500">
              {vehicle?.brand} {vehicle?.model} -{' '}
              {vehicle?.vehicle_type === 'tracto' ? 'Tracto' : 'Carreta'}
            </span>
          </div>
        </div>
      </div>

      {/* Tire selector */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest">
            Seleccionar Llanta Montada
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tires.length === 0 ? (
            <div className="text-center py-8 text-grafito-400">
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
                  <div className="p-2 rounded-sm bg-grafito-100">
                    <Route className="w-5 h-5 text-grafito-600" />
                  </div>
                  <div>
                    <p className="text-xs text-grafito-500 uppercase font-bold">Km Recorridos</p>
                    <p className="font-heading text-2xl font-bold text-grafito-900 font-mono">
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
                    <p className="text-xs text-grafito-500 uppercase font-bold">Costo / Km</p>
                    <p className="font-heading text-2xl font-bold text-grafito-900 font-mono">
                      {formatMoney(selectedTire.cost_per_km)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-sm bg-marca-50">
                    <TrendingDown className="w-5 h-5 text-marca-600" />
                  </div>
                  <div>
                    <p className="text-xs text-grafito-500 uppercase font-bold">Costo / mm</p>
                    <p className="font-heading text-2xl font-bold text-grafito-900 font-mono">
                      {formatMoney(selectedTire.cost_per_mm)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Projection */}
          <Card className="bg-white" data-testid="tire-projection">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Proyección de Vida de la Llanta
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProjection || loadingInspections ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="w-6 h-6 animate-spin text-marca-500" />
                </div>
              ) : !enoughForProjection || !projection ? (
                <div
                  className="text-center py-8 text-grafito-400"
                  data-testid="tire-projection-empty"
                >
                  <Hourglass className="w-10 h-10 mx-auto mb-2" />
                  <p>Se necesitan al menos 2 inspecciones para proyectar la vida de la llanta</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {projection.needs_review && (
                    <div
                      className="flex items-start gap-2 p-3 rounded-sm border bg-amber-50 border-amber-200 text-amber-700"
                      data-testid="tire-projection-review"
                    >
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <p className="text-xs">
                        La proyección requiere revisión: el desgaste medido es
                        insuficiente o inconsistente para una estimación confiable.
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-4 rounded-sm bg-grafito-50">
                      <div className="p-2 rounded-sm bg-marca-50">
                        <Hourglass className="w-5 h-5 text-marca-600" />
                      </div>
                      <div>
                        <p className="text-xs text-grafito-500 uppercase font-bold">Km Restantes</p>
                        <p
                          className="font-heading text-2xl font-bold text-grafito-900 font-mono"
                          data-testid="tire-projection-km"
                        >
                          {formatKm(projection.km_remaining)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-sm bg-grafito-50">
                      <div className="p-2 rounded-sm bg-grafito-100">
                        <CalendarClock className="w-5 h-5 text-grafito-600" />
                      </div>
                      <div>
                        <p className="text-xs text-grafito-500 uppercase font-bold">
                          Fecha Estimada de Cambio
                        </p>
                        <p
                          className="font-heading text-2xl font-bold text-grafito-900 font-mono"
                          data-testid="tire-projection-date"
                        >
                          {projection.estimated_change_date
                            ? formatDate(projection.estimated_change_date)
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-sm bg-grafito-50">
                      <div className="p-2 rounded-sm bg-red-50">
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-xs text-grafito-500 uppercase font-bold">
                          Tasa de Desgaste
                        </p>
                        <p
                          className="font-heading text-2xl font-bold text-grafito-900 font-mono"
                          data-testid="tire-projection-rate"
                        >
                          {wearRatePer1000 !== null
                            ? `${wearRatePer1000.toFixed(2)} mm/1000km`
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Depth chart */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Evolución de Profundidad (mm)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingInspections ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-6 h-6 animate-spin text-marca-500" />
                </div>
              ) : !hasDepth ? (
                <div className="text-center py-12 text-grafito-400" data-testid="tire-graphs-depth-empty">
                  <CircleDot className="w-12 h-12 mx-auto mb-2" />
                  <p>Sin inspecciones registradas para esta llanta</p>
                </div>
              ) : (
                <div className="w-full h-72" data-testid="tire-graphs-depth-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={depthChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e6e4e1" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#a19d97" />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="#a19d97"
                        domain={[0, 'auto']}
                        label={{ value: 'mm', angle: -90, position: 'insideLeft', fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          value === null || value === undefined ? '—' : `${value} mm`,
                          name,
                        ]}
                      />
                      <Legend />
                      <ReferenceLine
                        y={CRITICAL_DEPTH_MM}
                        stroke="#dc2626"
                        strokeDasharray="6 4"
                        label={{
                          value: `Umbral crítico (${CRITICAL_DEPTH_MM} mm)`,
                          position: 'insideTopRight',
                          fontSize: 11,
                          fill: '#dc2626',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="depth"
                        name="Profundidad mín. (mm)"
                        stroke="#e00000"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                      {hasProjectionLine && (
                        <Line
                          type="monotone"
                          dataKey="projected"
                          name="Proyección"
                          stroke="#a19d97"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      )}
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
                <CardTitle className="text-sm font-bold uppercase text-grafito-500 tracking-widest flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  Evolución de Presión (PSI)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-72" data-testid="tire-graphs-pressure-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e6e4e1" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#a19d97" />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="#a19d97"
                        label={{ value: 'PSI', angle: -90, position: 'insideLeft', fontSize: 12 }}
                      />
                      <Tooltip formatter={(value) => [`${value} PSI`, 'Presión']} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="pressure"
                        name="Presión (PSI)"
                        stroke="#55514c"
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
