import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'TransperuOffline';
const DB_VERSION = 1;

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

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState({ checklists: 0, expenses: 0 });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Update pending count
    const updatePendingCount = async () => {
      try {
        const checklists = await getAllFromStore('pending_checklists');
        const expenses = await getAllFromStore('pending_expenses');
        setPendingCount({
          checklists: checklists.length,
          expenses: expenses.length,
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
      
      // Request background sync if available
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-checklist');
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
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-expenses');
      }
      
      return true;
    } catch (error) {
      console.error('Error saving expense offline:', error);
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

  // Get cached trips
  const getCachedTrips = useCallback(async () => {
    try {
      return await getAllFromStore('cached_trips');
    } catch (error) {
      console.error('Error getting cached trips:', error);
      return [];
    }
  }, []);

  // Cache vehicles for offline access
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

  // Get cached vehicles
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
    pendingCount,
    saveChecklistOffline,
    saveExpenseOffline,
    cacheTrips,
    getCachedTrips,
    cacheVehicles,
    getCachedVehicles,
  };
};

export default useOffline;
