import React from 'react';
import { useOffline } from '../hooks/useOffline';
import { Wifi, WifiOff, CloudOff, RefreshCw } from 'lucide-react';

const OfflineIndicator = () => {
  const { isOnline, pendingCount } = useOffline();
  const totalPending = pendingCount.checklists + pendingCount.expenses;

  if (isOnline && totalPending === 0) {
    return null;
  }

  return (
    <div className={`fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-72 z-50 rounded-lg shadow-lg p-3 ${
      isOnline ? 'bg-blue-600' : 'bg-red-600'
    }`}>
      <div className="flex items-center gap-3 text-white">
        {isOnline ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <div className="flex-1">
              <p className="font-bold text-sm">Sincronizando...</p>
              <p className="text-xs opacity-80">
                {totalPending} {totalPending === 1 ? 'item pendiente' : 'items pendientes'}
              </p>
            </div>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5" />
            <div className="flex-1">
              <p className="font-bold text-sm">Sin conexión</p>
              <p className="text-xs opacity-80">
                Los datos se guardarán localmente
              </p>
            </div>
            {totalPending > 0 && (
              <div className="bg-white/20 rounded-full px-2 py-1">
                <span className="text-xs font-bold">{totalPending}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
