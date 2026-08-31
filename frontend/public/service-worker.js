/* eslint-disable no-restricted-globals */

// Subir este numero al cambiar lo que se precachea. El activate de abajo borra
// toda cache que no se llame asi, y esa es la unica forma de limpiar lo viejo
// en un navegador que ya visito la web.
const CACHE_NAME = 'transperu-v2';
const OFFLINE_URL = '/offline.html';

// Lo minimo para que la aplicacion abra sin red. NO va aqui ningun /static/js:
// en una compilacion de produccion esos ficheros llevan un hash en el nombre
// (main.61dddf16.js) que cambia en cada despliegue y no se puede escribir a
// mano. Se cachean solos al pedirlos, mas abajo.
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Uno a uno y tolerando fallos, en vez de cache.addAll: addAll es
      // todo-o-nada, asi que un solo recurso que devuelva 404 rechaza la
      // promesa, el install FALLA y el service worker viejo se queda al mando
      // -sirviendo la version anterior de la aplicacion a quien ya habia
      // entrado alguna vez, despliegue tras despliegue-.
      //
      // Aqui pasaba exactamente eso: la lista traia '/static/js/bundle.js',
      // que solo existe con el servidor de desarrollo. En produccion era un
      // 404 en cada intento de instalacion.
      Promise.all(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('No se pudo precachear', url, err);
          })
        )
      )
    )
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
