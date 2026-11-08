import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CreditCard, Download, Loader2, XCircle } from 'lucide-react';
import { suscripcionApi } from '../services/api';
import EncabezadoPagina from '../components/EncabezadoPagina';
import ComprobanteImpreso from '../components/ComprobanteImpreso';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

/**
 * La suscripcion de la empresa: estado, cobros, comprobantes y cancelacion.
 *
 * Mercado Pago devuelve aqui al cliente (back_url con ?aviso=confirmando).
 * Volver NO prueba nada: el plan lo activa el webhook firmado. Por eso esta
 * pantalla pregunta al backend unas cuantas veces hasta ver el cobro, y si no
 * llega lo dice tal cual: "lo estamos confirmando".
 */

const ETIQUETAS = {
  trial: { texto: 'Prueba gratuita', color: 'bg-blue-100 text-blue-800' },
  prueba_vencida: { texto: 'Prueba terminada', color: 'bg-red-100 text-red-800' },
  activa: { texto: 'Activa', color: 'bg-green-100 text-green-800' },
  vencida: { texto: 'Pago pendiente (en gracia)', color: 'bg-amber-100 text-amber-800' },
  suspendida: { texto: 'Suspendida (solo lectura)', color: 'bg-red-100 text-red-800' },
  cancelada: { texto: 'Cancelada (activa hasta el vencimiento)', color: 'bg-grafito-100 text-grafito-800' },
  cancelada_vencida: { texto: 'Cancelada', color: 'bg-grafito-100 text-grafito-800' },
};

const ESTADO_PAGO = { pagado: 'Pagado', fallido: 'Rechazado', devuelto: 'Devuelto' };

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const SuscripcionPage = () => {
  const [params, setParams] = useSearchParams();
  const confirmando = params.get('aviso') === 'confirmando';
  const [datos, setDatos] = useState(null);
  const [esperando, setEsperando] = useState(confirmando);
  const [cancelando, setCancelando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await suscripcionApi.get();
      setDatos(data);
      return data;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo cargar la suscripción');
      return null;
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const primero = await cargar();
      if (!confirmando || !primero) return;
      const antes = (primero.pagos || []).filter((p) => p.estado === 'pagado').length;
      // El aviso de Mercado Pago suele tardar segundos. Se pregunta durante
      // medio minuto; si no llega, el estado se actualizara solo mas tarde.
      for (let i = 0; i < 10 && vivo; i += 1) {
        await new Promise((r) => setTimeout(r, 3000));
        const d = await cargar();
        if (d && (d.pagos || []).filter((p) => p.estado === 'pagado').length > antes) break;
      }
      if (vivo) setEsperando(false);
    })();
    return () => { vivo = false; };
  }, [cargar, confirmando]);

  const cancelar = async () => {
    if (!window.confirm('¿Cancelar la suscripción? Conservas el acceso hasta el fin del periodo pagado y no se vuelve a cobrar.')) return;
    setCancelando(true);
    try {
      await suscripcionApi.cancelar();
      toast.success('Suscripción cancelada. No se volverá a cobrar.');
      await cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo cancelar');
    }
    setCancelando(false);
  };

  const descargar = async (pago) => {
    try {
      const { data } = await suscripcionApi.comprobante(pago.id);
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pago.comp_serie}-${pago.comp_numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo descargar el comprobante');
    }
  };

  if (!datos) {
    return (
      <div className="flex items-center gap-2 p-8 text-grafito-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const etiqueta = ETIQUETAS[datos.efectivo] || { texto: datos.efectivo, color: 'bg-grafito-100 text-grafito-800' };
  const plan = (datos.planes || [])[0];
  const ultimoPagado = (datos.pagos || []).find((p) => p.estado === 'pagado');
  const puedeContratar = !datos.cobro_automatico;

  return (
    <div className="space-y-6 page-fade-in" data-testid="suscripcion-page">
      <EncabezadoPagina titulo="Suscripción" subtitulo="Tu plan, tus cobros y tus comprobantes" />

      {confirmando && (
        <Card className="bg-white">
          <CardContent className="py-5">
            {esperando ? (
              <p className="flex items-center gap-2 text-grafito-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                Estamos confirmando tu pago con Mercado Pago. Puede tardar unos segundos.
              </p>
            ) : ultimoPagado ? (
              <div className="text-center">
                <p className="font-bold text-green-700">Pago confirmado. Tu plan está activo.</p>
                <ComprobanteImpreso orden={{ numero: ultimoPagado.numero, monto: ultimoPagado.monto, descripcion: plan?.descripcion || 'Plan Pro (mensual)' }} />
                <button type="button" className="mt-3 text-sm text-grafito-500 underline" onClick={() => setParams({})}>Cerrar</button>
              </div>
            ) : (
              <p className="text-grafito-700">
                Todavía no recibimos la confirmación de Mercado Pago. Si dejaste tu tarjeta, el plan se activará
                solo en unos minutos; no hace falta volver a pagar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-white">
        <CardContent className="space-y-4 py-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-bold text-grafito-900">Plan {datos.plan}</span>
            <Badge className={etiqueta.color}>{etiqueta.texto}</Badge>
            {datos.cobro_automatico && <Badge className="bg-green-50 text-green-700">Cobro automático con Mercado Pago</Badge>}
          </div>
          <div className="grid gap-2 text-sm text-grafito-600 sm:grid-cols-2">
            {datos.efectivo === 'trial' && datos.trial_ends_at && <p>La prueba termina el <strong>{fecha(datos.trial_ends_at)}</strong>.</p>}
            {datos.vence && <p>Pagado hasta el <strong>{fecha(datos.vence)}</strong>.</p>}
            {datos.efectivo === 'vencida' && (
              <p className="text-amber-700">
                El último cobro no pasó. Tienes {datos.dias_gracia} días de gracia desde el vencimiento; Mercado Pago lo reintenta solo.
              </p>
            )}
            {!datos.puede_escribir && (
              <p className="text-red-700">La cuenta está en solo lectura. Activa el plan para volver a registrar información.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {puedeContratar && plan && (
              <Button asChild className="btn-action">
                <Link to={`/comprar?plan=${plan.codigo}`} data-testid="suscribirme-btn">
                  <CreditCard className="mr-2 h-4 w-4" />
                  {datos.mercadopago_disponible ? `Suscribirme · S/ ${Number(plan.monto).toFixed(2)} al mes` : 'Ver planes'}
                </Link>
              </Button>
            )}
            {datos.cobro_automatico && (
              <Button variant="outline" onClick={cancelar} disabled={cancelando} data-testid="cancelar-suscripcion-btn">
                {cancelando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                Cancelar suscripción
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="py-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-grafito-500">Cobros y comprobantes</h2>
          {(datos.pagos || []).length === 0 ? (
            <p className="text-sm text-grafito-500">Todavía no hay cobros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-grafito-500">
                  <tr>
                    <th className="py-2 pr-4">N°</th>
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Monto</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2">Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.pagos.map((p) => (
                    <tr key={p.id} className="border-t border-grafito-100">
                      <td className="py-2 pr-4 tabular-nums">{p.numero}</td>
                      <td className="py-2 pr-4">{fecha(p.confirmado_en || p.created_at)}</td>
                      <td className="py-2 pr-4 tabular-nums">S/ {Number(p.monto).toFixed(2)}</td>
                      <td className="py-2 pr-4">{ESTADO_PAGO[p.estado] || p.estado}</td>
                      <td className="py-2">
                        {p.comp_estado === 'emitido' && p.tiene_pdf ? (
                          <button type="button" onClick={() => descargar(p)} className="inline-flex items-center gap-1 text-marca-600 hover:underline">
                            <Download className="h-4 w-4" /> {p.comp_serie}-{p.comp_numero}
                          </button>
                        ) : p.comp_estado === 'emitido' ? (
                          `${p.comp_serie}-${p.comp_numero}`
                        ) : p.comp_estado === 'pendiente' ? (
                          <span className="text-grafito-500">En emisión ({p.comp_tipo})</span>
                        ) : (
                          <span className="text-grafito-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {datos.facturacion && (
            <p className="mt-4 text-xs text-grafito-500">
              Emitimos {datos.facturacion.tipo} {datos.facturacion.documento ? `a ${datos.facturacion.documento}` : 'sin documento'}
              {datos.facturacion.nombre ? ` · ${datos.facturacion.nombre}` : ''}. Lo cambias al volver a suscribirte.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SuscripcionPage;
