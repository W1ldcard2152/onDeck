/**
 * OnDeck PWA Service Worker
 * Advanced configuration with specific cache strategies
 */

// Cache names for different types of assets
const CACHE_NAMES = {
    static: 'static-cache-v1',
    dynamic: 'dynamic-cache-v1',
    pages: 'pages-cache-v1',
    images: 'images-cache-v1'
  };
  
  // Assets to pre-cache on installation
  const STATIC_ASSETS = [
    '/',
    '/offline.html',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    '/icons/apple-icon-180x180.png'
  ];
  
  // Install event - cache static assets
  self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    // Skip waiting to ensure the new service worker activates immediately
    self.skipWaiting();
    
    event.waitUntil(
      caches.open(CACHE_NAMES.static)
        .then((cache) => {
          console.log('[Service Worker] Pre-caching static assets');
          return cache.addAll(STATIC_ASSETS);
        })
    );
  });
  
  // Activate event - clean up old caches
  self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    // Get all cache keys
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames
              .filter((cacheName) => {
                // Find caches that we don't need anymore
                return Object.values(CACHE_NAMES).indexOf(cacheName) === -1;
              })
              .map((cacheName) => {
                console.log('[Service Worker] Removing old cache:', cacheName);
                return caches.delete(cacheName);
              })
          );
        })
        .then(() => {
          console.log('[Service Worker] Claiming clients');
          return self.clients.claim();
        })
    );
  });
  
  // Fetch event - serve from cache or network
  self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
      return;
    }
    
    // Skip Supabase API requests - always go to network
    if (url.hostname.includes('supabase.co')) {
      return;
    }
    
    // Different caching strategies based on request type
    
    // For HTML pages - Network first, fallback to cache, then offline page
    if (request.headers.get('Accept').includes('text/html')) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            // Store a copy of the response in cache
            const clonedResponse = response.clone();
            caches.open(CACHE_NAMES.pages)
              .then((cache) => cache.put(request, clonedResponse));
            return response;
          })
          .catch(() => {
            // If network fails, try from cache
            return caches.match(request)
              .then((cacheResponse) => {
                if (cacheResponse) {
                  return cacheResponse;
                }
                // If page is not in cache, serve the offline page
                return caches.match('/offline.html');
              });
          })
      );
      return;
    }
    
    // For images - Cache first, fallback to network
    if (request.url.match(/\.(jpe?g|png|gif|svg|webp|ico)$/i)) {
      event.respondWith(
        caches.match(request)
          .then((cacheResponse) => {
            if (cacheResponse) {
              return cacheResponse;
            }
            
            // Not found in cache, fetch from network and store
            return fetch(request)
              .then((response) => {
                const clonedResponse = response.clone();
                caches.open(CACHE_NAMES.images)
                  .then((cache) => cache.put(request, clonedResponse));
                return response;
              })
              .catch(() => {
                // If image fetch fails, return a fallback image or empty response
                // We could add a placeholder image here if needed
                return new Response('Image not available', { status: 404 });
              });
          })
      );
      return;
    }
    
    // For other assets (JS, CSS) - Stale while revalidate
    event.respondWith(
      caches.match(request)
        .then((cacheResponse) => {
          // Return cached version immediately while fetching new version
          const fetchPromise = fetch(request)
            .then((response) => {
              const clonedResponse = response.clone();
              caches.open(CACHE_NAMES.dynamic)
                .then((cache) => cache.put(request, clonedResponse));
              return response;
            })
            .catch(() => {
              console.log('[Service Worker] Network request failed for:', request.url);
            });
          
          return cacheResponse || fetchPromise;
        })
    );
  });
  
  // Handle when the app comes back online
  self.addEventListener('online', () => {
    console.log('[Service Worker] App is back online.');
    // You could trigger a sync event or update data here
  });