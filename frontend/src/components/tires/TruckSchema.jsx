import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Plus, Truck } from 'lucide-react';
import { AXLE_TYPE_META } from './tireSchema';

const STATUS_RING = {
  good: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  empty: '#d0cdc8',
};

// Realistic truck-tire drawn as an SVG (tread face view): rubber body with
// grooves/sipes, subtle top highlight and a status-colored ring.
const RealTire = ({ w, h, ring, dashed }) => {
  const top = 8;
  const bottom = h - 8;
  const rows = 6;
  const step = (bottom - top) / rows;
  const sipes = Array.from({ length: rows + 1 }, (_, i) => top + i * step);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <defs>
        <linearGradient id="tireRubber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b6472" />
          <stop offset="0.5" stopColor="#374151" />
          <stop offset="1" stopColor="#1a2030" />
        </linearGradient>
      </defs>
      {/* rubber body */}
      <rect
        x="2.5"
        y="2.5"
        width={w - 5}
        height={h - 5}
        rx={Math.min(12, (w - 5) / 2)}
        fill={dashed ? '#f3f2f0' : 'url(#tireRubber)'}
        stroke={ring}
        strokeWidth="3"
        strokeDasharray={dashed ? '5 4' : undefined}
      />
      {!dashed && (
        <>
          {/* longitudinal ribs */}
          <line x1={w * 0.38} y1="7" x2={w * 0.38} y2={h - 7} stroke="#0b0f19" strokeWidth="1.4" opacity="0.7" />
          <line x1={w * 0.62} y1="7" x2={w * 0.62} y2={h - 7} stroke="#0b0f19" strokeWidth="1.4" opacity="0.7" />
          {/* transverse tread lugs */}
          {sipes.map((y, i) => (
            <line key={i} x1="6" y1={y} x2={w - 6} y2={y} stroke="#0b0f19" strokeWidth="2" opacity="0.5" />
          ))}
          {/* top highlight for a rounded, 3D look */}
          <rect x="5" y="5" width={w - 10} height={h * 0.28} rx="8" fill="#ffffff" opacity="0.06" />
        </>
      )}
    </svg>
  );
};

// A single tire position: realistic tire image + centered position label.
const TireGlyph = ({ position, tire, status, wide, onClick }) => {
  const mounted = !!tire;
  const w = wide ? 46 : 32;
  const h = 66;
  const ring = STATUS_RING[status] || STATUS_RING.empty;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onClick(position)}
            data-testid={`tire-${position.code}`}
            className={`relative transition-transform duration-150 hover:scale-105 focus:outline-none ${
              status === 'critical' ? 'animate-pulse' : ''
            }`}
          >
            <RealTire w={w} h={h} ring={ring} dashed={!mounted} />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {mounted ? (
                <span className="rounded bg-grafito-900/75 px-1 py-0.5 text-[9px] font-bold leading-none text-white shadow-sm">
                  {position.label}
                </span>
              ) : (
                <span className="flex flex-col items-center text-grafito-400">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="mt-0.5 text-[8px] font-semibold leading-none">{position.label}</span>
                </span>
              )}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {tire ? (
            <div className="text-xs">
              <p className="font-bold">{tire.serial}</p>
              <p>{tire.brand} {tire.model}</p>
              <p>{tire.dimension}</p>
              {tire.last_inspection && (
                <p>Prof: {Math.min(...tire.last_inspection.depths).toFixed(1)}mm</p>
              )}
            </div>
          ) : (
            <p>Posición vacía - Click para montar</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const SideTires = ({ positions, dual, align, getTireByPosition, getTireStatus, onPositionClick }) => (
  <div className={`flex items-center gap-1 ${align === 'left' ? 'justify-end' : 'justify-start'}`}>
    {positions.map((pos) => {
      const tire = getTireByPosition(pos.code);
      return (
        <TireGlyph
          key={pos.code}
          position={pos}
          tire={tire}
          status={getTireStatus(tire)}
          wide={!dual}
          onClick={onPositionClick}
        />
      );
    })}
  </div>
);

const AxleRow = ({ axle, getTireByPosition, getTireStatus, onPositionClick }) => {
  const meta = AXLE_TYPE_META[axle.type] || AXLE_TYPE_META.muerto;
  return (
    <div className="relative w-full py-3">
      {/* colored axle bar (spans center, behind the chassis gap) */}
      <div
        className={`absolute top-1/2 left-[22%] right-[22%] -translate-y-1/2 h-2 rounded-full ${meta.bar}`}
      />
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center">
        <SideTires
          positions={axle.left}
          dual={axle.dual}
          align="left"
          getTireByPosition={getTireByPosition}
          getTireStatus={getTireStatus}
          onPositionClick={onPositionClick}
        />
        {/* chassis gap */}
        <div className="w-10" />
        <SideTires
          positions={axle.right}
          dual={axle.dual}
          align="right"
          getTireByPosition={getTireByPosition}
          getTireStatus={getTireStatus}
          onPositionClick={onPositionClick}
        />
      </div>
      <div className="mt-1 flex items-center justify-center gap-2">
        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
        <span className="text-[11px] font-semibold text-grafito-600">{axle.name}</span>
        <span className="text-[10px] uppercase tracking-wide text-grafito-400">
          {meta.label} · {axle.dual ? 'Dual' : 'Balón'}
        </span>
      </div>
    </div>
  );
};

const TruckSchema = ({ config, isTracto, getTireByPosition, getTireStatus, onPositionClick }) => {
  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative w-full max-w-md">
        {/* central vertical chassis */}
        <div className="absolute top-6 bottom-6 left-1/2 -translate-x-1/2 w-3 rounded-full bg-grafito-300" />

        {/* cab (only for tracto) */}
        {isTracto && (
          <div className="relative z-10 flex justify-center mb-2">
            <div className="w-24 h-10 rounded-lg bg-grafito-700 text-white flex items-center justify-center shadow">
              <Truck className="w-5 h-5" />
            </div>
          </div>
        )}

        <div className="relative z-10 flex flex-col gap-2">
          {config.axles.map((axle, idx) => (
            <AxleRow
              key={idx}
              axle={axle}
              getTireByPosition={getTireByPosition}
              getTireStatus={getTireStatus}
              onPositionClick={onPositionClick}
            />
          ))}
        </div>
      </div>

      {/* Spares */}
      {config.spare && config.spare.length > 0 && (
        <div className="mt-6 pt-4 border-t-2 border-dashed border-grafito-300 w-full max-w-md">
          <span className="text-xs font-bold text-grafito-500 mb-2 block text-center uppercase tracking-wide">
            Repuesto(s)
          </span>
          <div className="flex justify-center gap-4">
            {config.spare.map((pos) => (
              <TireGlyph
                key={pos.code}
                position={pos}
                tire={getTireByPosition(pos.code)}
                status={getTireStatus(getTireByPosition(pos.code))}
                wide
                onClick={onPositionClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 w-full max-w-2xl space-y-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-grafito-400 mb-2">
            Estado de la llanta
          </p>
          <div className="flex flex-wrap gap-4">
            <LegendItem className="border-emerald-500 bg-emerald-50" label="Buena condición" />
            <LegendItem className="border-amber-500 bg-amber-50" label="Requiere atención" />
            <LegendItem className="border-red-500 bg-red-50" label="Crítico" />
            <LegendItem className="border-grafito-300 border-dashed bg-grafito-100" label="Sin llanta" />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-grafito-400 mb-2">
            Tipo de eje
          </p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(AXLE_TYPE_META).map(([key, meta]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`w-5 h-2 rounded-full ${meta.bar}`} />
                <span className="text-xs text-grafito-600">{meta.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const LegendItem = ({ className, label }) => (
  <div className="flex items-center gap-2">
    <span className={`w-4 h-4 rounded border-2 ${className}`} />
    <span className="text-xs text-grafito-600">{label}</span>
  </div>
);

export default TruckSchema;
