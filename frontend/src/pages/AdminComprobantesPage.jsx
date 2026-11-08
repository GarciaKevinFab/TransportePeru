import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { comprobantesAdminApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import EncabezadoPagina from '../components/EncabezadoPagina';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

/**
 * Panel del dueno de la plataforma: los comprobantes que hay que emitir a mano.
 *
 * Cada cobro pagado llega aqui como 'pendiente' (lo marca un disparador de la
 * base). El dueno lo emite en BSNegocios con los datos que se muestran, y
 * registra la serie, el numero y el PDF para que el cliente lo descargue en
 * su cuenta. Solo el superadmin: el backend lo exige igual, esto es solo para
 * no pintar una pantalla que responderia 403.
 */

const dinero = (v) => `S/ ${Number(v || 0).toFixed(2)}`;
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-PE') : '—');

const Pendiente = ({ p, alTerminar }) => {
  const [serie, setSerie] = useState(p.comp_tipo === 'factura' ? 'F001' : 'B001');
  const [numero, setNumero] = useState('');
  const [dia, setDia] = useState('');
  const [pdf, setPdf] = useState(null);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);

  const registrar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    const fd = new FormData();
    fd.append('serie', serie);
    fd.append('numero', numero);
    if (dia) fd.append('fecha', dia);
    if (pdf) fd.append('pdf', pdf);
    try {
      await comprobantesAdminApi.registrar(p.id, fd);
      toast.success(`${serie}-${numero} registrado`);
      alTerminar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo registrar');
    }
    setEnviando(false);
  };

  const sinComprobante = async () => {
    if (!nota.trim()) {
      toast.error('Escribe por qué no lleva comprobante');
      return;
    }
    try {
      await comprobantesAdminApi.noAplica(p.id, nota);
      alTerminar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo guardar');
    }
  };

  return (
    <Card className="bg-white">
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-bold text-grafito-900">
            Cobro #{p.numero} · {p.comp_tipo === 'factura' ? 'Factura' : 'Boleta'} · {dinero(p.monto)}
          </p>
          <p className="text-xs text-grafito-500">{fecha(p.confirmado_en || p.created_at)} · {p.referencia}</p>
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-grafito-500">Documento: </dt><dd className="inline font-mono">{p.comp_documento || 'sin documento'}</dd></div>
          <div><dt className="inline text-grafito-500">Cliente: </dt><dd className="inline">{p.comp_nombre || p.empresa}</dd></div>
          <div className="sm:col-span-2"><dt className="inline text-grafito-500">Dirección: </dt><dd className="inline">{p.comp_direccion || '—'}</dd></div>
          <div><dt className="inline text-grafito-500">Correo: </dt><dd className="inline">{p.email || '—'}</dd></div>
          <div><dt className="inline text-grafito-500">Concepto: </dt><dd className="inline">Suscripción CargoXprez plan {p.plan} (mensual)</dd></div>
          <div><dt className="inline text-grafito-500">Valor de venta: </dt><dd className="inline tabular-nums">{dinero(p.base)}</dd></div>
          <div><dt className="inline text-grafito-500">IGV 18%: </dt><dd className="inline tabular-nums">{dinero(p.igv)}</dd></div>
        </dl>
        <form onSubmit={registrar} className="grid items-end gap-3 sm:grid-cols-[6rem_8rem_10rem_1fr_auto]">
          <Input value={serie} onChange={(e) => setSerie(e.target.value.toUpperCase())} placeholder="Serie" aria-label="Serie" />
          <Input value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} placeholder="Número" aria-label="Número" />
          <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Fecha de emisión" />
          <Input type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0] || null)} aria-label="PDF" />
          <Button type="submit" disabled={enviando || !numero} className="btn-action">
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-md" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Motivo para no emitir (por ejemplo, cortesía)" />
          <Button type="button" variant="outline" onClick={sinComprobante}>No lleva comprobante</Button>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminComprobantesPage = () => {
  const { user } = useAuth();
  const [datos, setDatos] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await comprobantesAdminApi.listar();
      setDatos(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo cargar');
    }
  }, []);

  useEffect(() => { if (user?.role === 'superadmin') cargar(); }, [cargar, user]);

  if (user?.role !== 'superadmin') return <Navigate to="/dashboard" replace />;
  if (!datos) {
    return <div className="flex items-center gap-2 p-8 text-grafito-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;
  }

  return (
    <div className="space-y-6 page-fade-in" data-testid="admin-comprobantes-page">
      <EncabezadoPagina
        titulo="Comprobantes"
        subtitulo="Emítelos en BSNegocios y registra aquí la serie, el número y el PDF"
      />

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-grafito-500">
          Pendientes ({datos.pendientes.length})
        </h2>
        {datos.pendientes.length === 0 && <p className="text-sm text-grafito-500">No hay comprobantes pendientes.</p>}
        {datos.pendientes.map((p) => <Pendiente key={p.id} p={p} alTerminar={cargar} />)}
      </section>

      {datos.devueltos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-red-600">
            Devueltos con comprobante emitido: emite nota de crédito
          </h2>
          {datos.devueltos.map((p) => (
            <p key={p.id} className="text-sm text-grafito-700">
              #{p.numero} · {p.comp_serie}-{p.comp_numero} · {p.empresa} · {dinero(p.monto)}
            </p>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-grafito-500">Últimos resueltos</h2>
        {datos.recientes.map((p) => (
          <p key={p.id} className="text-sm text-grafito-700">
            #{p.numero} · {p.comp_estado === 'emitido' ? `${p.comp_serie}-${p.comp_numero}` : `sin comprobante (${p.comp_nota || ''})`}
            {' '}· {p.empresa} · {dinero(p.monto)}
          </p>
        ))}
      </section>
    </div>
  );
};

export default AdminComprobantesPage;
