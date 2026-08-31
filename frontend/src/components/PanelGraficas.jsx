import React, { useEffect, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '../services/api';

/**
 * Las dos graficas del panel: viajes por semana y gasto de combustible.
 *
 * El panel eran solo contadores. Un contador dice COMO esta la flota hoy; no
 * dice hacia donde va. "6 vehiculos disponibles" no significa nada por si solo;
 * seis semanas seguidas bajando, si.
 *
 * Dos decisiones que se notan:
 *
 * 1. SI NO HAY DATOS, NO SE DIBUJA. Una grafica plana en cero no informa y
 *    ademas miente por omision: parece que el sistema no funciona, en vez de
 *    que la empresa acaba de empezar. Mejor un texto que lo diga.
 *
 * 2. LOS CEROS SE DIBUJAN. El endpoint genera todas las semanas del periodo,
 *    tengan datos o no. Agrupando solo lo que existe, una semana sin viajes
 *    desaparece y la linea une los dos puntos vecinos: una parada de una semana
 *    se veria como una recta. Asi se ve como lo que es, un cero.
 */

const NARANJA = '#f97316';
const AZUL = '#60a5fa';

const soles = (n) =>
  'S/ ' + Number(n || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 });

/** dd/mm a partir del ISO de la semana, que es lo que cabe en un eje. */
const diaMes = (iso) => {
  const [, m, d] = String(iso).split('-');
  return `${d}/${m}`;
};

const Marco = ({ titulo, subtitulo, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
    <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {titulo}
    </h3>
    {subtitulo && (
      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{subtitulo}</p>
    )}
    <div className="mt-4 h-56">{children}</div>
  </div>
);

const Etiqueta = ({ active, payload, label, formato }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="font-semibold text-slate-500 dark:text-slate-400">
        Semana del {diaMes(label)}
      </p>
      <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
        {formato(payload[0].value)}
      </p>
    </div>
  );
};

const PanelGraficas = ({ semanas = 12 }) => {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    let vivo = true;
    api
      .get(`/dashboard/series?semanas=${semanas}`)
      .then((r) => vivo && setDatos(r.data))
      // Si falla, no se dibuja nada. Es un complemento del panel, no su
      // contenido: un error aqui no puede llenar la pantalla de rojo.
      .catch(() => vivo && setDatos([]));
    return () => {
      vivo = false;
    };
  }, [semanas]);

  if (!datos) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-[19rem] animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50"
          />
        ))}
      </div>
    );
  }

  const totalViajes = datos.reduce((a, d) => a + d.viajes, 0);
  const totalCombustible = datos.reduce((a, d) => a + d.combustible, 0);

  // Sin nada que contar, dos graficas planas en cero solo ocupan sitio y
  // sugieren que algo esta roto.
  if (totalViajes === 0 && totalCombustible === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Todavía no hay historial suficiente para las gráficas.
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Aparecerán solas en cuanto se registren viajes y cargas de combustible.
        </p>
      </div>
    );
  }

  const rejilla = (
    <CartesianGrid
      strokeDasharray="3 3"
      stroke="currentColor"
      className="text-slate-200 dark:text-slate-700"
      vertical={false}
    />
  );
  const ejeX = (
    <XAxis
      dataKey="semana"
      tickFormatter={diaMes}
      tickLine={false}
      axisLine={false}
      tick={{ fontSize: 11, fill: 'currentColor' }}
      className="text-slate-400"
      interval="preserveStartEnd"
    />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Marco
        titulo="Viajes por semana"
        subtitulo={`${totalViajes} en las últimas ${datos.length} semanas`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            {rejilla}
            {ejeX}
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-slate-400"
            />
            <Tooltip
              content={<Etiqueta formato={(v) => `${v} ${v === 1 ? 'viaje' : 'viajes'}`} />}
              cursor={{ fill: 'rgba(148,163,184,0.12)' }}
            />
            <Bar dataKey="viajes" fill={AZUL} radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Marco>

      <Marco titulo="Combustible por semana" subtitulo={`${soles(totalCombustible)} en total`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="degradadoCombustible" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={NARANJA} stopOpacity={0.35} />
                <stop offset="100%" stopColor={NARANJA} stopOpacity={0} />
              </linearGradient>
            </defs>
            {rejilla}
            {ejeX}
            <YAxis
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-slate-400"
            />
            <Tooltip content={<Etiqueta formato={soles} />} cursor={{ stroke: NARANJA, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="combustible"
              stroke={NARANJA}
              strokeWidth={2}
              fill="url(#degradadoCombustible)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Marco>
    </div>
  );
};

export default PanelGraficas;
