import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { tiresApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { ArrowLeft, Loader2, CircleDot, Download, RefreshCw, Recycle } from 'lucide-react';
import { toast } from 'sonner';

const POSITION_LABELS = {
  direccional: 'Direccional',
  traccion: 'Tracción',
  toda_posicion: 'Toda posición',
  mixto: 'Mixto',
};

const positionLabel = (value) => POSITION_LABELS[value] || value || 'Sin definir';

const TireDimensionReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await tiresApi.getRequiredReport();
      setReport(res.data);
    } catch (error) {
      toast.error('Error al cargar el reporte de llantas requeridas');
      setReport(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, []);

  // Flatten the grouped-by-dimension response into a single list of tires,
  // tagging each with the action the backend assigned it.
  const flatTires = useMemo(() => {
    if (!report) return [];
    const out = [];
    const collect = (grouped, action) => {
      Object.values(grouped || {}).forEach((tires) => {
        (tires || []).forEach((t) => out.push({ ...t, action }));
      });
    };
    collect(report.replace_needed, 'replace');
    collect(report.retread_needed, 'retread');
    return out;
  }, [report]);

  // Aggregate by (dimension, position_type).
  const aggregatedRows = useMemo(() => {
    const map = new Map();
    flatTires.forEach((t) => {
      const dimension = t.dimension || 'Desconocida';
      const posType = t.position_type || 'toda_posicion';
      const key = `${dimension}||${posType}`;
      if (!map.has(key)) {
        map.set(key, { dimension, posType, replace: 0, retread: 0 });
      }
      const row = map.get(key);
      if (t.action === 'replace') row.replace += 1;
      else if (t.action === 'retread') row.retread += 1;
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.dimension === b.dimension) return a.posType.localeCompare(b.posType);
      return a.dimension.localeCompare(b.dimension);
    });
  }, [flatTires]);

  const totalReplace = report?.total_replace ?? 0;
  const totalRetread = report?.total_retread ?? 0;

  const handleExportCsv = () => {
    if (aggregatedRows.length === 0) {
      toast.info('No hay datos para exportar');
      return;
    }
    const header = ['Dimension', 'Tipo de posicion', 'Reemplazar', 'Reencauchar'];
    const lines = aggregatedRows.map((r) => [
      r.dimension,
      positionLabel(r.posType),
      r.replace,
      r.retread,
    ]);
    lines.push(['TOTAL', '', totalReplace, totalRetread]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'llantas_requeridas_por_dimension.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tire-dimension-report-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          data-testid="tire-dimension-report-back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Llantas Requeridas por Dimensión
          </h1>
          <p className="text-slate-500 mt-1">
            Necesidades de reemplazo y reencauche agregadas a nivel de flota
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchReport}
          data-testid="tire-dimension-report-refresh-btn"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
        <Button
          className="btn-action"
          onClick={handleExportCsv}
          disabled={aggregatedRows.length === 0}
          data-testid="tire-dimension-report-export-btn"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-red-50">
                <RefreshCw className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Total a Reemplazar</p>
                <p className="font-heading text-2xl font-bold text-slate-900 font-mono">
                  {totalReplace}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-yellow-50">
                <Recycle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Total a Reencauchar</p>
                <p className="font-heading text-2xl font-bold text-slate-900 font-mono">
                  {totalRetread}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aggregated table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
            Resumen por Dimensión y Tipo de Posición
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aggregatedRows.length === 0 ? (
            <div className="text-center py-8 text-slate-400" data-testid="tire-dimension-report-empty">
              <CircleDot className="w-12 h-12 mx-auto mb-2" />
              <p>No hay llantas que requieran reemplazo o reencauche</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dimensión</TableHead>
                    <TableHead>Tipo de posición</TableHead>
                    <TableHead className="text-right">Reemplazar</TableHead>
                    <TableHead className="text-right">Reencauchar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregatedRows.map((row) => (
                    <TableRow key={`${row.dimension}-${row.posType}`}>
                      <TableCell className="font-mono font-medium">{row.dimension}</TableCell>
                      <TableCell>{positionLabel(row.posType)}</TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {row.replace || '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-yellow-600">
                        {row.retread || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-slate-300 font-bold">
                    <TableCell colSpan={2}>TOTAL</TableCell>
                    <TableCell className="text-right text-red-600">{totalReplace}</TableCell>
                    <TableCell className="text-right text-yellow-600">{totalRetread}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed section */}
      {flatTires.length > 0 && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-widest">
              Informe Detallado por Llanta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serie</TableHead>
                    <TableHead>Marca / Modelo</TableHead>
                    <TableHead>Dimensión</TableHead>
                    <TableHead>Tipo de posición</TableHead>
                    <TableHead>Posición actual</TableHead>
                    <TableHead className="text-right">Prof. (mm)</TableHead>
                    <TableHead>Vida</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flatTires.map((t) => (
                    <TableRow key={`${t.id}-${t.action}`}>
                      <TableCell className="font-mono font-medium">{t.serial}</TableCell>
                      <TableCell>
                        {t.brand} {t.model || ''}
                      </TableCell>
                      <TableCell className="font-mono">{t.dimension}</TableCell>
                      <TableCell>{positionLabel(t.position_type)}</TableCell>
                      <TableCell>{t.current_position || '-'}</TableCell>
                      <TableCell className="text-right font-mono">
                        {t.last_depth != null ? Number(t.last_depth).toFixed(1) : '-'}
                      </TableCell>
                      <TableCell>
                        {t.life_number === 1 ? 'Nueva' : `R${(t.life_number || 1) - 1}`}
                      </TableCell>
                      <TableCell>
                        {t.action === 'replace' ? (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            Reemplazar
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                            Reencauchar
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TireDimensionReportPage;
