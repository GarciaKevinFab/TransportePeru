import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2, Plus, Trash2, Circle, CircleDot } from 'lucide-react';
import { AXLE_TYPES, AXLE_TYPE_META } from './tireSchema';

// Editable dialog for a vehicle's axle configuration.
// Emits an array of { name, type, dual, is_spare } to onSave.
const AxleConfigDialog = ({ open, onOpenChange, initialAxles, saving, onSave }) => {
  const [axles, setAxles] = useState([]);

  useEffect(() => {
    if (open) {
      setAxles(
        (initialAxles && initialAxles.length ? initialAxles : []).map((a) => ({ ...a }))
      );
    }
  }, [open, initialAxles]);

  const realAxles = useMemo(() => axles.filter((a) => !a.is_spare), [axles]);
  const spares = useMemo(() => axles.filter((a) => a.is_spare), [axles]);

  const updateAt = (globalIdx, patch) => {
    setAxles((prev) => prev.map((a, i) => (i === globalIdx ? { ...a, ...patch } : a)));
  };

  const removeAt = (globalIdx) => {
    setAxles((prev) => prev.filter((_, i) => i !== globalIdx));
  };

  const addAxle = () => {
    const count = axles.filter((a) => !a.is_spare).length + 1;
    setAxles((prev) => {
      // Insert the new axle after the last non-spare axle (keep spares last).
      const lastRealIdx = prev.map((a) => a.is_spare).lastIndexOf(false);
      const newAxle = { name: `Eje ${count}`, type: 'traccion', dual: false, is_spare: false };
      const next = [...prev];
      next.splice(lastRealIdx + 1, 0, newAxle);
      return next;
    });
  };

  const addSpare = () => {
    const count = axles.filter((a) => a.is_spare).length + 1;
    setAxles((prev) => [
      ...prev,
      {
        name: count === 1 ? 'Repuesto' : `Repuesto ${count}`,
        type: 'muerto',
        dual: false,
        is_spare: true,
      },
    ]);
  };

  const canSave = realAxles.length >= 1;

  const handleSave = () => {
    if (!canSave) return;
    // Persist in a stable order: real axles first, spares last.
    const normalized = [...realAxles, ...spares].map((a) => ({
      name: a.name || '',
      type: AXLE_TYPES.includes(a.type) ? a.type : 'traccion',
      dual: !!a.dual,
      is_spare: !!a.is_spare,
    }));
    onSave(normalized);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading font-bold uppercase">
            Configurar Ejes
          </DialogTitle>
          <DialogDescription>
            Define cada eje: su tipo y si lleva rueda doble (dual) o balón (super single).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Real axles */}
          <div className="space-y-3">
            {realAxles.map((axle) => {
              const globalIdx = axles.indexOf(axle);
              return (
                <div
                  key={globalIdx}
                  className="rounded-md border border-grafito-200 p-3 bg-grafito-50"
                  data-testid={`axle-config-row-${globalIdx}`}
                >
                  <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="input-label">Nombre</Label>
                      <Input
                        value={axle.name}
                        onChange={(e) => updateAt(globalIdx, { name: e.target.value })}
                        className="rounded-sm"
                        placeholder={`Eje ${realAxles.indexOf(axle) + 1}`}
                      />
                    </div>
                    <div className="w-full md:w-48 space-y-1">
                      <Label className="input-label">Tipo</Label>
                      <Select
                        value={axle.type}
                        onValueChange={(v) => updateAt(globalIdx, { type: v })}
                      >
                        <SelectTrigger className="rounded-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AXLE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {AXLE_TYPE_META[t].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between md:justify-start gap-3 pb-1">
                      <div className="flex items-center gap-2">
                        {axle.dual ? (
                          <CircleDot className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Circle className="w-4 h-4 text-grafito-500" />
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-grafito-500">Balón</span>
                          <Switch
                            checked={axle.dual}
                            onCheckedChange={(v) => updateAt(globalIdx, { dual: v })}
                            data-testid={`axle-dual-switch-${globalIdx}`}
                          />
                          <span className="text-xs font-medium text-grafito-700">Dual</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAt(globalIdx)}
                        disabled={realAxles.length <= 1}
                        title={realAxles.length <= 1 ? 'Debe haber al menos 1 eje' : 'Quitar eje'}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" onClick={addAxle} data-testid="add-axle-btn">
              <Plus className="w-4 h-4 mr-2" />
              Añadir eje
            </Button>
          </div>

          {/* Spares */}
          <div className="space-y-2 pt-2 border-t border-dashed border-grafito-300">
            <Label className="input-label">Repuestos</Label>
            {spares.length === 0 && (
              <p className="text-xs text-grafito-400">Sin repuestos configurados.</p>
            )}
            {spares.map((sp) => {
              const globalIdx = axles.indexOf(sp);
              return (
                <div key={globalIdx} className="flex items-center gap-2">
                  <Input
                    value={sp.name}
                    onChange={(e) => updateAt(globalIdx, { name: e.target.value })}
                    className="rounded-sm flex-1"
                    placeholder="Repuesto"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAt(globalIdx)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={addSpare}>
              <Plus className="w-4 h-4 mr-2" />
              Añadir repuesto
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="btn-action"
            onClick={handleSave}
            disabled={!canSave || saving}
            data-testid="save-axle-config-btn"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar configuración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AxleConfigDialog;
