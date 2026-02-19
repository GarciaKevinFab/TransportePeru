import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
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
  Check,
  Loader2,
  Plus,
  TrendingUp,
  DollarSign,
  Droplet,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DriverFuelPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [loads, setLoads] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractingOCR, setExtractingOCR] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    vehicle_id: '',
    liters: '',
    price_per_liter: '',
    odometer: '',
    provider: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, loadsRes] = await Promise.all([
        api.get('/vehicles'),
        api.get('/fuel/loads'),
      ]);
      setVehicles(vehiclesRes.data.filter(v => v.vehicle_type === 'tracto'));
      // Filter loads for this driver
      setLoads(loadsRes.data.filter(l => l.driver_id === user?.id).slice(0, 10));
    } catch (error) {
      toast.error('Error al cargar datos');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePhotoCapture = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      setCapturedPhoto(base64Data);
      
      // Try OCR extraction
      setExtractingOCR(true);
      try {
        toast.info('Extrayendo datos del recibo...');
        const ocrResponse = await api.post('/fuel/ocr', { image_base64: base64Data });
        
        if (ocrResponse.data.success && ocrResponse.data.extracted_data) {
          const extracted = ocrResponse.data.extracted_data;
          setFormData(prev => ({
            ...prev,
            liters: extracted.liters?.toString() || prev.liters,
            price_per_liter: extracted.price_per_liter?.toString() || prev.price_per_liter,
            odometer: extracted.odometer?.toString() || prev.odometer,
            provider: extracted.provider || prev.provider,
          }));
          toast.success('¡Datos extraídos automáticamente!');
        }
      } catch (error) {
        console.log('OCR failed:', error);
      }
      setExtractingOCR(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLoad = async () => {
    if (!formData.vehicle_id || !formData.liters || !formData.price_per_liter || !formData.odometer) {
      toast.error('Complete todos los campos requeridos');
      return;
    }

    setSaving(true);
    try {
      // Upload photo first if exists
      let photoUrl = null;
      if (capturedPhoto) {
        const uploadRes = await api.post('/upload/base64', {
          data: capturedPhoto,
          entity_type: 'fuel',
          entity_id: 'loads',
        });
        photoUrl = uploadRes.data.url;
      }

      await api.post('/fuel/loads', {
        ...formData,
        liters: parseFloat(formData.liters),
        price_per_liter: parseFloat(formData.price_per_liter),
        odometer: parseInt(formData.odometer),
        photo_url: photoUrl,
        driver_id: user?.id,
      });

      toast.success('Carga registrada');
      setShowAddDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFormData({
      vehicle_id: '',
      liters: '',
      price_per_liter: '',
      odometer: '',
      provider: '',
    });
    setCapturedPhoto(null);
  };

  const totalLiters = loads.reduce((sum, l) => sum + (l.liters || 0), 0);
  const totalSpent = loads.reduce((sum, l) => sum + ((l.liters || 0) * (l.price_per_liter || 0)), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Combustible</h1>
        <Button 
          className="bg-orange-500 hover:bg-orange-600"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Cargar
        </Button>
      </div>

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
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
          Mis Cargas Recientes
        </h2>
        {loads.length === 0 ? (
          <Card className="bg-slate-50 border-dashed">
            <CardContent className="p-6 text-center">
              <Fuel className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No hay cargas registradas</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {loads.map((load) => (
              <Card key={load.id} className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800">{load.vehicle_plate}</span>
                    <Badge className="bg-green-100 text-green-800">
                      {load.liters} L
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>{load.provider || 'Sin proveedor'}</span>
                    <span>S/ {((load.liters || 0) * (load.price_per_liter || 0)).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
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
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            onChange={handlePhotoCapture}
            className="hidden"
          />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handlePhotoCapture}
            className="hidden"
          />

          <div className="space-y-4 py-2">
            {/* Photo capture */}
            <div className="space-y-2">
              <Label>Foto del Recibo</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={extractingOCR}
                >
                  {extractingOCR ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 mr-2" />
                  )}
                  Tomar Foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={extractingOCR}
                >
                  <Image className="w-4 h-4" />
                </Button>
              </div>
              {capturedPhoto && (
                <div className="relative mt-2">
                  <img 
                    src={capturedPhoto} 
                    alt="Recibo" 
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              )}
              {extractingOCR && (
                <p className="text-sm text-blue-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Extrayendo datos con IA...
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
                <Input
                  type="number"
                  step="0.01"
                  value={formData.liters}
                  onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Precio/Litro *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price_per_liter}
                  onChange={(e) => setFormData({ ...formData, price_per_liter: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Odómetro *</Label>
                <Input
                  type="number"
                  value={formData.odometer}
                  onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
                  placeholder="km"
                />
              </div>
              <div className="space-y-2">
                <Label>Grifo</Label>
                <Input
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  placeholder="Nombre"
                />
              </div>
            </div>

            {/* Total */}
            {formData.liters && formData.price_per_liter && (
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-slate-500">Total:</p>
                <p className="text-xl font-bold text-orange-600">
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
              className="bg-orange-500 hover:bg-orange-600"
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
