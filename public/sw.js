// Service Worker for OnDeck PWA
// Place this file in the public folder

const CACHE_NAME = 'ondeck-v1.2'; // Incremented version number

// Resources to cache on install
const PRECACHE_RESOURCES = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/icons/android/android-launchericon-192-192.png',
  '/icons/android/android-launchericon-512-512.png',
  '/icons/ios/192.png',
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

// Fetch event - improved caching strategy for PWA
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests, API calls, and authentication requests
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.url.includes('/api/') ||
      event.request.url.includes('supabase.co') ||
      event.request.url.includes('auth/') ||
      event.request.method !== 'GET') {
    return;
  }
  
  const url = new URL(event.request.url);
  
  // For HTML navigation requests - network first with offline fallback
  if (event.request.mode === 'navigate' || 
      (event.request.method === 'GET' && 
       event.request.headers.get('accept') && 
       event.request.headers.get('accept').includes('text/html'))) {
    
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful responses for offline use
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache first, then offline page
          return caches.match(event.request)
            .then((response) => {
              if (response) {
                return response;
              }
              console.log('[ServiceWorker] Fetch failed; returning offline page instead.');
              return caches.match('/offline.html');
            });
        })
    );
    return;
  }
  
  // For static assets (JS, CSS, images) - cache first with network fallback
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Serve from cache and update in background
            fetch(event.request)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(CACHE_NAME)
                    .then((cache) => {
                      cache.put(event.request, networkResponse.clone());
                    });
                }
              })
              .catch(() => {
                // Silent fail for background update
              });
            return cachedResponse;
          }
          
          // Not in cache, fetch from network
          return fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return networkResponse;
            })
            .catch((error) => {
              console.log('[ServiceWorker] Asset fetch failed:', error);
              return new Response('Asset not available offline', { status: 408 });
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
    icon: '/icons/android/android-launchericon-192-192.png',
    badge: '/icons/android/android-launchericon-72-72.png'
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