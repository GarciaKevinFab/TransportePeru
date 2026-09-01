import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api, { tripsApi } from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Fuel,
  Camera,
  Image,
  Loader2,
  Plus,
  TrendingUp,
  DollarSign,
  Droplet,
  X,
  Receipt,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useOffline } from '../../hooks/useOffline';

// Viáticos por viaje (regla de negocio): S/ 540 por viaje
const VIATICO_POR_VIAJE = 540;
const API_ORIGIN = process.env.REACT_APP_BACKEND_URL || '';
// Resuelve URLs relativas de /uploads contra el backend; deja pasar base64 y absolutas
const resolvePhoto = (u) => (u && typeof u === 'string' && u.startsWith('/uploads') ? `${API_ORIGIN}${u}` : u);

const DriverFuelPage = () => {
  const { user } = useAuth();
  const { saveFuelLoadOffline } = useOffline();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [loads, setLoads] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractingOCR, setExtractingOCR] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [viatico, setViatico] = useState(null);

  const voucherCamRef = useRef(null);
  const voucherFileRef = useRef(null);
  const invoiceCamRef = useRef(null);
  const invoiceFileRef = useRef(null);

  const [formData, setFormData] = useState({
    vehicle_id: '',
    voucher_number: '',
    invoice_number: '',
    liters: '',
    price_per_liter: '',
    odometer: '',
    provider: '',
    voucher_photo_url: '',
    invoice_photo_url: '',
  });

  // Recibe el tripId por parametro: no lee nada de fuera, por eso sus
  // dependencias son vacias y su identidad es fija.
  const fetchViatico = useCallback(async (tripId) => {
    try {
      const res = await tripsApi.getViaticoStatus(tripId);
      setViatico(res.data);
    } catch (error) {
      // Endpoint no disponible: se usa cálculo local con los datos del viaje
      setViatico(null);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vehiclesRes, loadsRes, tripsRes] = await Promise.all([
        api.get('/vehicles'),
        api.get('/fuel/loads'),
        tripsApi.getAll(),
      ]);
      setVehicles(vehiclesRes.data.filter(v => v.vehicle_type === 'tracto'));
      // Filter loads for this driver
      setLoads(loadsRes.data.filter(l => l.driver_id === user?.id).slice(0, 10));
      // Viaje activo del chofer (para ligar la carga y descontar viáticos)
      const active = tripsRes.data.find(
        (t) => t.driver_id === user?.id && (t.status === 'en_curso' || t.status === 'programado')
      );
      setActiveTrip(active || null);
      if (active) {
        fetchViatico(active.id);
      } else {
        setViatico(null);
      }
    } catch (error) {
      toast.error('Error al cargar datos');
    }
    setLoading(false);
  }, [user?.id, fetchViatico]);

  // Sigue siendo una unica carga al montar: la sesion ya esta resuelta cuando
  // esta pantalla aparece (ProtectedRoute espera a AuthContext), asi que
  // user.id no cambia mientras la pagina vive.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePhotoCapture = (slot) => async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 5MB');
      return;
    }

    const field = slot === 'voucher' ? 'voucher_photo_url' : 'invoice_photo_url';
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      // Preview inmediato con el base64 mientras se sube al servidor
      setFormData(prev => ({ ...prev, [field]: base64Data }));

      // OCR only on invoice photo (factura tiene más datos)
      if (slot === 'invoice') {
        setExtractingOCR(true);
        try {
          toast.info('Extrayendo datos de la factura...');
          const ocrResponse = await api.post('/fuel/ocr', { image_base64: base64Data });

          if (ocrResponse.data.success && ocrResponse.data.extracted_data) {
            const extracted = ocrResponse.data.extracted_data;
            setFormData(prev => ({
              ...prev,
              liters: extracted.liters?.toString() || prev.liters,
              price_per_liter: extracted.price_per_liter?.toString() || prev.price_per_liter,
              odometer: extracted.odometer?.toString() || prev.odometer,
              provider: extracted.provider || prev.provider,
              invoice_number: extracted.invoice_number || prev.invoice_number,
            }));
            toast.success('¡Datos extraídos!');
          }
        } catch (error) {
          console.log('OCR failed:', error);
        }
        setExtractingOCR(false);
      }

      // Subir la foto y guardar la URL resultante (no el dataURL base64 en el documento)
      setUploadingPhoto(true);
      try {
        const uploadRes = await api.post('/upload/base64', {
          data: base64Data,
          entity_type: 'fuel',
          entity_id: activeTrip?.id || formData.vehicle_id || 'loads',
        });
        if (uploadRes.data?.url) {
          setFormData(prev => ({ ...prev, [field]: uploadRes.data.url }));
        }
      } catch (err) {
        // Sin conexión: se conserva el base64 como respaldo para la cola offline
        console.log('Upload failed, keeping base64:', err);
      }
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSaveLoad = async () => {
    if (!formData.vehicle_id || !formData.liters || !formData.price_per_liter || !formData.odometer) {
      toast.error('Complete todos los campos requeridos');
      return;
    }
    if (!formData.voucher_photo_url && !formData.invoice_photo_url) {
      toast.error('Suba al menos una foto (vale o factura)');
      return;
    }

    setSaving(true);
    const liters = parseFloat(formData.liters);
    const price = parseFloat(formData.price_per_liter);
    const payload = {
      vehicle_id: formData.vehicle_id,
      // Liga la carga al viaje activo: sin trip_id el gasto no descuenta viáticos
      trip_id: activeTrip?.id || null,
      voucher_number: formData.voucher_number || null,
      invoice_number: formData.invoice_number || null,
      liters,
      price_per_liter: price,
      total_amount: liters * price,
      odometer: parseInt(formData.odometer),
      provider: formData.provider || 'Sin proveedor',
      voucher_photo_url: formData.voucher_photo_url || null,
      invoice_photo_url: formData.invoice_photo_url || null,
      receipt_url: formData.invoice_photo_url || formData.voucher_photo_url || null,
      driver_id: user?.id,
    };

    // Offline shortcut
    if (!navigator.onLine) {
      const ok = await saveFuelLoadOffline(payload);
      if (ok) {
        toast.success('Guardado offline. Se enviará al reconectar');
        setShowAddDialog(false);
        resetForm();
      } else {
        toast.error('No se pudo guardar offline');
      }
      setSaving(false);
      return;
    }

    try {
      await api.post('/fuel/loads', payload);

      toast.success('Carga registrada exitosamente');
      setShowAddDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      // Network failure: fall back to offline queue
      const isNetworkErr = !error.response;
      if (isNetworkErr) {
        const ok = await saveFuelLoadOffline(payload);
        if (ok) {
          toast.success('Guardado offline. Se enviará al reconectar');
          setShowAddDialog(false);
          resetForm();
        } else {
          toast.error('No se pudo guardar offline');
        }
      } else {
        toast.error(error.response?.data?.detail || 'Error al guardar');
      }
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFormData({
      vehicle_id: '',
      voucher_number: '',
      invoice_number: '',
      liters: '',
      price_per_liter: '',
      odometer: '',
      provider: '',
      voucher_photo_url: '',
      invoice_photo_url: '',
    });
  };

  const removePhoto = (slot) => {
    const field = slot === 'voucher' ? 'voucher_photo_url' : 'invoice_photo_url';
    setFormData(prev => ({ ...prev, [field]: '' }));
  };

  const totalLiters = loads.reduce((sum, l) => sum + (l.liters || 0), 0);
  const totalSpent = loads.reduce((sum, l) => sum + ((l.liters || 0) * (l.price_per_liter || 0)), 0);

  // Estado de viáticos: usa el endpoint si respondió; si no, cálculo local con el viaje
  const viaticoRemaining = viatico?.remaining ?? (
    activeTrip ? ((activeTrip.viatico_budget || 0) - (activeTrip.total_expenses || 0)) : null
  );
  const viaticoAlert = viatico?.alert ?? (viaticoRemaining != null && viaticoRemaining < VIATICO_POR_VIAJE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-marca-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-grafito-900">Combustible</h1>
        <Button 
          className="bg-marca-500 hover:bg-marca-600"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Cargar
        </Button>
      </div>

      {/* Viáticos / Saldo del viaje activo */}
      {activeTrip && viaticoRemaining != null && (
        <Card
          data-testid="fuel-viatico-status"
          className={viaticoAlert ? 'border-red-300 bg-red-50' : 'border-emerald-200 bg-emerald-50'}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-grafito-500 font-bold">
                  Saldo de Viáticos
                </p>
                <p className={`text-2xl font-bold ${viaticoAlert ? 'text-red-600' : 'text-emerald-700'}`}>
                  S/ {viaticoRemaining.toFixed(2)}
                </p>
              </div>
              <Badge className={viaticoAlert ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}>
                {activeTrip.client_name || 'Viaje activo'}
              </Badge>
            </div>
            {viaticoAlert && (
              <p className="mt-2 text-sm font-semibold text-red-700">
                ⚠️ Saldo menor a 1 viaje (S/ {VIATICO_POR_VIAJE})
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <Droplet className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{totalLiters.toFixed(1)}</p>
            <p className="text-sm text-green-100">Litros cargados</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <DollarSign className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-2xl font-bold">S/ {totalSpent.toFixed(0)}</p>
            <p className="text-sm text-blue-100">Total gastado</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Loads */}
      <div>
        <h2 className="text-sm font-bold text-grafito-500 uppercase tracking-wider mb-3">
          Mis Cargas Recientes
        </h2>
        {loads.length === 0 ? (
          <Card className="bg-grafito-50 border-dashed">
            <CardContent className="p-6 text-center">
              <Fuel className="w-12 h-12 text-grafito-300 mx-auto mb-3" />
              <p className="text-grafito-500">No hay cargas registradas</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {loads.map((load) => (
              <Card key={load.id} className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-grafito-800">{load.vehicle_plate}</span>
                    <Badge className="bg-green-100 text-green-800">
                      {load.liters} L
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-grafito-500">
                    <span>{load.provider || 'Sin proveedor'}</span>
                    <span>S/ {((load.liters || 0) * (load.price_per_liter || 0)).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-grafito-400 mt-1">
                    {format(new Date(load.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Load Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Carga de Combustible</DialogTitle>
          </DialogHeader>
          
          {/* Hidden inputs for camera/file */}
          <input type="file" accept="image/*" capture="environment" ref={voucherCamRef} onChange={handlePhotoCapture('voucher')} className="hidden" />
          <input type="file" accept="image/*" ref={voucherFileRef} onChange={handlePhotoCapture('voucher')} className="hidden" />
          <input type="file" accept="image/*" capture="environment" ref={invoiceCamRef} onChange={handlePhotoCapture('invoice')} className="hidden" />
          <input type="file" accept="image/*" ref={invoiceFileRef} onChange={handlePhotoCapture('invoice')} className="hidden" />

          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
            {/* VOUCHER PHOTO */}
            <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Label className="flex items-center gap-2 text-blue-900 font-semibold">
                <Receipt className="w-4 h-4" /> Vale de Combustible
              </Label>
              <Input
                value={formData.voucher_number}
                onChange={(e) => setFormData({ ...formData, voucher_number: e.target.value })}
                placeholder="N° de vale"
                className="bg-white"
              />
              {formData.voucher_photo_url ? (
                <div className="relative">
                  <img src={resolvePhoto(formData.voucher_photo_url)} alt="Vale" className="w-full h-32 object-cover rounded-lg" />
                  <button onClick={() => removePhoto('voucher')} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1 bg-white" onClick={() => voucherCamRef.current?.click()} disabled={uploadingPhoto}>
                    {uploadingPhoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}Tomar Foto
                  </Button>
                  <Button type="button" variant="outline" className="bg-white" onClick={() => voucherFileRef.current?.click()} disabled={uploadingPhoto}>
                    <Image className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* INVOICE PHOTO */}
            <div className="space-y-2 p-3 bg-marca-50 rounded-lg border border-marca-200">
              <Label className="flex items-center gap-2 text-marca-900 font-semibold">
                <FileText className="w-4 h-4" /> Factura
              </Label>
              <Input
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="N° de factura"
                className="bg-white"
              />
              {formData.invoice_photo_url ? (
                <div className="relative">
                  <img src={resolvePhoto(formData.invoice_photo_url)} alt="Factura" className="w-full h-32 object-cover rounded-lg" />
                  <button onClick={() => removePhoto('invoice')} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1 bg-white" onClick={() => invoiceCamRef.current?.click()} disabled={extractingOCR || uploadingPhoto}>
                    {(extractingOCR || uploadingPhoto) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                    Tomar Foto
                  </Button>
                  <Button type="button" variant="outline" className="bg-white" onClick={() => invoiceFileRef.current?.click()} disabled={extractingOCR || uploadingPhoto}>
                    <Image className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {extractingOCR && (
                <p className="text-xs text-blue-700 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Extrayendo datos con IA...
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Vehículo *</Label>
              <Select
                value={formData.vehicle_id}
                onValueChange={(v) => setFormData({ ...formData, vehicle_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.plate} - {v.brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Litros *</Label>
                <Input type="number" step="0.01" value={formData.liters} onChange={(e) => setFormData({ ...formData, liters: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Precio/Litro *</Label>
                <Input type="number" step="0.01" value={formData.price_per_liter} onChange={(e) => setFormData({ ...formData, price_per_liter: e.target.value })} placeholder="0.00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Odómetro *</Label>
                <Input type="number" value={formData.odometer} onChange={(e) => setFormData({ ...formData, odometer: e.target.value })} placeholder="km" />
              </div>
              <div className="space-y-2">
                <Label>Grifo</Label>
                <Input value={formData.provider} onChange={(e) => setFormData({ ...formData, provider: e.target.value })} placeholder="Nombre" />
              </div>
            </div>

            {/* Total */}
            {formData.liters && formData.price_per_liter && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-grafito-600">Total:</p>
                <p className="text-2xl font-bold text-green-700">
                  S/ {(parseFloat(formData.liters) * parseFloat(formData.price_per_liter)).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowAddDialog(false); }}>
              Cancelar
            </Button>
            <Button 
              className="bg-marca-500 hover:bg-marca-600"
              onClick={handleSaveLoad}
              disabled={saving || !formData.vehicle_id || !formData.liters}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverFuelPage;
