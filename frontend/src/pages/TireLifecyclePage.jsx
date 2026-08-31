import React, { useState, useEffect } from 'react';
import { tiresApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  CircleDot,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Scissors,
  Trash2,
  Recycle,
  Layers,
  Gauge,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import EstadoVacio from '../components/EstadoVacio';

const today = () => new Date().toISOString().substring(0, 10);

// Life code (VN, R1, R2...) derived from life_number when cod_vida is absent.
const getLifeCode = (tire) => {
  if (tire?.cod_vida) return tire.cod_vida;
  const n = tire?.life_number || 1;
  return n === 1 ? 'VN' : `R${n - 1}`;
};

const TireLifecyclePage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tires, setTires] = useState([]);

  const [scrapPile, setScrapPile] = useState(null);
  const [scrapLoading, setScrapLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');

  const [saving, setSaving] = useState(false);
  const [selectedTire, setSelectedTire] = useState(null);

  const [showRetreadDialog, setShowRetreadDialog] = useState(false);
  const [showRegrooveDialog, setShowRegrooveDialog] = useState(false);
  const [showScrapDialog, setShowScrapDialog] = useState(false);

  const [retreadData, setRetreadData] = useState({
    band_brand: '',
    band_model: '',
    cost: '',
    odometer: '',
    date: today(),
  });

  const [regrooveData, setRegrooveData] = useState({
    cost: '',
    date: today(),
    notes: '',
  });

  const [scrapData, setScrapData] = useState({
    reason: '',
    date: today(),
    odometer: '',
  });

  const tireStatuses = [
    { value: 'nuevo', label: 'Nuevo', color: 'bg-green-100 text-green-700' },
    { value: 'en_uso', label: 'En Uso', color: 'bg-blue-100 text-blue-700' },
    { value: 'almacen', label: 'En Almacén', color: 'bg-slate-100 text-slate-700' },
    { value: 'reencauche', label: 'Reencauche', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'reparacion', label: 'En Reparación', color: 'bg-orange-100 text-orange-700' },
    { value: 'baja', label: 'Baja', color: 'bg-red-100 text-red-700' },
    { value: 'descartada', label: 'Descartada', color: 'bg-red-100 text-red-700' },
  ];

  const scrapReasons = [
    { value: 'desgaste_total', label: 'Desgaste total' },
    { value: 'dano_estructural', label: 'Daño estructural' },
    { value: 'pinchazo_irreparable', label: 'Pinchazo irreparable' },
    { value: 'otro', label: 'Otro' },
  ];

  const getStatusInfo = (status) =>
    tireStatuses.find((s) => s.value === status) || tireStatuses[2];

  // Tires already scrapped / end-of-life should not be actionable again.
  const isScrapped = (tire) =>
    tire.status === 'baja' || tire.status === 'descartada';

  const fetchTires = async () => {
    setLoading(true);
    try {
      const res = await tiresApi.getAll();
      setTires(res.data || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cargar llantas');
    }
    setLoading(false);
  };

  const fetchScrapPile = async () => {
    setScrapLoading(true);
    try {
      const res = await tiresApi.scrapPile();
      setScrapPile(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cargar pila de descarte');
    }
    setScrapLoading(false);
  };

  useEffect(() => {
    fetchTires();
    fetchScrapPile();
  }, []);

  const refetchAll = () => {
    fetchTires();
    fetchScrapPile();
  };

  const filteredTires = tires.filter(
    (tire) => statusFilter === 'all' || tire.status === statusFilter
  );

  // --- Action openers ---------------------------------------------------------
  const openRetread = (tire) => {
    setSelectedTire(tire);
    setRetreadData({
      band_brand: '',
      band_model: '',
      cost: '',
      odometer: tire.total_km || '',
      date: today(),
    });
    setShowRetreadDialog(true);
  };

  const openRegroove = (tire) => {
    setSelectedTire(tire);
    setRegrooveData({ cost: '', date: today(), notes: '' });
    setShowRegrooveDialog(true);
  };

  const openScrap = (tire) => {
    setSelectedTire(tire);
    setScrapData({ reason: '', date: today(), odometer: tire.total_km || '' });
    setShowScrapDialog(true);
  };

  // --- Action handlers --------------------------------------------------------
  const handleRetread = async () => {
    if (!selectedTire) return;
    if (!retreadData.band_brand) {
      toast.error('La marca de la banda es requerida');
      return;
    }
    setSaving(true);
    try {
      await tiresApi.retread(selectedTire.id, {
        band_brand: retreadData.band_brand,
        band_model: retreadData.band_model,
        cost: parseFloat(retreadData.cost) || 0,
        odometer: parseInt(retreadData.odometer) || 0,
        date: retreadData.date,
      });
      toast.success('Reencauche registrado');
      setShowRetreadDialog(false);
      setSelectedTire(null);
      refetchAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar reencauche');
    }
    setSaving(false);
  };

  const handleRegroove = async () => {
    if (!selectedTire) return;
    setSaving(true);
    try {
      await tiresApi.regroove(selectedTire.id, {
        cost: parseFloat(regrooveData.cost) || 0,
        date: regrooveData.date,
        notes: regrooveData.notes,
      });
      toast.success('Regrabado registrado');
      setShowRegrooveDialog(false);
      setSelectedTire(null);
      refetchAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar regrabado');
    }
    setSaving(false);
  };

  const handleScrap = async () => {
    if (!selectedTire) return;
    if (!scrapData.reason) {
      toast.error('El motivo de baja es requerido');
      return;
    }
    setSaving(true);
    try {
      await tiresApi.scrap(selectedTire.id, {
        reason: scrapData.reason,
        date: scrapData.date,
        odometer: parseInt(scrapData.odometer) || 0,
      });
      toast.success('Llanta dada de baja');
      setShowScrapDialog(false);
      setSelectedTire(null);
      refetchAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al dar de baja');
    }
    setSaving(false);
  };

  // Scrap-pile derived data (supports several possible backend shapes).
  const scrapItems = Array.isArray(scrapPile)
    ? scrapPile
    : scrapPile?.tires || scrapPile?.items || [];
  const scrapByReason = scrapPile?.by_reason || scrapPile?.groups_by_reason || null;
  const scrapByBrand = scrapPile?.by_brand || scrapPile?.groups_by_brand || null;
  const scrapAvgKm =
    scrapPile?.avg_km ?? scrapPile?.average_km ?? scrapPile?.km_promedio ?? null;

  const reasonLabel = (value) =>
    scrapReasons.find((r) => r.value === value)?.label || value || '-';

  const renderGroup = (groupObj) => {
    if (!groupObj) return null;
    const entries = Array.isArray(groupObj)
      ? groupObj.map((g) => [g.key ?? g.label ?? g.name, g.count ?? g.total ?? g.value])
      : Object.entries(groupObj);
    return entries;
  };

  return (
    <div className="space-y-6 page-fade-in" data-testid="tire-lifecycle-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            data-testid="back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver
          </Button>
          <div>
            <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
              Ciclo de Vida de Llantas
            </h1>
            <p className="text-slate-500 mt-1">
              Reencauche, regrabado, baja y análisis de la pila de descarte
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="btn-press"
          onClick={refetchAll}
          data-testid="refresh-btn"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-slate-100 rounded-sm">
          <TabsTrigger
            value="overview"
            className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide"
            data-testid="overview-tab"
          >
            Vista General
          </TabsTrigger>
          <TabsTrigger
            value="scrap-pile"
            className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide"
            data-testid="scrap-pile-tab"
          >
            Pila de Descarte
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          {/* Filter */}
          <Card className="bg-white mb-4">
            <CardContent className="py-4">
              <div className="flex flex-col md:flex-row gap-4 md:items-center">
                <Label className="input-label md:mb-0">Filtrar por estado</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[220px] rounded-sm" data-testid="status-filter">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {tireStatuses.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white section-enter">
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : filteredTires.length === 0 ? (
                // Dos vacios distintos, y el codigo ya sabe cual es cual sin
                // pedir nada mas al servidor: si `tires` viene vacio no hay
                // NINGUNA llanta registrada (esto es un reporte, no se crean
                // llantas aqui: se manda a la pagina que si las crea); si hay
                // llantas pero ninguna pasa el filtro, es un "sin resultados"
                // y ofrecer crear una seria justo lo contrario de lo que toca.
                tires.length === 0 ? (
                  <EstadoVacio
                    icono={CircleDot}
                    titulo="Aún no hay llantas registradas"
                    texto="Este reporte sigue el ciclo de vida de cada llanta: reencauche, regrabado y baja. Registra las llantas de tu flota y aparecerán aquí."
                    enlace={{ texto: 'Ir a Llantas', onClick: () => navigate('/tires') }}
                  />
                ) : (
                  <EstadoVacio
                    icono={CircleDot}
                    titulo="Sin resultados"
                    texto="Ninguna llanta coincide con el estado seleccionado. Prueba con «Todos los estados»."
                    filtrado
                  />
                )
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>Serial</TableHead>
                      <TableHead>Marca/Modelo</TableHead>
                      <TableHead>Dimensión</TableHead>
                      <TableHead>Cód. Vida</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Km Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTires.map((tire) => (
                      <TableRow key={tire.id} className="table-dense">
                        <TableCell className="font-mono font-bold">{tire.serial}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tire.brand}</p>
                            <p className="text-xs text-slate-500">{tire.model || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{tire.dimension}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getLifeCode(tire)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusInfo(tire.status).color}>
                            {getStatusInfo(tire.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell>{tire.total_km?.toLocaleString() || 0} km</TableCell>
                        <TableCell className="text-right">
                          {isScrapped(tire) ? (
                            <span className="text-xs text-slate-400">Fin de vida</span>
                          ) : (
                            <div className="flex justify-end gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRetread(tire)}
                                data-testid="retread-btn"
                                title="Reencauche"
                              >
                                <Recycle className="w-4 h-4 mr-1" />
                                Reencauche
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRegroove(tire)}
                                data-testid="regroove-btn"
                                title="Regrabado"
                              >
                                <Scissors className="w-4 h-4 mr-1" />
                                Regrabado
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openScrap(tire)}
                                data-testid="scrap-btn"
                                title="Dar de baja"
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Baja
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scrap Pile Tab */}
        <TabsContent value="scrap-pile" className="mt-4 space-y-4">
          {/* Analysis summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border-l-4 border-l-red-500">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                      Total Descartadas
                    </p>
                    <p className="font-heading text-3xl font-bold text-red-600 mt-1">
                      {scrapItems.length}
                    </p>
                  </div>
                  <Layers className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-l-4 border-l-slate-500">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                      Km Promedio
                    </p>
                    <p className="font-heading text-3xl font-bold text-slate-700 mt-1">
                      {scrapAvgKm != null
                        ? Number(scrapAvgKm).toLocaleString()
                        : '-'}
                    </p>
                  </div>
                  <Gauge className="w-8 h-8 text-slate-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-l-4 border-l-orange-500">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                      Motivos Distintos
                    </p>
                    <p className="font-heading text-3xl font-bold text-orange-600 mt-1">
                      {scrapByReason
                        ? (renderGroup(scrapByReason) || []).length
                        : '-'}
                    </p>
                  </div>
                  <CircleDot className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grouping cards */}
          {(scrapByReason || scrapByBrand) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scrapByReason && (
                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-lg uppercase tracking-wide">
                      Por Motivo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(renderGroup(scrapByReason) || []).map(([key, count]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{reasonLabel(key)}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {scrapByBrand && (
                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-lg uppercase tracking-wide">
                      Por Marca
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(renderGroup(scrapByBrand) || []).map(([key, count]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{key || '-'}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Scrapped tires table */}
          <Card className="bg-white">
            <CardContent className="p-0 overflow-x-auto">
              {scrapLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : scrapItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <Layers className="w-12 h-12 mb-2" />
                  <p>No hay llantas en la pila de descarte</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>Serial</TableHead>
                      <TableHead>Marca/Modelo</TableHead>
                      <TableHead>Dimensión</TableHead>
                      <TableHead>Cód. Vida</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Km Total</TableHead>
                      <TableHead>Fecha Baja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scrapItems.map((tire) => (
                      <TableRow key={tire.id || tire.serial} className="table-dense">
                        <TableCell className="font-mono font-bold">
                          {tire.serial}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tire.brand}</p>
                            <p className="text-xs text-slate-500">{tire.model || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{tire.dimension || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getLifeCode(tire)}</Badge>
                        </TableCell>
                        <TableCell>
                          {reasonLabel(tire.scrap_reason || tire.reason)}
                        </TableCell>
                        <TableCell>
                          {tire.total_km?.toLocaleString() || 0} km
                        </TableCell>
                        <TableCell>
                          {(tire.scrap_date || tire.date || '').substring(0, 10) || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Retread Dialog */}
      <Dialog open={showRetreadDialog} onOpenChange={setShowRetreadDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Reencauche
            </DialogTitle>
          </DialogHeader>
          {selectedTire && (
            <div className="p-3 bg-slate-50 rounded-sm text-sm">
              <p className="text-slate-500">Llanta:</p>
              <p className="font-mono font-bold">{selectedTire.serial}</p>
              <p className="text-slate-500">
                {selectedTire.brand} {selectedTire.dimension} · {getLifeCode(selectedTire)}
              </p>
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Marca de Banda *</Label>
                <Input
                  value={retreadData.band_brand}
                  onChange={(e) =>
                    setRetreadData({ ...retreadData, band_brand: e.target.value })
                  }
                  className="rounded-sm"
                  placeholder="Bandag, Marangoni..."
                  data-testid="retread-band-brand-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Modelo de Banda</Label>
                <Input
                  value={retreadData.band_model}
                  onChange={(e) =>
                    setRetreadData({ ...retreadData, band_model: e.target.value })
                  }
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Costo (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={retreadData.cost}
                  onChange={(e) =>
                    setRetreadData({ ...retreadData, cost: e.target.value })
                  }
                  className="rounded-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Odómetro (km)</Label>
                <Input
                  type="number"
                  value={retreadData.odometer}
                  onChange={(e) =>
                    setRetreadData({ ...retreadData, odometer: e.target.value })
                  }
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Fecha</Label>
              <Input
                type="date"
                value={retreadData.date}
                onChange={(e) =>
                  setRetreadData({ ...retreadData, date: e.target.value })
                }
                className="rounded-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetreadDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action btn-press"
              onClick={handleRetread}
              disabled={!retreadData.band_brand || saving}
              data-testid="confirm-retread-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Reencauche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regroove Dialog */}
      <Dialog open={showRegrooveDialog} onOpenChange={setShowRegrooveDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Regrabado / Reesculturar
            </DialogTitle>
          </DialogHeader>
          {selectedTire && (
            <div className="p-3 bg-slate-50 rounded-sm text-sm">
              <p className="text-slate-500">Llanta:</p>
              <p className="font-mono font-bold">{selectedTire.serial}</p>
              <p className="text-slate-500">
                {selectedTire.brand} {selectedTire.dimension} · {getLifeCode(selectedTire)}
              </p>
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Costo (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={regrooveData.cost}
                  onChange={(e) =>
                    setRegrooveData({ ...regrooveData, cost: e.target.value })
                  }
                  className="rounded-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Fecha</Label>
                <Input
                  type="date"
                  value={regrooveData.date}
                  onChange={(e) =>
                    setRegrooveData({ ...regrooveData, date: e.target.value })
                  }
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Notas</Label>
              <Input
                value={regrooveData.notes}
                onChange={(e) =>
                  setRegrooveData({ ...regrooveData, notes: e.target.value })
                }
                className="rounded-sm"
                placeholder="Observaciones del reesculturado"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegrooveDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action btn-press"
              onClick={handleRegroove}
              disabled={saving}
              data-testid="confirm-regroove-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Regrabado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scrap Dialog */}
      <Dialog open={showScrapDialog} onOpenChange={setShowScrapDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Baja / Fin de Vida
            </DialogTitle>
          </DialogHeader>
          {selectedTire && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-sm text-sm">
              <p className="text-red-700">
                Se dará de baja la llanta <strong>{selectedTire.serial}</strong> (
                {getLifeCode(selectedTire)}). Esta acción marca el fin de vida útil.
              </p>
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="input-label">Motivo *</Label>
              <Select
                value={scrapData.reason}
                onValueChange={(v) => setScrapData({ ...scrapData, reason: v })}
              >
                <SelectTrigger className="rounded-sm" data-testid="scrap-reason-select">
                  <SelectValue placeholder="Seleccionar motivo" />
                </SelectTrigger>
                <SelectContent>
                  {scrapReasons.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Odómetro (km)</Label>
                <Input
                  type="number"
                  value={scrapData.odometer}
                  onChange={(e) =>
                    setScrapData({ ...scrapData, odometer: e.target.value })
                  }
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Fecha</Label>
                <Input
                  type="date"
                  value={scrapData.date}
                  onChange={(e) =>
                    setScrapData({ ...scrapData, date: e.target.value })
                  }
                  className="rounded-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScrapDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action btn-press bg-red-600 hover:bg-red-700"
              onClick={handleScrap}
              disabled={!scrapData.reason || saving}
              data-testid="confirm-scrap-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Dar de Baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TireLifecyclePage;
