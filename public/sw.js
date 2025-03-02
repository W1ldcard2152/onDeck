// Service Worker for OnDeck PWA
// Place this file in public folder

const CACHE_NAME = 'ondeck-v1';

// Resources to cache on install
const PRECACHE_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-384x384.png',
  '/next-pwa-setup.js',
  '/splash.html',
  '/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  
  // Skip waiting so the new service worker activates immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Pre-caching offline resources');
        return cache.addAll(PRECACHE_RESOURCES);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
    .then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - network first strategy with offline fallback
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests and API calls
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.url.includes('/api/') ||
      event.request.url.includes('supabase.co')) {
    return;
  }
  
  // For HTML navigation requests - network first
  if (event.request.mode === 'navigate' || 
      (event.request.method === 'GET' && 
       event.request.headers.get('accept').includes('text/html'))) {
    
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If network fails, serve offline page
          return caches.match('/offline.html');
        })
    );
    return;
  }
  
  // For other GET requests - stale-while-revalidate
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              // Update cache with fresh response
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              console.log('[ServiceWorker] Fetch failed; returning offline page instead.');
              // If no cached response exists and network fails, return offline page for HTML
              if (event.request.headers.get('accept').includes('text/html')) {
                return caches.match('/offline.html');
              }
            });
          
          // Return the cached response if we have one, otherwise wait for the network response
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});

// Handle push notifications if needed
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  console.log(`[Service Worker] Push had this data: "${event.data.text()}"`);

  const title = 'OnDeck';
  const options = {
    body: event.data.text(),
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received.');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});