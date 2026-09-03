import React, { useState, useEffect, useRef, useCallback } from 'react';
import api, { tripsApi } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Camera,
  Upload,
  X,
  Loader2,
  Receipt,
  Plus,
  Wallet,
  TrendingDown,
  CalendarDays,
  ImageIcon,
  ArrowLeft,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Viáticos por viaje (regla de negocio): S/ 540 por viaje
const VIATICO_POR_VIAJE = 540;
const API_ORIGIN = process.env.REACT_APP_BACKEND_URL || '';
// Resuelve URLs relativas de /uploads contra el backend; deja pasar base64 y absolutas
const resolvePhoto = (u) => (u && typeof u === 'string' && u.startsWith('/uploads') ? `${API_ORIGIN}${u}` : u);

const expenseCategories = [
  { value: 'alimentacion', label: 'Alimentación', icon: '🍽️' },
  { value: 'hospedaje', label: 'Hospedaje', icon: '🏨' },
  { value: 'movilidad', label: 'Movilidad', icon: '🚕' },
  { value: 'peajes', label: 'Peajes', icon: '🛣️' },
  { value: 'parqueo', label: 'Parqueo', icon: '🅿️' },
  { value: 'combustible', label: 'Combustible', icon: '⛽' },
  { value: 'balanza', label: 'Ticket Balanza', icon: '⚖️' },
  { value: 'otros', label: 'Otros', icon: '📦' },
];

const DriverExpensesPage = () => {
  const { user } = useAuth();
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [viatico, setViatico] = useState(null);
  const [photoViewer, setPhotoViewer] = useState({ open: false, url: '' });

  const [form, setForm] = useState({
    category: 'alimentacion',
    description: '',
    amount: '',
    provider: '',
    ruc: '',
  });

  const fetchActiveTrip = useCallback(async () => {
    setLoading(true);
    try {
      const tripsRes = await tripsApi.getAll();
      // Find active trip for this driver
      const active = tripsRes.data.find(
        (t) => t.driver_id === user?.id && (t.status === 'en_curso' || t.status === 'programado')
      );
      if (active) {
        setActiveTrip(active);
        // Fetch expenses for this trip
        const expRes = await api.get(`/trips/${active.id}/expenses`);
        setExpenses(expRes.data || []);
        // Estado de viáticos (saldo vs 540/viaje)
        try {
          const vRes = await tripsApi.getViaticoStatus(active.id);
          setViatico(vRes.data);
        } catch (e) {
          setViatico(null);
        }
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
    setLoading(false);
  }, [user?.id]);

  // Sigue siendo una unica carga al montar: la sesion ya esta resuelta cuando
  // esta pantalla aparece (ProtectedRoute espera a AuthContext), asi que
  // user.id no cambia mientras la pagina vive.
  useEffect(() => {
    fetchActiveTrip();
  }, [fetchActiveTrip]);

  // Camera / Photo handling
  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      setCapturedPhoto(base64Data);
      setPhotoPreview(base64Data);

      // OCR opcional: autollenar el monto desde la foto (best-effort)
      setScanning(true);
      try {
        const ocrRes = await api.post('/fuel/ocr', { image_base64: base64Data });
        if (ocrRes.data?.success && ocrRes.data.extracted_data) {
          const ex = ocrRes.data.extracted_data;
          const monto = ex.total_amount ?? ex.amount;
          setForm((prev) => ({
            ...prev,
            amount: prev.amount || (monto != null ? monto.toString() : prev.amount),
            provider: prev.provider || ex.provider || prev.provider,
            ruc: prev.ruc || ex.ruc || prev.ruc,
          }));
          if (monto != null) toast.success('Monto detectado del comprobante');
        }
      } catch (e) {
        // OCR no disponible: continuar sin autollenado
      }
      setScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setCapturedPhoto(null);
    setPhotoPreview(null);
  };

  const handleSubmitExpense = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    if (!activeTrip) {
      toast.error('No tienes viaje activo');
      return;
    }

    setSaving(true);
    try {
      let receiptUrl = null;

      // Upload photo if captured
      if (capturedPhoto) {
        const uploadRes = await api.post('/upload/base64', {
          data: capturedPhoto,
          entity_type: 'expenses',
          entity_id: activeTrip.id,
        });
        receiptUrl = uploadRes.data.url;
      }

      // Create expense
      await api.post(`/trips/${activeTrip.id}/expenses`, {
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        provider: form.provider,
        ruc: form.ruc,
        receipt_url: receiptUrl,
      });

      toast.success('Gasto registrado exitosamente');
      setShowAddDialog(false);
      setForm({ category: 'alimentacion', description: '', amount: '', provider: '', ruc: '' });
      setCapturedPhoto(null);
      setPhotoPreview(null);
      fetchActiveTrip();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar gasto');
    }
    setSaving(false);
  };

  // Budget calculations
  const dailyBudget = activeTrip?.viatico_daily || 0;
  const totalBudget = activeTrip?.viatico_budget || 0;
  const totalDays = activeTrip?.viatico_days || 1;
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const remaining = totalBudget - totalExpenses;
  const todayExpenses = expenses
    .filter((e) => {
      const d = new Date(e.expense_date || e.created_at);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    })
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const todayRemaining = dailyBudget - todayExpenses;

  // Estado de viáticos contra 540/viaje: usa el endpoint si respondió, si no cálculo local
  const viaticoRemaining = viatico?.remaining ?? (totalBudget ? remaining : null);
  const viaticoAlert = viatico?.alert ?? (viaticoRemaining != null && viaticoRemaining < VIATICO_POR_VIAJE);

  const openReceipt = (url) => setPhotoViewer({ open: true, url: resolvePhoto(url) });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-marca-500" />
      </div>
    );
  }

  if (!activeTrip) {
    return (
      <div className="flex flex-col items-center justify-center h-96 px-4 text-center">
        <Receipt className="w-16 h-16 text-grafito-300 mb-4" />
        <h2 className="text-xl font-bold text-grafito-600">Sin viaje activo</h2>
        <p className="text-grafito-400 mt-2">
          No tienes ningún viaje en curso o programado para registrar gastos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Trip Info */}
      <Card className="bg-gradient-to-r from-grafito-800 to-grafito-900 text-white border-0">
        <CardContent className="py-4">
          <p className="text-xs uppercase tracking-widest text-grafito-400">Viaje Activo</p>
          <p className="font-bold text-lg mt-1">{activeTrip.client_name || 'Sin cliente'}</p>
          <p className="text-sm text-grafito-300">{activeTrip.cargo_description || ''}</p>
          <div className="flex gap-4 mt-3 text-sm">
            <Badge variant="outline" className="border-marca-500 text-marca-400">
              {activeTrip.status === 'en_curso' ? 'En Curso' : 'Programado'}
            </Badge>
            <span className="text-grafito-400">
              {format(new Date(activeTrip.scheduled_date), 'dd MMM yyyy', { locale: es })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Alerta de saldo de viáticos (< 1 viaje) */}
      {viaticoRemaining != null && (
        <Card
          data-testid="expenses-viatico-status"
          className={viaticoAlert ? 'border-red-300 bg-red-50' : 'border-emerald-200 bg-emerald-50'}
        >
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-grafito-500 font-bold">Saldo de Viáticos</p>
              <p className={`text-xl font-bold ${viaticoAlert ? 'text-red-600' : 'text-emerald-700'}`}>
                S/ {viaticoRemaining.toFixed(2)}
              </p>
            </div>
            {viaticoAlert && (
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-semibold text-right">
                  Saldo menor a 1 viaje (S/ {VIATICO_POR_VIAJE})
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Budget Summary */}
      {dailyBudget > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="py-3">
              <p className="text-[10px] uppercase tracking-widest text-grafito-500 font-bold">Viático/Día</p>
              <p className="font-heading text-xl font-bold num text-green-700">S/ {dailyBudget.toFixed(2)}</p>
              <p className="text-[10px] text-grafito-400">{totalDays} días / S/ {totalBudget.toFixed(0)} total</p>
            </CardContent>
          </Card>
          <Card className={todayRemaining >= 0 ? '' : 'border-red-300'}>
            <CardContent className="py-3">
              <p className="text-[10px] uppercase tracking-widest text-grafito-500 font-bold">Saldo Hoy</p>
              <p className={`font-heading text-xl font-bold num ${todayRemaining >= 0 ? 'text-grafito-900' : 'text-red-600'}`}>
                S/ {todayRemaining.toFixed(2)}
              </p>
              <p className="text-[10px] text-grafito-400">Gastado hoy: S/ {todayExpenses.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-[10px] uppercase tracking-widest text-grafito-500 font-bold">Total Gastado</p>
              <p className="font-heading text-xl font-bold num text-grafito-900">S/ {totalExpenses.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className={remaining >= 0 ? '' : 'border-red-300'}>
            <CardContent className="py-3">
              <p className="text-[10px] uppercase tracking-widest text-grafito-500 font-bold">Saldo Total</p>
              <p className={`font-heading text-xl font-bold num ${remaining >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                S/ {remaining.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress bar */}
      {totalBudget > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-grafito-500">Presupuesto usado</span>
              <span className="font-bold">{Math.min(100, Math.round((totalExpenses / totalBudget) * 100))}%</span>
            </div>
            <div className="w-full bg-grafito-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  (totalExpenses / totalBudget) > 0.9 ? 'bg-red-500' :
                  (totalExpenses / totalBudget) > 0.7 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, (totalExpenses / totalBudget) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses List */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">
            Gastos Registrados ({expenses.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <div className="py-8 text-center text-grafito-400">
              <Receipt className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No hay gastos registrados</p>
            </div>
          ) : (
            <div className="divide-y">
              {expenses.map((expense) => {
                const cat = expenseCategories.find((c) => c.value === expense.category) || expenseCategories[7];
                return (
                  <div key={expense.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{cat.label}</p>
                      <p className="text-xs text-grafito-500 truncate">
                        {expense.description || expense.provider || '-'}
                      </p>
                      <p className="text-[10px] text-grafito-400">
                        {format(new Date(expense.expense_date || expense.created_at), 'dd/MM HH:mm', { locale: es })}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="font-bold text-red-600">-S/ {expense.amount.toFixed(2)}</p>
                      {expense.receipt_url && (
                        <button
                          type="button"
                          onClick={() => openReceipt(expense.receipt_url)}
                          className="mt-1 border-2 border-grafito-200 rounded p-0.5 hover:border-marca-400"
                          title="Ver comprobante"
                        >
                          <img
                            src={resolvePhoto(expense.receipt_url)}
                            alt="Comprobante"
                            className="w-10 h-10 object-cover rounded"
                          />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Add Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          className="rounded-full w-14 h-14 shadow-xl bg-marca-500 hover:bg-marca-600"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="w-7 h-7" />
        </Button>
      </div>

      {/* Hidden camera/file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoChange}
      />

      {/* Add Expense Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Registrar Gasto
            </DialogTitle>
            <DialogDescription>
              {dailyBudget > 0 && (
                <span className="text-indigo-600 font-medium">
                  Saldo disponible hoy: S/ {todayRemaining.toFixed(2)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Photo capture */}
            <div className="space-y-2">
              <Label className="input-label">Foto del Ticket / Comprobante</Label>
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Ticket"
                    className="w-full h-48 object-cover rounded-lg border-2 border-green-400"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 w-8 p-0 rounded-full"
                      onClick={removePhoto}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="absolute bottom-2 left-2">
                    <Badge className="bg-green-500 text-white">
                      <Check className="w-3 h-3 mr-1" /> Foto capturada
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-24 flex-col gap-2 border-dashed border-2 hover:border-marca-400 hover:bg-marca-50"
                    onClick={handleCameraCapture}
                  >
                    <Camera className="w-8 h-8 text-marca-500" />
                    <span className="text-xs font-medium">Escanear con Cámara</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 flex-col gap-2 border-dashed border-2 hover:border-grafito-400 hover:bg-grafito-100"
                    onClick={handleFileSelect}
                  >
                    <Upload className="w-8 h-8 text-grafito-500" />
                    <span className="text-xs font-medium">Subir Archivo</span>
                  </Button>
                </div>
              )}
              {scanning && (
                <p className="text-xs text-grafito-700 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Escaneando comprobante...
                </p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="input-label">Categoría *</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="input-label">Monto (S/) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="rounded-sm text-lg font-bold"
                placeholder="0.00"
              />
              {form.amount && dailyBudget > 0 && (
                <p className={`text-xs ${(todayRemaining - parseFloat(form.amount || 0)) < 0 ? 'text-red-500 font-bold' : 'text-grafito-500'}`}>
                  {(todayRemaining - parseFloat(form.amount || 0)) < 0
                    ? `⚠️ Excede el viático diario por S/ ${Math.abs(todayRemaining - parseFloat(form.amount || 0)).toFixed(2)}`
                    : `Quedará S/ ${(todayRemaining - parseFloat(form.amount || 0)).toFixed(2)} del día`
                  }
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="input-label">Descripción</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-sm"
                placeholder="Ej: Almuerzo en ruta, Ticket de balanza..."
              />
            </div>

            {/* Provider */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="input-label">Proveedor</Label>
                <Input
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  className="rounded-sm"
                  placeholder="Nombre"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">RUC</Label>
                <Input
                  value={form.ruc}
                  onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                  className="rounded-sm"
                  placeholder="20xxxxxxxxx"
                  maxLength={11}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="btn-action"
              onClick={handleSubmitExpense}
              disabled={saving || !form.amount}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Receipt className="w-4 h-4 mr-2" />
              )}
              Registrar Gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visor de comprobante */}
      <Dialog open={photoViewer.open} onOpenChange={(open) => setPhotoViewer((p) => ({ ...p, open }))}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprobante</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-grafito-100 rounded p-2">
            {photoViewer.url && (
              <img src={photoViewer.url} alt="Comprobante" className="max-h-[70vh] max-w-full object-contain" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverExpensesPage;
