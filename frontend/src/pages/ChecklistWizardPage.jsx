import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tripsApi, vehiclesApi } from '../services/api';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Camera,
  MapPin,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Pen,
  Truck,
  CircleDot,
  Save,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import SignatureCanvas from 'react-signature-canvas';
import { useOffline } from '../hooks/useOffline';

// Checklist por defecto cuando el tenant todavia no tiene plantilla propia.
// Vive a nivel de modulo (y no dentro del componente) porque fetchData lo lee:
// recrear el array en cada render daria una dependencia nueva cada vez y el
// useCallback de fetchData no se estabilizaria nunca.
const defaultChecklistItems = [
  { id: '1', category: 'Documentación', item: 'SOAT vigente', requires_photo: false, is_critical: true },
  { id: '2', category: 'Documentación', item: 'Revisión técnica vigente', requires_photo: false, is_critical: true },
  { id: '3', category: 'Documentación', item: 'Tarjeta de circulación', requires_photo: false, is_critical: true },
  { id: '4', category: 'Cabina', item: 'Luces frontales funcionan', requires_photo: false, is_critical: true },
  { id: '5', category: 'Cabina', item: 'Luces traseras funcionan', requires_photo: false, is_critical: true },
  { id: '6', category: 'Cabina', item: 'Luces direccionales funcionan', requires_photo: false, is_critical: false },
  { id: '7', category: 'Cabina', item: 'Limpiaparabrisas funciona', requires_photo: false, is_critical: false },
  { id: '8', category: 'Cabina', item: 'Claxon funciona', requires_photo: false, is_critical: false },
  { id: '9', category: 'Cabina', item: 'Espejos en buen estado', requires_photo: false, is_critical: false },
  { id: '10', category: 'Motor', item: 'Nivel de aceite OK', requires_photo: false, is_critical: true },
  { id: '11', category: 'Motor', item: 'Nivel de refrigerante OK', requires_photo: false, is_critical: true },
  { id: '12', category: 'Motor', item: 'Sin fugas visibles', requires_photo: true, is_critical: true },
  { id: '13', category: 'Frenos', item: 'Freno de servicio funciona', requires_photo: false, is_critical: true },
  { id: '14', category: 'Frenos', item: 'Freno de estacionamiento funciona', requires_photo: false, is_critical: true },
  { id: '15', category: 'Llantas', item: 'Estado general de llantas', requires_photo: true, is_critical: true },
  { id: '16', category: 'Llantas', item: 'Presión de aire correcta', requires_photo: false, is_critical: true },
  { id: '17', category: 'Seguridad', item: 'Extintor presente y vigente', requires_photo: false, is_critical: true },
  { id: '18', category: 'Seguridad', item: 'Triángulos de seguridad', requires_photo: false, is_critical: false },
  { id: '19', category: 'Seguridad', item: 'Botiquín completo', requires_photo: false, is_critical: false },
  { id: '20', category: 'Carrocería', item: 'Sin daños visibles', requires_photo: true, is_critical: false },
];

const ChecklistWizardPage = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const signatureRef = useRef(null);
  const { saveChecklistOffline } = useOffline();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trip, setTrip] = useState(null);
  const [tracto, setTracto] = useState(null);
  const [carreta, setCarreta] = useState(null);
  const [checklistTemplate, setChecklistTemplate] = useState(null);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState([]);
  const [tireChecks, setTireChecks] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [signature, setSignature] = useState(null);
  const [location, setLocation] = useState(null);
  const [kmStart, setKmStart] = useState('');
  const [notes, setNotes] = useState('');

  const steps = [
    { id: 'info', title: 'Información', icon: Truck },
    { id: 'checklist', title: 'Inspección', icon: CheckCircle },
    { id: 'tires', title: 'Llantas', icon: CircleDot },
    { id: 'photos', title: 'Fotos', icon: Camera },
    { id: 'signature', title: 'Firma', icon: Pen },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tripRes = await tripsApi.getById(tripId);
      setTrip(tripRes.data);
      
      if (tripRes.data.tracto_id) {
        const tractoRes = await vehiclesApi.getById(tripRes.data.tracto_id);
        setTracto(tractoRes.data);
        setKmStart(tractoRes.data.odometer?.toString() || '');
      }
      
      if (tripRes.data.carreta_id) {
        const carretaRes = await vehiclesApi.getById(tripRes.data.carreta_id);
        setCarreta(carretaRes.data);
      }
      
      // Try to get checklist template
      try {
        const templatesRes = await api.get('/checklist-templates');
        if (templatesRes.data.length > 0) {
          setChecklistTemplate(templatesRes.data[0]);
          // Initialize responses from template
          const items = templatesRes.data[0].items || defaultChecklistItems;
          setResponses(items.map(item => ({
            item_id: item.id,
            item: item.item,
            category: item.category,
            is_critical: item.is_critical,
            status: 'pending', // pending, ok, observado, critico
            notes: '',
            photo_url: null,
          })));
        } else {
          // Use default items
          setResponses(defaultChecklistItems.map(item => ({
            item_id: item.id,
            item: item.item,
            category: item.category,
            is_critical: item.is_critical,
            status: 'pending',
            notes: '',
            photo_url: null,
          })));
        }
      } catch (e) {
        // Use default items
        setResponses(defaultChecklistItems.map(item => ({
          item_id: item.id,
          item: item.item,
          category: item.category,
          is_critical: item.is_critical,
          status: 'pending',
          notes: '',
          photo_url: null,
        })));
      }
      
      // Initialize tire checks (6 positions for tracto)
      setTireChecks([
        { position: 'EJE1-IZQ', pressure: '', depth: '', status: 'ok', notes: '' },
        { position: 'EJE1-DER', pressure: '', depth: '', status: 'ok', notes: '' },
        { position: 'EJE2-IZQ-EXT', pressure: '', depth: '', status: 'ok', notes: '' },
        { position: 'EJE2-IZQ-INT', pressure: '', depth: '', status: 'ok', notes: '' },
        { position: 'EJE2-DER-INT', pressure: '', depth: '', status: 'ok', notes: '' },
        { position: 'EJE2-DER-EXT', pressure: '', depth: '', status: 'ok', notes: '' },
      ]);
      
    } catch (error) {
      toast.error('Error al cargar datos del viaje');
      navigate('/trips');
    }
    setLoading(false);
  }, [tripId, navigate]);

  // Mismo disparo que antes: fetchData solo cambia de identidad si cambia el
  // tripId de la URL (navigate es estable en react-router), asi que esto sigue
  // siendo "cargar el viaje una vez y recargar si cambia el id".
  useEffect(() => {
    fetchData();
    // Get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => console.error('Location error:', err)
      );
    }
  }, [fetchData]);

  const handleResponseChange = (index, field, value) => {
    const newResponses = [...responses];
    newResponses[index] = { ...newResponses[index], [field]: value };
    setResponses(newResponses);
  };

  const handleTireCheckChange = (index, field, value) => {
    const newTireChecks = [...tireChecks];
    newTireChecks[index] = { ...newTireChecks[index], [field]: value };
    setTireChecks(newTireChecks);
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
    setSignature(null);
  };

  const handleSaveSignature = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      setSignature(signatureRef.current.toDataURL());
      toast.success('Firma guardada');
    } else {
      toast.error('Por favor, firme antes de guardar');
    }
  };

  const calculateResult = () => {
    const hasCritical = responses.some(r => r.is_critical && r.status === 'critico');
    const hasObservado = responses.some(r => r.status === 'observado' || r.status === 'critico');
    
    if (hasCritical) return 'critico';
    if (hasObservado) return 'observado';
    return 'ok';
  };

  const handleSubmit = async () => {
    // Validate
    const pendingItems = responses.filter(r => r.status === 'pending');
    if (pendingItems.length > 0) {
      toast.error(`Faltan ${pendingItems.length} items por revisar`);
      return;
    }
    
    if (!signature) {
      toast.error('Debe firmar el checklist');
      setCurrentStep(4);
      return;
    }
    
    if (!kmStart) {
      toast.error('Debe ingresar el kilometraje inicial');
      setCurrentStep(0);
      return;
    }
    
    setSaving(true);
    const result = calculateResult();
    const payload = {
      responses: responses,
      tire_checks: tireChecks,
      signature_url: signature,
      location: location,
      km_start: parseInt(kmStart),
      notes: notes,
      result: result,
    };

    // Offline path
    if (!navigator.onLine) {
      const ok = await saveChecklistOffline(tripId, payload, localStorage.getItem('access_token'));
      if (ok) {
        toast.success('Guardado offline. Se enviará al reconectar');
        navigate('/trips');
      } else {
        toast.error('No se pudo guardar offline');
      }
      setSaving(false);
      return;
    }

    try {
      await api.post(`/trip/${tripId}/checklist`, payload);

      toast.success(
        result === 'ok'
          ? '✅ Checklist aprobado. Viaje listo para iniciar.'
          : result === 'observado'
          ? '⚠️ Checklist con observaciones registrado.'
          : '❌ Checklist crítico. Se creó incidencia automática.'
      );

      navigate('/trips');
    } catch (error) {
      const isNetworkErr = !error.response;
      if (isNetworkErr) {
        const ok = await saveChecklistOffline(tripId, payload, localStorage.getItem('access_token'));
        if (ok) {
          toast.success('Guardado offline. Se enviará al reconectar');
          navigate('/trips');
        } else {
          toast.error('No se pudo guardar offline');
        }
      } else {
        toast.error(error.response?.data?.detail || 'Error al enviar checklist');
      }
    }
    setSaving(false);
  };

  const progress = Math.round(((currentStep + 1) / steps.length) * 100);
  const completedItems = responses.filter(r => r.status !== 'pending').length;
  const totalItems = responses.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Group responses by category
  const groupedResponses = responses.reduce((acc, resp, idx) => {
    const cat = resp.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ ...resp, index: idx });
    return acc;
  }, {});

  return (
    <div className="space-y-6 pb-20" data-testid="checklist-wizard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-900">
            Checklist Pre-Viaje
          </h1>
          <p className="text-slate-500 mt-1">
            {tracto?.plate} {carreta ? `+ ${carreta.plate}` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/trips')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
      </div>

      {/* Progress */}
      <Card className="bg-white">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold uppercase text-slate-500">Progreso</span>
            <span className="text-sm font-bold">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-4">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStep;
              const isCompleted = idx < currentStep;
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(idx)}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    isActive ? 'text-orange-600' : isCompleted ? 'text-green-600' : 'text-slate-400'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    isActive ? 'border-orange-600 bg-orange-50' : isCompleted ? 'border-green-600 bg-green-50' : 'border-slate-300'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold uppercase">{step.title}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card className="bg-white min-h-[400px]">
        <CardContent className="py-6">
          {/* Step 0: Info */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <h2 className="font-heading text-xl font-bold uppercase">Información del Viaje</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-sm">
                  <p className="text-xs uppercase text-slate-500 font-bold">Tracto</p>
                  <p className="font-mono text-xl font-bold mt-1">{tracto?.plate}</p>
                  <p className="text-sm text-slate-500">{tracto?.brand} {tracto?.model}</p>
                </div>
                {carreta && (
                  <div className="p-4 bg-slate-50 rounded-sm">
                    <p className="text-xs uppercase text-slate-500 font-bold">Carreta</p>
                    <p className="font-mono text-xl font-bold mt-1">{carreta?.plate}</p>
                    <p className="text-sm text-slate-500">{carreta?.brand}</p>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="input-label">Kilometraje Inicial *</label>
                  <Input
                    type="number"
                    value={kmStart}
                    onChange={(e) => setKmStart(e.target.value)}
                    className="rounded-sm text-xl font-mono"
                    placeholder={tracto?.odometer?.toString() || '0'}
                  />
                </div>
                <div className="p-4 bg-blue-50 rounded-sm">
                  <p className="text-xs uppercase text-blue-700 font-bold flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Ubicación
                  </p>
                  {location ? (
                    <p className="font-mono text-sm mt-1">
                      {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </p>
                  ) : (
                    <p className="text-sm text-blue-600 mt-1">Obteniendo ubicación...</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="input-label">Notas adicionales</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-sm"
                  rows={3}
                  placeholder="Observaciones generales..."
                />
              </div>
            </div>
          )}

          {/* Step 1: Checklist */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-bold uppercase">Inspección</h2>
                <Badge variant="outline">
                  {completedItems}/{totalItems} completados
                </Badge>
              </div>
              
              {Object.entries(groupedResponses).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <h3 className="font-bold text-sm uppercase text-slate-500 border-b pb-1">
                    {category}
                  </h3>
                  {items.map((resp) => (
                    <div 
                      key={resp.index}
                      className={`p-3 rounded-sm border-l-4 ${
                        resp.status === 'ok' ? 'bg-green-50 border-green-500' :
                        resp.status === 'observado' ? 'bg-yellow-50 border-yellow-500' :
                        resp.status === 'critico' ? 'bg-red-50 border-red-500' :
                        'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {resp.is_critical && (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className="font-medium">{resp.item}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={resp.status === 'ok' ? 'default' : 'outline'}
                            className={resp.status === 'ok' ? 'bg-green-600 hover:bg-green-700' : ''}
                            onClick={() => handleResponseChange(resp.index, 'status', 'ok')}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={resp.status === 'observado' ? 'default' : 'outline'}
                            className={resp.status === 'observado' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                            onClick={() => handleResponseChange(resp.index, 'status', 'observado')}
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={resp.status === 'critico' ? 'default' : 'outline'}
                            className={resp.status === 'critico' ? 'bg-red-600 hover:bg-red-700' : ''}
                            onClick={() => handleResponseChange(resp.index, 'status', 'critico')}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {(resp.status === 'observado' || resp.status === 'critico') && (
                        <Input
                          className="mt-2 rounded-sm"
                          placeholder="Describa el problema..."
                          value={resp.notes}
                          onChange={(e) => handleResponseChange(resp.index, 'notes', e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Step 2: Tires */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="font-heading text-xl font-bold uppercase">Inspección de Llantas</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {tireChecks.map((tire, idx) => (
                  <Card key={idx} className={`${
                    tire.status === 'ok' ? 'border-green-300 bg-green-50' :
                    tire.status === 'observado' ? 'border-yellow-300 bg-yellow-50' :
                    'border-red-300 bg-red-50'
                  }`}>
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm font-mono">{tire.position}</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 px-3 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="PSI"
                          className="rounded-sm text-sm"
                          value={tire.pressure}
                          onChange={(e) => handleTireCheckChange(idx, 'pressure', e.target.value)}
                        />
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="mm"
                          className="rounded-sm text-sm"
                          value={tire.depth}
                          onChange={(e) => handleTireCheckChange(idx, 'depth', e.target.value)}
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={tire.status === 'ok' ? 'default' : 'outline'}
                          className={`flex-1 ${tire.status === 'ok' ? 'bg-green-600' : ''}`}
                          onClick={() => handleTireCheckChange(idx, 'status', 'ok')}
                        >
                          OK
                        </Button>
                        <Button
                          size="sm"
                          variant={tire.status === 'observado' ? 'default' : 'outline'}
                          className={`flex-1 ${tire.status === 'observado' ? 'bg-yellow-600' : ''}`}
                          onClick={() => handleTireCheckChange(idx, 'status', 'observado')}
                        >
                          OBS
                        </Button>
                        <Button
                          size="sm"
                          variant={tire.status === 'critico' ? 'default' : 'outline'}
                          className={`flex-1 ${tire.status === 'critico' ? 'bg-red-600' : ''}`}
                          onClick={() => handleTireCheckChange(idx, 'status', 'critico')}
                        >
                          CRIT
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Photos */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="font-heading text-xl font-bold uppercase">Fotografías</h2>
              <p className="text-slate-500">
                Tome fotos del vehículo antes de iniciar el viaje. Mínimo: frente, lateral y trasera.
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['Frente', 'Lateral Izq.', 'Lateral Der.', 'Trasera', 'Motor', 'Carga', 'Documentos', 'Otros'].map((label, idx) => (
                  <div 
                    key={idx}
                    className="aspect-square border-2 border-dashed border-slate-300 rounded-sm flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <Camera className="w-8 h-8 text-slate-400" />
                    <span className="text-sm text-slate-500 mt-2">{label}</span>
                    <span className="text-xs text-slate-400">Tomar foto</span>
                  </div>
                ))}
              </div>
              
              <p className="text-sm text-slate-400 text-center">
                * La funcionalidad de cámara requiere dispositivo móvil con PWA instalada
              </p>
            </div>
          )}

          {/* Step 4: Signature */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h2 className="font-heading text-xl font-bold uppercase">Firma del Chofer</h2>
              <p className="text-slate-500">
                Firme en el recuadro para confirmar que ha realizado la inspección.
              </p>
              
              <div className="border-2 border-slate-300 rounded-sm bg-white">
                <SignatureCanvas
                  ref={signatureRef}
                  canvasProps={{
                    className: 'w-full h-48',
                    style: { width: '100%', height: '200px' }
                  }}
                  backgroundColor="white"
                />
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClearSignature}>
                  Limpiar
                </Button>
                <Button className="btn-action" onClick={handleSaveSignature}>
                  {signature ? <CheckCircle className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {signature ? 'Firma Guardada' : 'Guardar Firma'}
                </Button>
              </div>
              
              {signature && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-sm">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-bold">Firma registrada correctamente</span>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="mt-6 p-4 bg-slate-50 rounded-sm">
                <h3 className="font-bold uppercase text-sm text-slate-500 mb-2">Resumen</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {responses.filter(r => r.status === 'ok').length}
                    </p>
                    <p className="text-xs uppercase text-slate-500">OK</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">
                      {responses.filter(r => r.status === 'observado').length}
                    </p>
                    <p className="text-xs uppercase text-slate-500">Observados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      {responses.filter(r => r.status === 'critico').length}
                    </p>
                    <p className="text-xs uppercase text-slate-500">Críticos</p>
                  </div>
                </div>
                
                {calculateResult() === 'critico' && (
                  <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-sm">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-bold">
                        HAY ITEMS CRÍTICOS. Se creará una incidencia automática y el viaje NO podrá iniciarse.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Anterior
        </Button>
        
        {currentStep < steps.length - 1 ? (
          <Button
            className="btn-action"
            onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
          >
            Siguiente
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            className="btn-action bg-green-600 hover:bg-green-700"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <CheckCircle className="w-4 h-4 mr-2" />
            Enviar Checklist
          </Button>
        )}
      </div>
    </div>
  );
};

export default ChecklistWizardPage;
