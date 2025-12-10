// Service Worker for OnDeck PWA
// Enhanced caching strategy for faster PWA loads

const CACHE_VERSION = '1.4';
const CACHE_NAME = `ondeck-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `ondeck-runtime-v${CACHE_VERSION}`;
const DATA_CACHE = `ondeck-data-v${CACHE_VERSION}`;

// Critical resources to cache on install for instant loads
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

// Max age for cached responses (7 days)
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

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

  const validCaches = [CACHE_NAME, RUNTIME_CACHE, DATA_CACHE];

  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (!validCaches.includes(key)) {
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

// Helper function to check if cache is stale
function isCacheStale(response) {
  if (!response) return true;
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;
  const cacheDate = new Date(dateHeader).getTime();
  return Date.now() - cacheDate > MAX_CACHE_AGE;
}

// Fetch event - enhanced caching strategy for PWA
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests (except Supabase which we handle below)
  if (!url.origin.includes(self.location.hostname) && !url.origin.includes('supabase.co')) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Strategy 1: API/Supabase requests - Network first with short-lived cache fallback
  if (url.pathname.includes('/api/') ||
      url.origin.includes('supabase.co') ||
      url.pathname.includes('/auth/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses for 5 minutes
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DATA_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache for offline support
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('[ServiceWorker] Serving cached API response (offline)');
                return cachedResponse;
              }
              return new Response(
                JSON.stringify({ error: 'Offline - data not available' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
              );
            });
        })
    );
    return;
  }

  // Strategy 2: Next.js app bundles and chunks - Cache first (aggressive caching)
  if (url.pathname.includes('/_next/') ||
      url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse && !isCacheStale(cachedResponse)) {
            // Serve from cache immediately
            // Update in background if needed
            fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
            }).catch(() => {});

            return cachedResponse;
          }

          // Fetch from network and cache
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // If we have a stale cache, use it
            if (cachedResponse) {
              console.log('[ServiceWorker] Using stale cache for:', url.pathname);
              return cachedResponse;
            }
            return new Response('Asset not available', { status: 408 });
          });
        });
      })
    );
    return;
  }

  // Strategy 3: HTML navigation - Stale while revalidate
  if (request.mode === 'navigate' ||
      (request.headers.get('accept') &&
       request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            console.log('[ServiceWorker] Network failed for navigation');
            return caches.match('/offline.html');
          });

          // Return cached version immediately if available, but update in background
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy 4: Images and fonts - Cache first with background update
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            // Update in background
            fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
            }).catch(() => {});

            return cachedResponse;
          }

          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((error) => {
            console.log('[ServiceWorker] Asset fetch failed:', error);
            return new Response('Image not available offline', { status: 408 });
          });
        });
      })
    );
    return;
  }

  // Default: Network first
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
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