// Service Worker for OnDeck PWA
// Place this file in the public folder

const CACHE_NAME = 'ondeck-v1.1'; // Incremented version number

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
      .catch(err => {
        console.error('[ServiceWorker] Pre-caching error:', err);
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
      return self.clients.claim(); // This ensures the ServiceWorker takes control immediately
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
          console.log('[ServiceWorker] Fetch failed; returning offline page instead.');
          return caches.match('/offline.html');
        })
    );
    return;
  }
  
  // For assets like JS, CSS, images - stale-while-revalidate
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
            .catch((error) => {
              console.log('[ServiceWorker] Fetch failed:', error);
              return cachedResponse || new Response('Network error', { status: 408 });
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
  console.log(`[Service Worker] Push had this data: "${event.data ? event.data.text() : 'no data'}"`);

  const title = 'OnDeck';
  const options = {
    body: event.data && event.data.text() ? event.data.text() : 'Something new happened!',
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

// Log any errors that occur in the service worker
self.addEventListener('error', function(e) {
  console.error('[ServiceWorker] Error:', e.filename, e.lineno, e.colno, e.message);
});

// Ensure the service worker stays active
setInterval(() => {
  console.log('[ServiceWorker] Keeping alive');
}, 1000 * 60 * 10); // Log every 10 minutes to keep active