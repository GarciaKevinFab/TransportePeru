import React, { useState, useEffect, useRef } from 'react';
import { fuelApi, vehiclesApi, tripsApi } from '../services/api';
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
  });

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vouchersRes, loadsRes, kpisRes, vehiclesRes, tripsRes] = await Promise.all([
        fuelApi.getVouchers(),
        fuelApi.getLoads(),
        fuelApi.getKpis(),
        vehiclesApi.getAll(),
        tripsApi.getAll(),
      ]);
      setVouchers(vouchersRes.data);
      setLoads(loadsRes.data);
      setKpis(kpisRes.data);
      setVehicles(vehiclesRes.data);
      setTrips(tripsRes.data.filter(t => t.status === 'en_curso' || t.status === 'programado'));
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
        photo_url: capturedPhoto || voucherForm.photo_url,
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
        photo_url: capturedPhoto || loadForm.photo_url,
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

  const totalLiters = loads.reduce((sum, l) => sum + (l.liters || 0), 0);
  const totalAmount = loads.reduce((sum, l) => sum + (l.total_amount || 0), 0);
  const activeVouchers = vouchers.filter(v => !v.is_used).length;
  const avgPrice = totalLiters > 0 ? totalAmount / totalLiters : 0;

  return (
    <div className="space-y-6" data-testid="fuel-page">
      {/* Hidden file inputs */}
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { resetVoucherForm(); setShowVoucherDialog(true); }}>
            <Ticket className="w-4 h-4 mr-2" />
            Nuevo Vale
          </Button>
          <Button className="btn-action" onClick={() => { resetLoadForm(); setShowLoadDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Registrar Carga
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-blue-500">
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
        <Card className="bg-white border-l-4 border-l-green-500">
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
        <Card className="bg-white border-l-4 border-l-orange-500">
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
        <Card className="bg-white border-l-4 border-l-slate-500">
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
          <Card className="bg-white">
            <CardContent className="p-0">
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
                          {voucher.photo_url ? (
                            <Button size="sm" variant="ghost" onClick={() => window.open(voucher.photo_url, '_blank')}>
                              <Image className="w-4 h-4 text-blue-500" />
                            </Button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
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
          <Card className="bg-white">
            <CardContent className="p-0">
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
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Litros</TableHead>
                      <TableHead>Precio/L</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Odómetro</TableHead>
                      <TableHead>Foto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loads.map((load) => (
                      <TableRow key={load.id} className="table-dense">
                        <TableCell className="text-sm">
                          {format(new Date(load.load_date || load.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell className="font-mono">{getVehiclePlate(load.vehicle_id)}</TableCell>
                        <TableCell>{load.provider || '-'}</TableCell>
                        <TableCell className="font-bold">{load.liters?.toFixed(2)}</TableCell>
                        <TableCell>S/ {load.price_per_liter?.toFixed(2)}</TableCell>
                        <TableCell className="font-bold text-green-600">S/ {load.total_amount?.toFixed(2)}</TableCell>
                        <TableCell>{load.odometer?.toLocaleString()} km</TableCell>
                        <TableCell>
                          {load.photo_url ? (
                            <Button size="sm" variant="ghost" onClick={() => window.open(load.photo_url, '_blank')}>
                              <Image className="w-4 h-4 text-blue-500" />
                            </Button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
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
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Voucher Dialog */}
      <Dialog open={showVoucherDialog} onOpenChange={(open) => { if (!open) resetVoucherForm(); setShowVoucherDialog(open); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {editingVoucher ? 'Editar Vale de Combustible' : 'Nuevo Vale de Combustible'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
                <Select value={voucherForm.trip_id || ""} onValueChange={(v) => setVoucherForm({ ...voucherForm, trip_id: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asignar</SelectItem>
                    {trips.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.client_name || 'Sin cliente'} - {format(new Date(t.scheduled_date), 'dd/MM')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
            
            {/* Photo capture */}
            <div className="space-y-2">
              <Label className="input-label">Foto del Vale</Label>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                  Tomar Foto
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Seleccionar
                </Button>
                {capturedPhoto && (
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={handleExtractDataFromPhoto}
                    disabled={uploadingPhoto}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700"
                  >
                    {uploadingPhoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                    Extraer Datos
                  </Button>
                )}
              </div>
              {capturedPhoto && (
                <div className="mt-2 relative">
                  <img src={capturedPhoto} alt="Vale" className="w-full max-h-48 object-contain rounded-sm border" />
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {editingLoad ? 'Editar Carga de Combustible' : 'Registrar Carga de Combustible'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
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
                <Select value={loadForm.voucher_id || ""} onValueChange={(v) => setLoadForm({ ...loadForm, voucher_id: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue placeholder="Sin vale" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin vale</SelectItem>
                    {vouchers.filter(v => !v.is_used).map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.voucher_number} - {v.provider}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
            
            {/* Photo capture */}
            <div className="space-y-2">
              <Label className="input-label">Foto del Recibo/Grifo</Label>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                  Tomar Foto
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Seleccionar
                </Button>
                {capturedPhoto && (
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={handleExtractDataFromPhoto}
                    disabled={uploadingPhoto}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700"
                  >
                    {uploadingPhoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                    Extraer Datos
                  </Button>
                )}
              </div>
              {capturedPhoto && (
                <div className="mt-2 relative">
                  <img src={capturedPhoto} alt="Recibo" className="w-full max-h-48 object-contain rounded-sm border" />
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
