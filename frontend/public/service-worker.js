/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'transperu-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/static/js/bundle.js',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API requests (let them fail naturally for offline handling)
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'offline', message: 'Sin conexión' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }
  
  // For navigation requests, try network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }
  
  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone the response for caching
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      });
    })
  );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-checklist') {
    event.waitUntil(syncChecklistData());
  }
  if (event.tag === 'sync-expenses') {
    event.waitUntil(syncExpenseData());
  }
});

// Sync checklist data when online
async function syncChecklistData() {
  const db = await openIndexedDB();
  const pendingChecklists = await getAllFromStore(db, 'pending_checklists');
  
  for (const checklist of pendingChecklists) {
    try {
      const response = await fetch(`/api/trip/${checklist.trip_id}/checklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${checklist.token}`,
        },
        body: JSON.stringify(checklist.data),
      });
      
      if (response.ok) {
        await deleteFromStore(db, 'pending_checklists', checklist.id);
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  }
}

// Sync expense data when online
async function syncExpenseData() {
  const db = await openIndexedDB();
  const pendingExpenses = await getAllFromStore(db, 'pending_expenses');
  
  for (const expense of pendingExpenses) {
    try {
      const response = await fetch(`/api/trips/${expense.trip_id}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${expense.token}`,
        },
        body: JSON.stringify(expense.data),
      });
      
      if (response.ok) {
        await deleteFromStore(db, 'pending_expenses', expense.id);
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  }
}

// IndexedDB helpers
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TransperuOffline', 1);
    
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
    };
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deleteFromStore(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Nueva notificación',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
  };
  
  event.waitUntil(
    self.registration.showNotification('TransportePeru', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
