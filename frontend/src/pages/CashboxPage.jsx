import React, { useState, useEffect, useCallback } from 'react';
import { cashboxApi } from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  PiggyBank,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Search,
  FileSpreadsheet,
  Pencil,
  Trash2,
  BookOpen,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import EstadoVacio from '../components/EstadoVacio';

const CATEGORIES = [
  { value: 'combustible', label: 'Combustible' },
  { value: 'peajes', label: 'Peajes' },
  { value: 'viaticos', label: 'Viáticos' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'planilla', label: 'Planilla' },
  { value: 'cobranza', label: 'Cobranza' },
  { value: 'aporte', label: 'Aporte' },
  { value: 'retiro', label: 'Retiro' },
  { value: 'otros', label: 'Otros' },
];

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'deposito', label: 'Depósito' },
  { value: 'yape_plin', label: 'Yape / Plin' },
  { value: 'otro', label: 'Otro' },
];

const categoryLabel = (value) =>
  CATEGORIES.find((c) => c.value === value)?.label || value || '-';
const methodLabel = (value) =>
  PAYMENT_METHODS.find((m) => m.value === value)?.label || value || '-';

const soles = (value) =>
  `S/ ${(Number(value) || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const localDate = (value) => {
  if (!value) return '-';
  const raw = String(value).substring(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('es-PE');
};

const today = () => new Date().toISOString().substring(0, 10);

const emptyMovement = {
  date: '',
  type: 'ingreso',
  concept: '',
  category: 'otros',
  amount: '',
  payment_method: 'efectivo',
  reference: '',
  notes: '',
};

const exportCsv = (filename, headers, rows) => {
  if (!rows || rows.length === 0) {
    toast.error('No hay datos para exportar');
    return;
  }
  const escape = (val) => {
    const s = val === null || val === undefined ? '' : String(val);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(';'), ...rows.map((r) => r.map(escape).join(';'))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  toast.success('CSV descargado exitosamente');
};

const CashboxPage = () => {
  const [activeTab, setActiveTab] = useState('movements');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Datos
  const [movements, setMovements] = useState([]);
  const [balance, setBalance] = useState(null);
  const [kardex, setKardex] = useState(null);
  const [byCategory, setByCategory] = useState(null);

  // Filtros
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Diálogos
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [formData, setFormData] = useState(emptyMovement);

  const buildParams = useCallback(() => {
    const params = {};
    if (typeFilter !== 'all') params.type = typeFilter;
    if (categoryFilter !== 'all') params.category = categoryFilter;
    if (methodFilter !== 'all') params.payment_method = methodFilter;
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    return params;
  }, [typeFilter, categoryFilter, methodFilter, fromDate, toDate]);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    const params = buildParams();
    try {
      const res = await cashboxApi.getMovements(params);
      setMovements(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch (error) {
      setMovements([]);
      toast.error(error.response?.data?.detail || 'Error al cargar los movimientos de caja');
    }
    try {
      const res = await cashboxApi.getBalance(params);
      setBalance(res.data || null);
    } catch (error) {
      setBalance(null);
    }
    setLoading(false);
  }, [buildParams]);

  const fetchKardex = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await cashboxApi.getKardex(params);
      setKardex(res.data || {});
    } catch (error) {
      setKardex({});
      toast.error(error.response?.data?.detail || 'Error al cargar el kardex de caja');
    }
    setLoading(false);
  }, [fromDate, toDate]);

  const fetchByCategory = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await cashboxApi.getReportByCategory(params);
      setByCategory(res.data || {});
    } catch (error) {
      setByCategory({});
      toast.error(error.response?.data?.detail || 'Error al cargar el reporte por rubro');
    }
    setLoading(false);
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    if (activeTab === 'movements') fetchMovements();
    else if (activeTab === 'kardex') fetchKardex();
    else fetchByCategory();
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'kardex' && !kardex) fetchKardex();
    if (tab === 'by_category' && !byCategory) fetchByCategory();
  };

  // --- Totales ---
  const localIncome = movements
    .filter((m) => m.type === 'ingreso')
    .reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
  const localExpense = movements
    .filter((m) => m.type === 'egreso')
    .reduce((acc, m) => acc + (Number(m.amount) || 0), 0);

  const totalIncome = balance?.total_income ?? balance?.total_ingresos ?? localIncome;
  const totalExpense = balance?.total_expense ?? balance?.total_egresos ?? localExpense;
  const currentBalance = balance?.balance ?? balance?.saldo ?? (totalIncome - totalExpense);

  // --- CRUD ---
  const openCreate = (type) => {
    setEditingId(null);
    setFormData({ ...emptyMovement, type, date: today() });
    setShowFormDialog(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setFormData({
      date: (row.date || '').substring(0, 10),
      type: row.type || 'ingreso',
      concept: row.concept || '',
      category: row.category || 'otros',
      amount: row.amount ?? '',
      payment_method: row.payment_method || 'efectivo',
      reference: row.reference || '',
      notes: row.notes || '',
    });
    setShowFormDialog(true);
  };

  const handleSave = async () => {
    if (!formData.date || !formData.concept || !formData.amount) {
      toast.error('Fecha, concepto y monto son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...formData, amount: Number(formData.amount) || 0 };
      if (editingId) {
        await cashboxApi.updateMovement(editingId, payload);
        toast.success('Movimiento actualizado');
      } else {
        await cashboxApi.createMovement(payload);
        toast.success('Movimiento registrado');
      }
      setShowFormDialog(false);
      setEditingId(null);
      fetchMovements();
      if (kardex) fetchKardex();
      if (byCategory) fetchByCategory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar el movimiento');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await cashboxApi.deleteMovement(selected.id);
      toast.success('Movimiento eliminado');
      setShowDeleteDialog(false);
      setSelected(null);
      fetchMovements();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar el movimiento');
    }
    setSaving(false);
  };

  const typeBadge = (type) =>
    type === 'egreso' ? (
      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Egreso</Badge>
    ) : (
      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Ingreso</Badge>
    );

  /* Un solo menu de acciones para la tabla (escritorio) y las tarjetas (movil), igual que AccionesViaje en TripsPage: una accion nueva aparece en ambas vistas o en ninguna. */
  const AccionesMovimiento = ({ movimiento }) => (
    <div className="whitespace-nowrap">
      <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(movimiento)}>
        <Pencil className="w-4 h-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-red-600"
        title="Eliminar"
        onClick={() => { setSelected(movimiento); setShowDeleteDialog(true); }}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  /* Los movimientos llegan ya filtrados por el servidor: sin filtros activos,
     una lista vacia es una caja recien estrenada, no una busqueda fallida. */
  const hayFiltrosCaja =
    typeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    methodFilter !== 'all' ||
    !!fromDate ||
    !!toDate;

  // --- Kardex derivado ---
  const kardexRows = kardex?.rows || kardex?.movements || kardex?.items || [];
  const openingBalance = kardex?.opening_balance ?? kardex?.saldo_inicial ?? 0;
  const closingBalance =
    kardex?.closing_balance ??
    kardex?.saldo_final ??
    (kardexRows.length > 0
      ? kardexRows[kardexRows.length - 1].running_balance ??
        kardexRows[kardexRows.length - 1].balance ??
        0
      : openingBalance);

  const kardexRowBalance = (row, index) => {
    if (row.running_balance !== undefined) return Number(row.running_balance) || 0;
    if (row.balance !== undefined) return Number(row.balance) || 0;
    // Fallback: acumula en cliente si el backend no envía el saldo.
    let acc = Number(openingBalance) || 0;
    for (let i = 0; i <= index; i += 1) {
      const r = kardexRows[i];
      acc += Number(r.income ?? (r.type === 'ingreso' ? r.amount : 0)) || 0;
      acc -= Number(r.expense ?? (r.type === 'egreso' ? r.amount : 0)) || 0;
    }
    return acc;
  };

  // --- Por rubro derivado ---
  const categoryRows = byCategory?.rows || byCategory?.categories || byCategory?.items || [];
  const chartData = categoryRows.map((r) => ({
    category: categoryLabel(r.category),
    ingresos: Number(r.income ?? r.ingresos) || 0,
    egresos: Number(r.expense ?? r.egresos) || 0,
  }));

  return (
    <div className="space-y-6 page-fade-in" data-testid="cashbox-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Caja
          </h1>
          <p className="text-slate-500 mt-1">
            Control de ingresos y egresos, kardex de caja y análisis por rubro
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-green-600 text-green-700 hover:bg-green-50"
            onClick={() => openCreate('ingreso')}
            data-testid="new-income-btn"
          >
            <ArrowDownCircle className="w-4 h-4 mr-2" />
            Nuevo Ingreso
          </Button>
          <Button
            variant="outline"
            className="border-red-600 text-red-700 hover:bg-red-50"
            onClick={() => openCreate('egreso')}
            data-testid="new-expense-btn"
          >
            <ArrowUpCircle className="w-4 h-4 mr-2" />
            Nuevo Egreso
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-l-4 border-l-green-500" data-testid="stat-income">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total Ingresos</p>
              <ArrowDownCircle className="w-4 h-4 text-green-600" />
            </div>
            <p className="font-heading text-2xl font-bold text-green-600 mt-1">{soles(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-red-500" data-testid="stat-expense">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total Egresos</p>
              <ArrowUpCircle className="w-4 h-4 text-red-600" />
            </div>
            <p className="font-heading text-2xl font-bold text-red-600 mt-1">{soles(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-orange-500" data-testid="stat-balance">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Saldo</p>
              <Wallet className="w-4 h-4 text-orange-600" />
            </div>
            <p className={`font-heading text-2xl font-bold mt-1 ${(Number(currentBalance) || 0) >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
              {soles(currentBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="bg-slate-100 rounded-sm">
          <TabsTrigger value="movements" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide" data-testid="tab-movements">
            <PiggyBank className="w-4 h-4 mr-2" />
            Movimientos
          </TabsTrigger>
          <TabsTrigger value="kardex" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide" data-testid="tab-kardex">
            <BookOpen className="w-4 h-4 mr-2" />
            Kardex
          </TabsTrigger>
          <TabsTrigger value="by_category" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide" data-testid="tab-by-category">
            <BarChart3 className="w-4 h-4 mr-2" />
            Por Rubro
          </TabsTrigger>
        </TabsList>

        {/* Filtros comunes */}
        <Card className="bg-white mt-4 section-enter">
          <CardContent className="py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4">
              {activeTab === 'movements' && (
                <>
                  <div className="space-y-2">
                    <Label className="input-label">Tipo</Label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="rounded-sm" data-testid="filter-type">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="ingreso">Ingreso</SelectItem>
                        <SelectItem value="egreso">Egreso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="input-label">Rubro</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="rounded-sm" data-testid="filter-category">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="input-label">Método</Label>
                    <Select value={methodFilter} onValueChange={setMethodFilter}>
                      <SelectTrigger className="rounded-sm" data-testid="filter-method">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label className="input-label">Desde</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-sm" data-testid="filter-from" />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Hasta</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-sm" data-testid="filter-to" />
              </div>
              <div className="flex items-end">
                <Button className="btn-action btn-press" onClick={handleSearch} disabled={loading} data-testid="filter-apply-btn">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Buscar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* --- Movimientos --- */}
        <TabsContent value="movements" className="mt-4">
          <Card className="bg-white section-enter">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Movimientos de Caja
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                data-testid="movements-export-btn"
                onClick={() =>
                  exportCsv(
                    'caja_movimientos.csv',
                    ['N°', 'Fecha', 'Concepto', 'Rubro', 'Tipo', 'Método', 'Referencia', 'Monto'],
                    movements.map((m, i) => [
                      m.number ?? m.correlative ?? i + 1,
                      (m.date || '').substring(0, 10),
                      m.concept || '',
                      categoryLabel(m.category),
                      m.type || '',
                      methodLabel(m.payment_method),
                      m.reference || '',
                      Number(m.amount) || 0,
                    ])
                  )
                }
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : movements.length === 0 ? (
                hayFiltrosCaja ? (
                  <EstadoVacio
                    icono={PiggyBank}
                    titulo="Sin resultados"
                    texto="Ningún movimiento de caja coincide con los filtros seleccionados."
                    filtrado
                  />
                ) : (
                  <EstadoVacio
                    icono={PiggyBank}
                    titulo="Registra tu primer movimiento de caja"
                    texto="Cada ingreso o egreso que anotes alimenta el kardex y el análisis por rubro."
                    accion={{ texto: 'Nuevo ingreso', onClick: () => openCreate('ingreso') }}
                  />
                )
              ) : (
                <>
                {/* Movil: tarjetas. Nueve columnas en 375px esconden estado y acciones tras un arrastre lateral que nadie descubre. */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {movements.map((m, i) => (
                    <div key={m.id || i} className="flex items-start gap-3 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{m.concept || '-'}</span>
                          {typeBadge(m.type)}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {categoryLabel(m.category)} · {methodLabel(m.payment_method)}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          <span>{localDate(m.date)}</span>
                          <span className={`font-bold ${m.type === 'egreso' ? 'text-red-600' : 'text-green-600'}`}>
                            {m.type === 'egreso' ? '-' : '+'} {soles(m.amount)}
                          </span>
                          {m.reference && <span className="font-mono">{m.reference}</span>}
                        </p>
                      </div>
                      <AccionesMovimiento movimiento={m} />
                    </div>
                  ))}
                </div>

                {/* Escritorio: la tabla de siempre */}
                <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>N°</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Rubro</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m, i) => (
                      <TableRow key={m.id || i} className="table-dense" data-testid={`movement-row-${m.id || i}`}>
                        <TableCell className="font-mono text-xs">{m.number ?? m.correlative ?? i + 1}</TableCell>
                        <TableCell>{localDate(m.date)}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{m.concept || '-'}</TableCell>
                        <TableCell>{categoryLabel(m.category)}</TableCell>
                        <TableCell>{typeBadge(m.type)}</TableCell>
                        <TableCell>{methodLabel(m.payment_method)}</TableCell>
                        <TableCell className="font-mono text-xs">{m.reference || '-'}</TableCell>
                        <TableCell className={`font-bold ${m.type === 'egreso' ? 'text-red-600' : 'text-green-600'}`}>
                          {m.type === 'egreso' ? '-' : '+'} {soles(m.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <AccionesMovimiento movimiento={m} />
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
        </TabsContent>

        {/* --- Kardex --- */}
        <TabsContent value="kardex" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Card className="bg-white border-l-4 border-l-slate-500" data-testid="stat-opening-balance">
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Saldo Inicial</p>
                <p className="font-heading text-2xl font-bold text-slate-700 mt-1">{soles(openingBalance)}</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-l-4 border-l-orange-500" data-testid="stat-closing-balance">
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Saldo Final</p>
                <p className={`font-heading text-2xl font-bold mt-1 ${(Number(closingBalance) || 0) >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                  {soles(closingBalance)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white section-enter">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Kardex de Caja
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                data-testid="kardex-export-btn"
                onClick={() =>
                  exportCsv(
                    'caja_kardex.csv',
                    ['Fecha', 'N°', 'Concepto', 'Rubro', 'Ingreso', 'Egreso', 'Saldo'],
                    kardexRows.map((r, i) => [
                      (r.date || '').substring(0, 10),
                      r.number ?? r.correlative ?? i + 1,
                      r.concept || '',
                      categoryLabel(r.category),
                      Number(r.income ?? (r.type === 'ingreso' ? r.amount : 0)) || 0,
                      Number(r.expense ?? (r.type === 'egreso' ? r.amount : 0)) || 0,
                      kardexRowBalance(r, i),
                    ])
                  )
                }
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="table-dense">
                    <TableHead>Fecha</TableHead>
                    <TableHead>N°</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Rubro</TableHead>
                    <TableHead>Ingreso</TableHead>
                    <TableHead>Egreso</TableHead>
                    <TableHead>Saldo Acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                        <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : kardexRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                        <BookOpen className="w-10 h-10 mx-auto mb-3" />
                        <p>No hay movimientos en el periodo seleccionado</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    kardexRows.map((r, i) => {
                      const income = Number(r.income ?? (r.type === 'ingreso' ? r.amount : 0)) || 0;
                      const expense = Number(r.expense ?? (r.type === 'egreso' ? r.amount : 0)) || 0;
                      const running = kardexRowBalance(r, i);
                      return (
                        <TableRow key={r.id || i} className="table-dense">
                          <TableCell>{localDate(r.date)}</TableCell>
                          <TableCell className="font-mono text-xs">{r.number ?? r.correlative ?? i + 1}</TableCell>
                          <TableCell className="max-w-[240px] truncate">{r.concept || '-'}</TableCell>
                          <TableCell>{categoryLabel(r.category)}</TableCell>
                          <TableCell className="text-green-600">{income ? soles(income) : '-'}</TableCell>
                          <TableCell className="text-red-600">{expense ? soles(expense) : '-'}</TableCell>
                          <TableCell className={`font-bold ${running >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                            {soles(running)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Por Rubro --- */}
        <TabsContent value="by_category" className="mt-4">
          {categoryRows.length > 0 && (
            <Card className="bg-white section-enter mb-4">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                  Ingresos vs Egresos por Rubro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip formatter={(v) => soles(v)} />
                      <Legend />
                      <Bar dataKey="ingresos" fill="#16a34a" radius={[4, 4, 0, 0]} name="Ingresos" />
                      <Bar dataKey="egresos" fill="#dc2626" radius={[4, 4, 0, 0]} name="Egresos" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white section-enter">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
                Consolidado por Rubro
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                data-testid="by-category-export-btn"
                onClick={() =>
                  exportCsv(
                    'caja_por_rubro.csv',
                    ['Rubro', 'Ingresos', 'Egresos', 'Neto', 'N° Movimientos'],
                    categoryRows.map((r) => {
                      const income = Number(r.income ?? r.ingresos) || 0;
                      const expense = Number(r.expense ?? r.egresos) || 0;
                      return [
                        categoryLabel(r.category),
                        income,
                        expense,
                        Number(r.net ?? r.neto ?? income - expense) || 0,
                        r.count ?? r.movements_count ?? '',
                      ];
                    })
                  )
                }
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="table-dense">
                    <TableHead>Rubro</TableHead>
                    <TableHead>Ingresos</TableHead>
                    <TableHead>Egresos</TableHead>
                    <TableHead>Neto</TableHead>
                    <TableHead>N° Movimientos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                        <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : categoryRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                        <BarChart3 className="w-10 h-10 mx-auto mb-3" />
                        <p>No hay datos por rubro para el periodo seleccionado</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    categoryRows.map((r, i) => {
                      const income = Number(r.income ?? r.ingresos) || 0;
                      const expense = Number(r.expense ?? r.egresos) || 0;
                      const net = Number(r.net ?? r.neto ?? income - expense) || 0;
                      return (
                        <TableRow key={r.category || i} className="table-dense">
                          <TableCell className="font-medium">{categoryLabel(r.category)}</TableCell>
                          <TableCell className="text-green-600">{soles(income)}</TableCell>
                          <TableCell className="text-red-600">{soles(expense)}</TableCell>
                          <TableCell className={`font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {soles(net)}
                          </TableCell>
                          <TableCell>{r.count ?? r.movements_count ?? '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo crear/editar movimiento */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {editingId
                ? 'Editar Movimiento'
                : formData.type === 'egreso'
                ? 'Nuevo Egreso'
                : 'Nuevo Ingreso'}
            </DialogTitle>
            <DialogDescription>
              Registre el movimiento de caja con su rubro y método de pago.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Fecha *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="rounded-sm"
                  data-testid="form-date"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Tipo *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger className="rounded-sm" data-testid="form-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Monto (S/) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="rounded-sm"
                  data-testid="form-amount"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="input-label">Concepto *</Label>
              <Input
                value={formData.concept}
                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                placeholder="Ej: Pago de peajes ruta Lima - Arequipa"
                className="rounded-sm"
                data-testid="form-concept"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Rubro</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="rounded-sm" data-testid="form-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Método de Pago</Label>
                <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                  <SelectTrigger className="rounded-sm" data-testid="form-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Referencia</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="N° operación / voucher"
                  className="rounded-sm"
                  data-testid="form-reference"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="input-label">Observaciones</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="rounded-sm"
                data-testid="form-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>Cancelar</Button>
            <Button className="btn-action" onClick={handleSave} disabled={saving} data-testid="form-save-btn">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? 'Guardar Cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo eliminar */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Eliminar Movimiento
            </DialogTitle>
            <DialogDescription>
              {selected ? `"${selected.concept || 'Movimiento'}" · ${soles(selected.amount)}. ` : ''}
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashboxPage;
