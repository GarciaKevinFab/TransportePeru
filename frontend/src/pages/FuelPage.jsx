import React, { useState, useEffect, useRef } from 'react';
import { fuelApi, vehiclesApi, tripsApi, usersApi } from '../services/api';
import api from '../services/api';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Fuel,
  Plus,
  Loader2,
  Ticket,
  TrendingUp,
  AlertTriangle,
  Camera,
  MoreVertical,
  Pencil,
  Trash2,
  Image,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

const FuelPage = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState([]);
  const [loads, setLoads] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [photoPreview, setPhotoPreview] = useState({ open: false, url: '', title: '' });
  
  const [showVoucherDialog, setShowVoucherDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [editingLoad, setEditingLoad] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const [voucherForm, setVoucherForm] = useState({
    voucher_number: '',
    vehicle_id: '',
    trip_id: '',
    provider: '',
    limit_liters: '',
    limit_amount: '',
    valid_from: '',
    valid_until: '',
    photo_url: '',
    voucher_photo_url: '',
    invoice_photo_url: '',
    invoice_number: '',
  });

  const [loadForm, setLoadForm] = useState({
    vehicle_id: '',
    voucher_id: '',
    trip_id: '',
    liters: '',
    price_per_liter: '',
    odometer: '',
    provider: '',
    photo_url: '',
    voucher_photo_url: '',
    invoice_photo_url: '',
    invoice_number: '',
  });

  // Refs for new photo slots (voucher + invoice) — base64-based
  const voucherFileInputRef = useRef(null);
  const voucherCameraInputRef = useRef(null);
  const invoiceFileInputRef = useRef(null);
  const invoiceCameraInputRef = useRef(null);

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vouchersRes, loadsRes, kpisRes, vehiclesRes, tripsRes, driversRes] = await Promise.all([
        fuelApi.getVouchers(),
        fuelApi.getLoads(),
        fuelApi.getKpis(),
        vehiclesApi.getAll(),
        tripsApi.getAll(),
        usersApi.getAll({ role: 'chofer' }),
      ]);
      setVouchers(vouchersRes.data);
      setLoads(loadsRes.data);
      setKpis(kpisRes.data);
      setVehicles(vehiclesRes.data);
      setTrips(tripsRes.data.filter(t => t.status === 'en_curso' || t.status === 'programado'));
      setDrivers(driversRes.data);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetVoucherForm = () => {
    setVoucherForm({
      voucher_number: '',
      vehicle_id: '',
      trip_id: '',
      provider: '',
      limit_liters: '',
      limit_amount: '',
      valid_from: '',
      valid_until: '',
      photo_url: '',
      voucher_photo_url: '',
      invoice_photo_url: '',
      invoice_number: '',
    });
    setEditingVoucher(null);
    setCapturedPhoto(null);
  };

  const resetLoadForm = () => {
    setLoadForm({
      vehicle_id: '',
      voucher_id: '',
      trip_id: '',
      liters: '',
      price_per_liter: '',
      odometer: '',
      provider: '',
      photo_url: '',
      voucher_photo_url: '',
      invoice_photo_url: '',
      invoice_number: '',
    });
    setEditingLoad(null);
    setCapturedPhoto(null);
  };

  const handleEditVoucher = (voucher) => {
    setEditingVoucher(voucher);
    setVoucherForm({
      voucher_number: voucher.voucher_number || '',
      vehicle_id: voucher.vehicle_id || '',
      trip_id: voucher.trip_id || '',
      provider: voucher.provider || '',
      limit_liters: voucher.limit_liters?.toString() || '',
      limit_amount: voucher.limit_amount?.toString() || '',
      valid_from: voucher.valid_from?.substring(0, 10) || '',
      valid_until: voucher.valid_until?.substring(0, 10) || '',
      photo_url: voucher.photo_url || '',
      voucher_photo_url: voucher.voucher_photo_url || voucher.photo_url || '',
      invoice_photo_url: voucher.invoice_photo_url || '',
      invoice_number: voucher.invoice_number || '',
    });
    setCapturedPhoto(voucher.photo_url);
    setShowVoucherDialog(true);
  };

  const handleEditLoad = (load) => {
    setEditingLoad(load);
    setLoadForm({
      vehicle_id: load.vehicle_id || '',
      voucher_id: load.voucher_id || '',
      trip_id: load.trip_id || '',
      liters: load.liters?.toString() || '',
      price_per_liter: load.price_per_liter?.toString() || '',
      odometer: load.odometer?.toString() || '',
      provider: load.provider || '',
      photo_url: load.photo_url || '',
      voucher_photo_url: load.voucher_photo_url || load.photo_url || '',
      invoice_photo_url: load.invoice_photo_url || '',
      invoice_number: load.invoice_number || '',
    });
    setCapturedPhoto(load.photo_url);
    setShowLoadDialog(true);
  };

  const handleDeleteVoucher = async (voucherId) => {
    if (!confirm('¿Eliminar este vale de combustible?')) return;
    
    try {
      await api.delete(`/fuel/vouchers/${voucherId}`);
      toast.success('Vale eliminado');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar vale');
    }
  };

  const handleDeleteLoad = async (loadId) => {
    if (!confirm('¿Eliminar este registro de carga?')) return;
    
    try {
      await api.delete(`/fuel/loads/${loadId}`);
      toast.success('Carga eliminada');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar carga');
    }
  };

  const handlePhotoCapture = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadingPhoto(true);
    
    try {
      // Convert file to base64 for OCR
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target.result;
        
        // Upload file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entity_type', 'fuel');
        formData.append('entity_id', 'vouchers');
        
        try {
          const uploadResponse = await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          setCapturedPhoto(uploadResponse.data.url);
          
          if (showVoucherDialog) {
            setVoucherForm(prev => ({ ...prev, photo_url: uploadResponse.data.url }));
          } else if (showLoadDialog) {
            setLoadForm(prev => ({ ...prev, photo_url: uploadResponse.data.url }));
            
            // Try OCR extraction for load receipts
            try {
              toast.info('Extrayendo datos del recibo...');
              const ocrResponse = await api.post('/fuel/ocr', { image_base64: base64Data });
              
              if (ocrResponse.data.success && ocrResponse.data.extracted_data) {
                const extracted = ocrResponse.data.extracted_data;
                
                // Auto-fill form with extracted data
                setLoadForm(prev => ({
                  ...prev,
                  liters: extracted.liters?.toString() || prev.liters,
                  price_per_liter: extracted.price_per_liter?.toString() || prev.price_per_liter,
                  odometer: extracted.odometer?.toString() || prev.odometer,
                  provider: extracted.provider || prev.provider,
                }));
                
                toast.success('Datos extraídos automáticamente');
              }
            } catch (ocrError) {
              console.log('OCR extraction failed:', ocrError);
              // Continue without OCR - not critical
            }
          }
          
          toast.success('Foto capturada');
        } catch (uploadError) {
          toast.error('Error al subir foto');
        }
        
        setUploadingPhoto(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Error al procesar foto');
      setUploadingPhoto(false);
    }
  };

  // New base64-based handler for voucher/invoice photo slots (avoids ngrok URL issues)
  const handleSlotPhotoCapture = (slot) => (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      const field = slot === 'invoice' ? 'invoice_photo_url' : 'voucher_photo_url';
      if (showVoucherDialog) {
        setVoucherForm(prev => ({ ...prev, [field]: base64 }));
      } else if (showLoadDialog) {
        setLoadForm(prev => ({ ...prev, [field]: base64 }));
      }
      toast.success(slot === 'invoice' ? 'Foto de factura cargada' : 'Foto de vale cargada');
      setUploadingPhoto(false);
      // reset input value so picking same file twice still triggers change
      event.target.value = '';
    };
    reader.onerror = () => {
      toast.error('Error al leer la imagen');
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  // Dedicated OCR function for manual extraction
  const handleExtractDataFromPhoto = async () => {
    if (!capturedPhoto) {
      toast.error('Primero capture una foto');
      return;
    }
    
    setUploadingPhoto(true);
    toast.info('Extrayendo datos del vale...');
    
    try {
      // Fetch the image and convert to base64
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const ocrResponse = await api.post('/fuel/ocr', { image_base64: e.target.result });
          
          if (ocrResponse.data.success && ocrResponse.data.extracted_data) {
            const extracted = ocrResponse.data.extracted_data;
            
            if (showVoucherDialog) {
              setVoucherForm(prev => ({
                ...prev,
                voucher_number: extracted.voucher_number || prev.voucher_number,
                provider: extracted.provider || prev.provider,
                limit_liters: extracted.liters?.toString() || prev.limit_liters,
                limit_amount: extracted.total_amount?.toString() || prev.limit_amount,
              }));
            } else if (showLoadDialog) {
              setLoadForm(prev => ({
                ...prev,
                liters: extracted.liters?.toString() || prev.liters,
                price_per_liter: extracted.price_per_liter?.toString() || prev.price_per_liter,
                odometer: extracted.odometer?.toString() || prev.odometer,
                provider: extracted.provider || prev.provider,
              }));
            }
            
            toast.success('Datos extraídos correctamente');
          } else {
            toast.error('No se pudieron extraer datos de la imagen');
          }
        } catch (ocrError) {
          toast.error('Error al procesar imagen con OCR');
        }
        setUploadingPhoto(false);
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      toast.error('Error al extraer datos');
      setUploadingPhoto(false);
    }
  };

  const handleSaveVoucher = async () => {
    if (!voucherForm.voucher_number || !voucherForm.vehicle_id || !voucherForm.provider) {
      toast.error('Número de vale, vehículo y proveedor son requeridos');
      return;
    }
    
    setSaving(true);
    try {
      const data = {
        ...voucherForm,
        limit_liters: parseFloat(voucherForm.limit_liters) || null,
        limit_amount: parseFloat(voucherForm.limit_amount) || null,
        photo_url: voucherForm.voucher_photo_url || capturedPhoto || voucherForm.photo_url,
        voucher_photo_url: voucherForm.voucher_photo_url || null,
        invoice_photo_url: voucherForm.invoice_photo_url || null,
        invoice_number: voucherForm.invoice_number || null,
      };

      if (editingVoucher) {
        await api.put(`/fuel/vouchers/${editingVoucher.id}`, data);
        toast.success('Vale actualizado');
      } else {
        await fuelApi.createVoucher(data);
        toast.success('Vale creado');
      }
      
      setShowVoucherDialog(false);
      resetVoucherForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar vale');
    }
    setSaving(false);
  };

  const handleSaveLoad = async () => {
    if (!loadForm.vehicle_id || !loadForm.liters || !loadForm.price_per_liter || !loadForm.odometer) {
      toast.error('Vehículo, litros, precio y odómetro son requeridos');
      return;
    }
    
    setSaving(true);
    try {
      const data = {
        ...loadForm,
        liters: parseFloat(loadForm.liters),
        price_per_liter: parseFloat(loadForm.price_per_liter),
        odometer: parseInt(loadForm.odometer),
        photo_url: loadForm.voucher_photo_url || capturedPhoto || loadForm.photo_url,
        voucher_photo_url: loadForm.voucher_photo_url || null,
        invoice_photo_url: loadForm.invoice_photo_url || null,
        invoice_number: loadForm.invoice_number || null,
      };

      if (editingLoad) {
        await api.put(`/fuel/loads/${editingLoad.id}`, data);
        toast.success('Carga actualizada');
      } else {
        await fuelApi.createLoad(data);
        toast.success('Carga registrada');
      }
      
      setShowLoadDialog(false);
      resetLoadForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar carga');
    }
    setSaving(false);
  };

  const getVehiclePlate = (id) => vehicles.find(v => v.id === id)?.plate || '-';
  const getDriverName = (id) => {
    if (!id) return '-';
    const d = drivers.find(u => u.id === id);
    return d ? d.name : '-';
  };
  const openPhoto = (url, title) => setPhotoPreview({ open: true, url, title });

  const totalLiters = loads.reduce((sum, l) => sum + (l.liters || 0), 0);
  const totalAmount = loads.reduce((sum, l) => sum + (l.total_amount || 0), 0);
  const activeVouchers = vouchers.filter(v => !v.is_used).length;
  const avgPrice = totalLiters > 0 ? totalAmount / totalLiters : 0;

  return (
    <div className="space-y-6 page-fade-in" data-testid="fuel-page">
      {/* Hidden file inputs (legacy) */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handlePhotoCapture}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />
      {/* Hidden file inputs (voucher + invoice base64) */}
      <input
        type="file"
        ref={voucherFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleSlotPhotoCapture('voucher')}
      />
      <input
        type="file"
        ref={voucherCameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleSlotPhotoCapture('voucher')}
      />
      <input
        type="file"
        ref={invoiceFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleSlotPhotoCapture('invoice')}
      />
      <input
        type="file"
        ref={invoiceCameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleSlotPhotoCapture('invoice')}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Combustible
          </h1>
          <p className="text-slate-500 mt-1">
            Gestión de vales y cargas de combustible
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="btn-press" onClick={() => { resetVoucherForm(); setShowVoucherDialog(true); }}>
            <Ticket className="w-4 h-4 mr-2" />
            Nuevo Vale
          </Button>
          <Button className="btn-action btn-press" onClick={() => { resetLoadForm(); setShowLoadDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Registrar Carga
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-blue-500 card-enter card-stagger-1">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Vales Activos</p>
                <p className="font-heading text-3xl font-bold text-blue-600 mt-1">{activeVouchers}</p>
              </div>
              <Ticket className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-green-500 card-enter card-stagger-2">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total Litros</p>
                <p className="font-heading text-2xl font-bold text-green-600 mt-1">{totalLiters.toLocaleString()}</p>
              </div>
              <Fuel className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-orange-500 card-enter card-stagger-3">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total Gastado</p>
                <p className="font-heading text-xl font-bold text-orange-600 mt-1">S/ {totalAmount.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-slate-500 card-enter card-stagger-4">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Precio Promedio</p>
                <p className="font-heading text-xl font-bold text-slate-600 mt-1">S/ {avgPrice.toFixed(2)}/L</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="vouchers">
        <TabsList className="bg-slate-100 rounded-sm">
          <TabsTrigger value="vouchers" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            Vales ({vouchers.length})
          </TabsTrigger>
          <TabsTrigger value="loads" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            Cargas ({loads.length})
          </TabsTrigger>
        </TabsList>

        {/* Vouchers Tab */}
        <TabsContent value="vouchers" className="mt-4">
          <Card className="bg-white section-enter">
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : vouchers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Ticket className="w-12 h-12 mb-2" />
                  <p>No hay vales registrados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>Número</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Límite</TableHead>
                      <TableHead>Vigencia</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Foto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.map((voucher) => (
                      <TableRow key={voucher.id} className="table-dense">
                        <TableCell className="font-mono font-bold">{voucher.voucher_number}</TableCell>
                        <TableCell>{getVehiclePlate(voucher.vehicle_id)}</TableCell>
                        <TableCell>{voucher.provider}</TableCell>
                        <TableCell>
                          {voucher.limit_liters ? `${voucher.limit_liters} L` : 
                           voucher.limit_amount ? `S/ ${voucher.limit_amount}` : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {voucher.valid_from?.substring(0, 10)} - {voucher.valid_until?.substring(0, 10)}
                        </TableCell>
                        <TableCell>
                          <Badge className={voucher.is_used ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-700'}>
                            {voucher.is_used ? 'Usado' : 'Disponible'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {(voucher.voucher_photo_url || voucher.photo_url) ? (
                              <button onClick={() => openPhoto(voucher.voucher_photo_url || voucher.photo_url, `Vale ${voucher.voucher_number}`)} className="border-2 border-blue-300 rounded p-0.5 hover:border-blue-500" title="Foto del vale">
                                <img src={voucher.voucher_photo_url || voucher.photo_url} alt="vale" className="w-8 h-8 object-cover rounded" />
                              </button>
                            ) : (
                              <div className="w-9 h-9 border-2 border-dashed border-slate-200 rounded flex items-center justify-center text-slate-300 text-[10px]">V</div>
                            )}
                            {voucher.invoice_photo_url ? (
                              <button onClick={() => openPhoto(voucher.invoice_photo_url, `Factura ${voucher.invoice_number || ''}`)} className="border-2 border-orange-300 rounded p-0.5 hover:border-orange-500" title="Foto de factura">
                                <img src={voucher.invoice_photo_url} alt="factura" className="w-8 h-8 object-cover rounded" />
                              </button>
                            ) : (
                              <div className="w-9 h-9 border-2 border-dashed border-slate-200 rounded flex items-center justify-center text-slate-300 text-[10px]">F</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditVoucher(voucher)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteVoucher(voucher.id)} className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

        {/* Loads Tab */}
        <TabsContent value="loads" className="mt-4">
          <Card className="bg-white section-enter">
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : loads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Fuel className="w-12 h-12 mb-2" />
                  <p>No hay cargas registradas</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>Fecha</TableHead>
                      <TableHead>Chofer</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>N° Vale</TableHead>
                      <TableHead>N° Factura</TableHead>
                      <TableHead>Litros</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Odómetro</TableHead>
                      <TableHead className="text-center">Fotos</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loads.map((load) => {
                      const voucherPhoto = load.voucher_photo_url || (load.voucher_id ? null : load.photo_url);
                      const invoicePhoto = load.invoice_photo_url;
                      return (
                      <TableRow key={load.id} className="table-dense">
                        <TableCell className="text-sm">
                          {format(new Date(load.load_date || load.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{getDriverName(load.driver_id)}</TableCell>
                        <TableCell className="font-mono">{getVehiclePlate(load.vehicle_id)}</TableCell>
                        <TableCell className="font-mono text-xs">{load.voucher_number || '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{load.invoice_number || '-'}</TableCell>
                        <TableCell className="font-bold">{load.liters?.toFixed(2)} L</TableCell>
                        <TableCell className="font-bold text-green-600">S/ {load.total_amount?.toFixed(2)}</TableCell>
                        <TableCell>{load.odometer?.toLocaleString()} km</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {voucherPhoto ? (
                              <button onClick={() => openPhoto(voucherPhoto, `Vale ${load.voucher_number || ''}`)} className="border-2 border-blue-300 rounded p-0.5 hover:border-blue-500" title="Foto del vale">
                                <img src={voucherPhoto} alt="vale" className="w-8 h-8 object-cover rounded" />
                              </button>
                            ) : (
                              <div className="w-9 h-9 border-2 border-dashed border-slate-200 rounded flex items-center justify-center text-slate-300 text-[10px]">V</div>
                            )}
                            {invoicePhoto ? (
                              <button onClick={() => openPhoto(invoicePhoto, `Factura ${load.invoice_number || ''}`)} className="border-2 border-orange-300 rounded p-0.5 hover:border-orange-500" title="Foto de factura">
                                <img src={invoicePhoto} alt="factura" className="w-8 h-8 object-cover rounded" />
                              </button>
                            ) : (
                              <div className="w-9 h-9 border-2 border-dashed border-slate-200 rounded flex items-center justify-center text-slate-300 text-[10px]">F</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditLoad(load)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteLoad(load.id)} className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Photo Preview Dialog */}
      <Dialog open={photoPreview.open} onOpenChange={(open) => setPhotoPreview(p => ({ ...p, open }))}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{photoPreview.title || 'Foto'}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-slate-100 rounded p-2">
            {photoPreview.url && (
              <img src={photoPreview.url} alt="preview" className="max-h-[70vh] max-w-full object-contain" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Voucher Dialog */}
      <Dialog open={showVoucherDialog} onOpenChange={(open) => { if (!open) resetVoucherForm(); setShowVoucherDialog(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {editingVoucher ? 'Editar Vale de Combustible' : 'Nuevo Vale de Combustible'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Número de Vale *</Label>
                <Input
                  value={voucherForm.voucher_number}
                  onChange={(e) => setVoucherForm({ ...voucherForm, voucher_number: e.target.value })}
                  className="rounded-sm"
                  placeholder="Ej: VAL-001"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Vehículo *</Label>
                <Select value={voucherForm.vehicle_id} onValueChange={(v) => setVoucherForm({ ...voucherForm, vehicle_id: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.filter(v => v.vehicle_type === 'tracto').map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.plate} - {v.brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Proveedor *</Label>
                <Input
                  value={voucherForm.provider}
                  onChange={(e) => setVoucherForm({ ...voucherForm, provider: e.target.value })}
                  className="rounded-sm"
                  placeholder="Repsol, Primax..."
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Viaje (Opcional)</Label>
                <Select value={voucherForm.trip_id || "none"} onValueChange={(v) => setVoucherForm({ ...voucherForm, trip_id: v === "none" ? "" : v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {trips.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.client_name || 'Sin cliente'} - {format(new Date(t.scheduled_date), 'dd/MM')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Límite (Litros)</Label>
                <Input
                  type="number"
                  value={voucherForm.limit_liters}
                  onChange={(e) => setVoucherForm({ ...voucherForm, limit_liters: e.target.value })}
                  className="rounded-sm"
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Límite (Soles)</Label>
                <Input
                  type="number"
                  value={voucherForm.limit_amount}
                  onChange={(e) => setVoucherForm({ ...voucherForm, limit_amount: e.target.value })}
                  className="rounded-sm"
                  placeholder="500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Válido Desde</Label>
                <Input
                  type="date"
                  value={voucherForm.valid_from}
                  onChange={(e) => setVoucherForm({ ...voucherForm, valid_from: e.target.value })}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Válido Hasta</Label>
                <Input
                  type="date"
                  value={voucherForm.valid_until}
                  onChange={(e) => setVoucherForm({ ...voucherForm, valid_until: e.target.value })}
                  className="rounded-sm"
                />
              </div>
            </div>
            
            {/* Invoice number */}
            <div className="space-y-2">
              <Label className="input-label">Número de Factura</Label>
              <Input
                value={voucherForm.invoice_number}
                onChange={(e) => setVoucherForm({ ...voucherForm, invoice_number: e.target.value })}
                className="rounded-sm"
                placeholder="F001-12345"
              />
            </div>

            {/* Voucher photo */}
            <div className="space-y-2">
              <Label className="input-label">Foto del Vale</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => voucherCameraInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                  Tomar Foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => voucherFileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Seleccionar
                </Button>
                {voucherForm.voucher_photo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setVoucherForm({ ...voucherForm, voucher_photo_url: '' })}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Quitar
                  </Button>
                )}
              </div>
              {voucherForm.voucher_photo_url && (
                <div className="mt-2 relative">
                  <img src={voucherForm.voucher_photo_url} alt="Vale" className="w-full max-h-48 object-contain rounded-sm border" />
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>

            {/* Invoice photo */}
            <div className="space-y-2">
              <Label className="input-label">Foto de la Factura</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => invoiceCameraInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                  Tomar Foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => invoiceFileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Seleccionar
                </Button>
                {voucherForm.invoice_photo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setVoucherForm({ ...voucherForm, invoice_photo_url: '' })}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Quitar
                  </Button>
                )}
              </div>
              {voucherForm.invoice_photo_url && (
                <div className="mt-2 relative">
                  <img src={voucherForm.invoice_photo_url} alt="Factura" className="w-full max-h-48 object-contain rounded-sm border" />
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetVoucherForm(); setShowVoucherDialog(false); }}>Cancelar</Button>
            <Button 
              className="btn-action" 
              onClick={handleSaveVoucher}
              disabled={!voucherForm.voucher_number || !voucherForm.vehicle_id || !voucherForm.provider || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingVoucher ? 'Actualizar Vale' : 'Crear Vale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={(open) => { if (!open) resetLoadForm(); setShowLoadDialog(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {editingLoad ? 'Editar Carga de Combustible' : 'Registrar Carga de Combustible'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Vehículo *</Label>
                <Select value={loadForm.vehicle_id} onValueChange={(v) => setLoadForm({ ...loadForm, vehicle_id: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.filter(v => v.vehicle_type === 'tracto').map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.plate} - {v.brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Vale (Opcional)</Label>
                <Select value={loadForm.voucher_id || "none"} onValueChange={(v) => setLoadForm({ ...loadForm, voucher_id: v === "none" ? "" : v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Sin vale" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vale</SelectItem>
                    {vouchers.filter(v => !v.is_used).map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.voucher_number} - {v.provider}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Litros *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={loadForm.liters}
                  onChange={(e) => setLoadForm({ ...loadForm, liters: e.target.value })}
                  className="rounded-sm"
                  placeholder="50.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Precio/Litro *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={loadForm.price_per_liter}
                  onChange={(e) => setLoadForm({ ...loadForm, price_per_liter: e.target.value })}
                  className="rounded-sm"
                  placeholder="15.50"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Total</Label>
                <Input
                  value={`S/ ${((parseFloat(loadForm.liters) || 0) * (parseFloat(loadForm.price_per_liter) || 0)).toFixed(2)}`}
                  disabled
                  className="rounded-sm bg-slate-50 font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Odómetro (km) *</Label>
                <Input
                  type="number"
                  value={loadForm.odometer}
                  onChange={(e) => setLoadForm({ ...loadForm, odometer: e.target.value })}
                  className="rounded-sm"
                  placeholder="125000"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Proveedor/Grifo</Label>
                <Input
                  value={loadForm.provider}
                  onChange={(e) => setLoadForm({ ...loadForm, provider: e.target.value })}
                  className="rounded-sm"
                  placeholder="Repsol Km 45"
                />
              </div>
            </div>
            
            {/* Invoice number */}
            <div className="space-y-2">
              <Label className="input-label">Número de Factura</Label>
              <Input
                value={loadForm.invoice_number}
                onChange={(e) => setLoadForm({ ...loadForm, invoice_number: e.target.value })}
                className="rounded-sm"
                placeholder="F001-12345"
              />
            </div>

            {/* Voucher photo */}
            <div className="space-y-2">
              <Label className="input-label">Foto del Vale</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => voucherCameraInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                  Tomar Foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => voucherFileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Seleccionar
                </Button>
                {loadForm.voucher_photo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setLoadForm({ ...loadForm, voucher_photo_url: '' })}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Quitar
                  </Button>
                )}
              </div>
              {loadForm.voucher_photo_url && (
                <div className="mt-2 relative">
                  <img src={loadForm.voucher_photo_url} alt="Vale" className="w-full max-h-48 object-contain rounded-sm border" />
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>

            {/* Invoice photo */}
            <div className="space-y-2">
              <Label className="input-label">Foto de la Factura</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => invoiceCameraInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                  Tomar Foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => invoiceFileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Seleccionar
                </Button>
                {loadForm.invoice_photo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setLoadForm({ ...loadForm, invoice_photo_url: '' })}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Quitar
                  </Button>
                )}
              </div>
              {loadForm.invoice_photo_url && (
                <div className="mt-2 relative">
                  <img src={loadForm.invoice_photo_url} alt="Factura" className="w-full max-h-48 object-contain rounded-sm border" />
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetLoadForm(); setShowLoadDialog(false); }}>Cancelar</Button>
            <Button 
              className="btn-action" 
              onClick={handleSaveLoad}
              disabled={!loadForm.vehicle_id || !loadForm.liters || !loadForm.price_per_liter || !loadForm.odometer || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingLoad ? 'Actualizar Carga' : 'Registrar Carga'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FuelPage;
