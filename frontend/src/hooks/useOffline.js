import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'TransperuOffline';
const DB_VERSION = 2;

// All pending stores that participate in sync
const PENDING_STORES = [
  'pending_checklists',
  'pending_expenses',
  'pending_fuel_loads',
  'pending_issues',
];

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Open IndexedDB
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('pending_checklists')) {
        db.createObjectStore('pending_checklists', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending_expenses')) {
        db.createObjectStore('pending_expenses', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending_fuel_loads')) {
        db.createObjectStore('pending_fuel_loads', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending_issues')) {
        db.createObjectStore('pending_issues', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('cached_trips')) {
        db.createObjectStore('cached_trips', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cached_vehicles')) {
        db.createObjectStore('cached_vehicles', { keyPath: 'id' });
      }
    };
  });
};

// Add item to store
const addToStore = async (storeName, data) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// Get all from store
const getAllFromStore = async (storeName) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// Delete a record by key
const deleteFromStore = async (storeName, key) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// Clear store
const clearStore = async (storeName) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// Build endpoint URL per store + record
const buildEndpoint = (storeName, record) => {
  switch (storeName) {
    case 'pending_checklists':
      return `${API_URL}/api/trip/${record.trip_id}/checklist`;
    case 'pending_expenses':
      return `${API_URL}/api/trips/${record.trip_id}/expenses`;
    case 'pending_fuel_loads':
      return `${API_URL}/api/fuel/loads`;
    case 'pending_issues':
      return `${API_URL}/api/issues`;
    default:
      return null;
  }
};

// Module-level state so multiple hook consumers see the same last sync
let lastSyncTimeRef = null;
let syncingNow = false;

// Singleton sync function (exposed and reusable)
export const syncAllPending = async () => {
  if (!navigator.onLine || syncingNow) {
    return { ok: 0, fail: 0, skipped: true };
  }
  syncingNow = true;

  let okCount = 0;
  let failCount = 0;

  const token = localStorage.getItem('access_token');

  try {
    for (const storeName of PENDING_STORES) {
      let items = [];
      try {
        items = await getAllFromStore(storeName);
      } catch (err) {
        console.error(`Could not read ${storeName}:`, err);
        continue;
      }

      for (const record of items) {
        const url = buildEndpoint(storeName, record);
        if (!url) continue;

        const authToken = record.token || token;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify(record.data || {}),
          });
          if (res.ok) {
            await deleteFromStore(storeName, record.id);
            okCount += 1;
          } else {
            failCount += 1;
            console.warn(`Sync failed for ${storeName} id=${record.id}: ${res.status}`);
          }
        } catch (err) {
          failCount += 1;
          console.error(`Sync error for ${storeName} id=${record.id}:`, err);
        }
      }
    }
    lastSyncTimeRef = new Date().toISOString();
    try {
      localStorage.setItem('offline_last_sync', lastSyncTimeRef);
    } catch (_) {}
  } finally {
    syncingNow = false;
  }
  return { ok: okCount, fail: failCount, skipped: false };
};

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState({
    checklists: 0,
    expenses: 0,
    fuel_loads: 0,
    issues: 0,
  });
  const [lastSync, setLastSync] = useState(() => {
    try {
      return localStorage.getItem('offline_last_sync');
    } catch (_) {
      return null;
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Wrapper that also flips UI flag + refreshes lastSync
  const runSync = useCallback(async () => {
    if (!navigator.onLine) return { ok: 0, fail: 0, skipped: true };
    setIsSyncing(true);
    try {
      const result = await syncAllPending();
      try {
        const ls = localStorage.getItem('offline_last_sync');
        if (ls) setLastSync(ls);
      } catch (_) {}
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync when we come back online
      runSync().catch((e) => console.error('Auto-sync error:', e));
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [runSync]);

  useEffect(() => {
    // Update pending count
    const updatePendingCount = async () => {
      try {
        const [checklists, expenses, fuelLoads, issues] = await Promise.all([
          getAllFromStore('pending_checklists').catch(() => []),
          getAllFromStore('pending_expenses').catch(() => []),
          getAllFromStore('pending_fuel_loads').catch(() => []),
          getAllFromStore('pending_issues').catch(() => []),
        ]);
        setPendingCount({
          checklists: checklists.length,
          expenses: expenses.length,
          fuel_loads: fuelLoads.length,
          issues: issues.length,
        });
      } catch (error) {
        console.error('Error getting pending count:', error);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Save checklist for offline sync
  const saveChecklistOffline = useCallback(async (tripId, data, token) => {
    try {
      await addToStore('pending_checklists', {
        trip_id: tripId,
        data,
        token,
        created_at: new Date().toISOString(),
      });

      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-checklist');
        } catch (_) {}
      }

      return true;
    } catch (error) {
      console.error('Error saving checklist offline:', error);
      return false;
    }
  }, []);

  // Save expense for offline sync
  const saveExpenseOffline = useCallback(async (tripId, data, token) => {
    try {
      await addToStore('pending_expenses', {
        trip_id: tripId,
        data,
        token,
        created_at: new Date().toISOString(),
      });

      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-expenses');
        } catch (_) {}
      }

      return true;
    } catch (error) {
      console.error('Error saving expense offline:', error);
      return false;
    }
  }, []);

  // Save fuel load for offline sync
  const saveFuelLoadOffline = useCallback(async (data, token) => {
    try {
      await addToStore('pending_fuel_loads', {
        data,
        token: token || localStorage.getItem('access_token'),
        created_at: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error saving fuel load offline:', error);
      return false;
    }
  }, []);

  // Save issue for offline sync
  const saveIssueOffline = useCallback(async (data, token) => {
    try {
      await addToStore('pending_issues', {
        data,
        token: token || localStorage.getItem('access_token'),
        created_at: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error saving issue offline:', error);
      return false;
    }
  }, []);

  // Cache trips for offline access
  const cacheTrips = useCallback(async (trips) => {
    try {
      await clearStore('cached_trips');
      const db = await openDB();
      const transaction = db.transaction('cached_trips', 'readwrite');
      const store = transaction.objectStore('cached_trips');

      for (const trip of trips) {
        store.put(trip);
      }

      return true;
    } catch (error) {
      console.error('Error caching trips:', error);
      return false;
    }
  }, []);

  const getCachedTrips = useCallback(async () => {
    try {
      return await getAllFromStore('cached_trips');
    } catch (error) {
      console.error('Error getting cached trips:', error);
      return [];
    }
  }, []);

  const cacheVehicles = useCallback(async (vehicles) => {
    try {
      await clearStore('cached_vehicles');
      const db = await openDB();
      const transaction = db.transaction('cached_vehicles', 'readwrite');
      const store = transaction.objectStore('cached_vehicles');

      for (const vehicle of vehicles) {
        store.put(vehicle);
      }

      return true;
    } catch (error) {
      console.error('Error caching vehicles:', error);
      return false;
    }
  }, []);

  const getCachedVehicles = useCallback(async () => {
    try {
      return await getAllFromStore('cached_vehicles');
    } catch (error) {
      console.error('Error getting cached vehicles:', error);
      return [];
    }
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSync,
    saveChecklistOffline,
    saveExpenseOffline,
    saveFuelLoadOffline,
    saveIssueOffline,
    syncAllPending: runSync,
    cacheTrips,
    getCachedTrips,
    cacheVehicles,
    getCachedVehicles,
  };
};

export default useOffline;
