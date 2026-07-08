import React, { useState } from 'react';
import { useOffline } from '../hooks/useOffline';
import { WifiOff, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const formatRelative = (iso) => {
  if (!iso) return 'nunca';
  try {
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `hace ${diff}s`;
    if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    return d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
  } catch (_) {
    return iso;
  }
};

const OfflineIndicator = () => {
  const { isOnline, isSyncing, pendingCount, lastSync, syncAllPending } = useOffline();
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const totalPending =
    (pendingCount.checklists || 0) +
    (pendingCount.expenses || 0) +
    (pendingCount.fuel_loads || 0) +
    (pendingCount.issues || 0);

  if (isOnline && totalPending === 0 && !isSyncing) {
    return null;
  }

  const handleRetry = async () => {
    if (!isOnline || retrying) return;
    setRetrying(true);
    try {
      await syncAllPending();
    } finally {
      setRetrying(false);
    }
  };

  // Mobile: sticky at top. Desktop: bottom-right floating.
  const bgGradient = isOnline
    ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.92) 0%, rgba(29, 78, 216, 0.88) 100%)'
    : 'linear-gradient(135deg, rgba(220, 38, 38, 0.92) 0%, rgba(185, 28, 28, 0.88) 100%)';

  const containerCls = [
    'fixed z-50 smooth-appear',
    // mobile - top sticky
    'top-0 left-0 right-0 rounded-none',
    // desktop - bottom right floating
    'md:top-auto md:bottom-4 md:right-4 md:left-auto md:w-80 md:rounded-xl',
    'text-white border border-white/15 shadow-2xl',
    'backdrop-blur-md',
  ].join(' ');

  const showSpinner = isSyncing || retrying;

  return (
    <div className={containerCls} style={{ backgroundImage: bgGradient }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 text-white p-3 text-left tap-scale"
      >
        {showSpinner ? (
          <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" />
        ) : isOnline ? (
          <RefreshCw className="w-5 h-5 flex-shrink-0" />
        ) : (
          <WifiOff className="w-5 h-5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">
            {!isOnline
              ? 'Sin conexión'
              : showSpinner
              ? 'Sincronizando...'
              : totalPending > 0
              ? 'Pendientes por enviar'
              : 'En línea'}
          </p>
          <p className="text-xs opacity-80 truncate">
            {totalPending} {totalPending === 1 ? 'item pendiente' : 'items pendientes'}
            {lastSync && ` · última sync ${formatRelative(lastSync)}`}
          </p>
        </div>
        {totalPending > 0 && (
          <div className="bg-white/20 rounded-full px-2 py-0.5">
            <span className="text-xs font-bold">{totalPending}</span>
          </div>
        )}
        {expanded ? (
          <ChevronUp className="w-4 h-4 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 text-white space-y-2">
          <div className="bg-white/10 rounded p-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span>Checklists</span>
              <span className="font-mono">{pendingCount.checklists || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Gastos</span>
              <span className="font-mono">{pendingCount.expenses || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Cargas combustible</span>
              <span className="font-mono">{pendingCount.fuel_loads || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Incidentes</span>
              <span className="font-mono">{pendingCount.issues || 0}</span>
            </div>
          </div>
          <div className="text-xs opacity-80">
            Última sincronización: {formatRelative(lastSync)}
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={!isOnline || retrying || totalPending === 0}
            className="w-full bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed rounded py-2 text-sm font-bold flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            {isOnline ? 'Reintentar ahora' : 'Esperando conexión...'}
          </button>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;
