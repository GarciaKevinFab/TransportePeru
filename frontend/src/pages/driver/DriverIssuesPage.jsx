import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  AlertTriangle,
  Camera,
  Image,
  Check,
  Loader2,
  Send,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';

const ISSUE_TYPES = [
  { value: 'averia', label: 'Avería Mecánica', icon: '🔧' },
  { value: 'accidente', label: 'Accidente', icon: '💥' },
  { value: 'robo', label: 'Robo/Asalto', icon: '🚨' },
  { value: 'neumatico', label: 'Problema de Neumático', icon: '🛞' },
  { value: 'combustible', label: 'Sin Combustible', icon: '⛽' },
  { value: 'documentos', label: 'Problema Documentos', icon: '📄' },
  { value: 'carga', label: 'Problema con Carga', icon: '📦' },
  { value: 'otro', label: 'Otro', icon: '❓' },
];

const DriverIssuesPage = () => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [location, setLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    issue_type: '',
    description: '',
    severity: 'medium',
  });

  const handlePhotoCapture = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedPhotos([...capturedPhotos, e.target.result]);
      toast.success('Foto añadida');
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index) => {
    setCapturedPhotos(capturedPhotos.filter((_, i) => i !== index));
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalización no disponible');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        toast.success('Ubicación obtenida');
        setGettingLocation(false);
      },
      (error) => {
        toast.error('No se pudo obtener ubicación');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async () => {
    if (!formData.issue_type || !formData.description) {
      toast.error('Complete el tipo y descripción del incidente');
      return;
    }

    setSaving(true);
    try {
      // Upload photos
      const photoUrls = [];
      for (const photo of capturedPhotos) {
        const uploadRes = await api.post('/upload/base64', {
          data: photo,
          entity_type: 'issues',
          entity_id: 'driver',
        });
        photoUrls.push(uploadRes.data.url);
      }

      await api.post('/issues', {
        ...formData,
        photos: photoUrls,
        location: location,
        reporter_id: user?.id,
        reporter_name: user?.name,
      });

      toast.success('Incidente reportado correctamente');
      
      // Reset form
      setFormData({
        issue_type: '',
        description: '',
        severity: 'medium',
      });
      setCapturedPhotos([]);
      setLocation(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al reportar');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reportar Incidente</h1>
          <p className="text-sm text-slate-500">Comunica cualquier problema</p>
        </div>
      </div>

      {/* Hidden inputs */}
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

      <Card className="bg-white">
        <CardContent className="p-4 space-y-4">
          {/* Issue Type */}
          <div className="space-y-2">
            <Label>Tipo de Incidente *</Label>
            <div className="grid grid-cols-2 gap-2">
              {ISSUE_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, issue_type: type.value })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formData.issue_type === type.value
                      ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xl mr-2">{type.icon}</span>
                  <span className="text-sm font-medium text-slate-700">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label>Severidad</Label>
            <Select 
              value={formData.severity} 
              onValueChange={(v) => setFormData({ ...formData, severity: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">🟢 Baja - Puedo continuar</SelectItem>
                <SelectItem value="medium">🟡 Media - Necesito asistencia</SelectItem>
                <SelectItem value="high">🔴 Alta - Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descripción *</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe lo que ocurrió..."
              rows={4}
            />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label>Fotos (Opcional)</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                Tomar Foto
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="w-4 h-4" />
              </Button>
            </div>
            {capturedPhotos.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                {capturedPhotos.map((photo, index) => (
                  <div key={index} className="relative flex-shrink-0">
                    <img
                      src={photo}
                      alt={`Foto ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label>Ubicación</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={getLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <MapPin className="w-4 h-4 mr-2" />
              )}
              {location ? 'Ubicación Obtenida ✓' : 'Obtener Ubicación'}
            </Button>
            {location && (
              <p className="text-xs text-slate-500">
                Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button
        className="w-full h-14 bg-red-500 hover:bg-red-600 text-lg font-bold"
        onClick={handleSubmit}
        disabled={saving || !formData.issue_type || !formData.description}
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Send className="w-5 h-5 mr-2" />
            Enviar Reporte
          </>
        )}
      </Button>

      {/* Emergency Contact */}
      <Card className="bg-slate-900 text-white">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-slate-400 mb-2">En caso de emergencia grave</p>
          <Button
            variant="outline"
            className="border-red-500 text-red-400 hover:bg-red-500/20"
          >
            📞 Llamar a Emergencias
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverIssuesPage;
