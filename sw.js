/* =========================================================================
   BEBU Store - Service Worker (professional)
   Version: v1
   - skipWaiting on install, clients.claim on activate
   - Broadcasts NEW_VERSION to clients when a new SW activates
   - Strategies:
     * Navigation (HTML): network-first w/ fallback to cached index.html
     * Google Sheets / API hosts: network-first w/ cache fallback (short-lived)
     * Static assets (css/js/fonts): stale-while-revalidate
     * Images: cache-first with max entries & LRU-like trimming
     * Other GET requests: network-first with cache fallback
   - Message API: SKIP_WAITING, CLEAR_CACHE, CACHE_URLS, GET_VERSION
   - Background sync placeholder: sync-cart
   - Push & Notification click handlers
   - Cache size controls and debug logging
   ========================================================================= */

'use strict';

const SW_VERSION = '2026.08.20_v1'; // bump when you deploy a new SW
const CACHE_PREFIX = 'bebu';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${SW_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${SW_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${SW_VERSION}`;

const APP_SHELL = [
  '/', // single page navigation fallback
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/logo-192.png',
  '/icons/logo-512.png'
];

// Hosts we treat as "API/Sheets"
const API_HOSTNAMES = ['docs.google.com', 'opensheet.elk.sh', 'sheets.googleapis.com'];

// Image file extensions considered cacheable
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];

// Limits
const IMAGE_CACHE_MAX_ENTRIES = 120; // max images to keep
const RUNTIME_CACHE_MAX_ENTRIES = 200; // general runtime resources
const API_CACHE_TTL_MS = 1000 * 60 * 2; // 2 minutes TTL for API responses cached (best-effort)
const NAVIGATION_NETWORK_TIMEOUT = 7000; // ms
const API_NETWORK_TIMEOUT = 8000; // ms

/* ===========================
   Utilities
   =========================== */

/**
 * Simple console prefixed logger (useful to enable/disable)
 */
function log(...args) {
  // toggle to false to silence logs
  const ENABLE_LOG = true;
  if (ENABLE_LOG) console.debug('[SW]', ...args);
}

/**
 * Determine if URL belongs to one of the API hosts
 */
function isApiUrl(url) {
  try {
    const u = new URL(url);
    return API_HOSTNAMES.some(h => u.hostname.includes(h));
  } catch (e) {
    return false;
  }
}

/**
 * Determine if request is navigation/html
 */
function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html'));
}

/**
 * Determine if url is an image resource
 */
function isImageUrl(url) {
  try {
    const u = new URL(url);
    return IMAGE_EXTENSIONS.some(ext => u.pathname.toLowerCase().endsWith(ext));
  } catch (e) {
    return false;
  }
}

/**
 * Timeout wrapper for fetch
 */
function fetchWithTimeout(request, timeout = 7000) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('network-timeout')), timeout))
  ]);
}

/**
 * Trim cache to max entries (removes oldest entries first)
 */
async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    const deleteCount = keys.length - maxEntries;
    log(`Trimming cache ${cacheName}: removing ${deleteCount} entries`);
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
  } catch (e) {
    console.warn('trimCache error', e);
  }
}

/**
 * Store a response into cache (clone)
 */
async function putInCache(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch (e) {
    console.warn('putInCache error', e);
  }
}

/**
 * Read cached response only if still fresh according to the custom TTL in headers (best-effort)
 * When caching API responses we add a custom header "sw-cache-ts" inside the response clone body? (can't mutate Response headers).
 * Instead we rely on cache metadata TTL not available; so we can store timestamps in the Cache Storage key by using a special cache entry
 * but for simplicity we'll rely on network-first + fallback to cached response always; TTL trimming via periodic revalidation.
 */
async function matchCache(cacheName, request) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    return cached || null;
  } catch (e) {
    return null;
  }
}

/* ===========================
   Install & Activate
   =========================== */

self.addEventListener('install', event => {
  log('install event — version', SW_VERSION);
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(APP_SHELL);
      // Immediately take control of pages
      await self.skipWaiting();
      log('App shell cached and skipWaiting called');
    })()
  );
});

self.addEventListener('activate', event => {
  log('activate event — version', SW_VERSION);
  event.waitUntil(
    (async () => {
      // Clean up old caches that don't match current names
      const keys = await caches.keys();
      await Promise.all(keys.map(async key => {
        if (![STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE, API_CACHE].includes(key)) {
          log('Deleting old cache', key);
          await caches.delete(key);
        }
      }));

      // Claim clients immediately so the SW starts controlling the pages
      await self.clients.claim();

      // Notify clients that a new version is active (useful after skipWaiting)
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'NEW_VERSION', version: SW_VERSION });
      }
    })()
  );
});

/* ===========================
   Fetch handler (strategies)
   =========================== */
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = request.url;

  // Ignore non-GET requests (we don't cache POST/PUT etc)
  if (request.method !== 'GET') {
    return;
  }

  // Prefer to bypass SW for chrome-extension schemes
  if (url.startsWith('chrome-extension://')) return;

  // API/Sheets (network-first with cache fallback)
  if (isApiUrl(url)) {
    event.respondWith((async () => {
      try {
        const response = await fetchWithTimeout(request, API_NETWORK_TIMEOUT);
        // Cache a copy for fallback (if successful)
        if (response && response.status === 200) {
          putInCache(API_CACHE, request, response);
        }
        return response;
      } catch (err) {
        log('API network failed, attempting cache fallback', err.message);
        const cached = await matchCache(API_CACHE, request);
        if (cached) return cached;
        // last resort: try runtime cache
        const runtimeCached = await matchCache(RUNTIME_CACHE, request);
        if (runtimeCached) return runtimeCached;
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      }
    })());
    return;
  }

  // Navigation - HTML pages: network-first with fallback to index.html
  if (isNavigationRequest(request)) {
    event.respondWith((async () => {
      try {
        const response = await fetchWithTimeout(request, NAVIGATION_NETWORK_TIMEOUT);
        // cache index.html for offline fallback (using '/index.html' key)
        if (response && response.status === 200) {
          putInCache(RUNTIME_CACHE, '/index.html', response);
        }
        return response;
      } catch (err) {
        log('Navigation network failed, serving cached index.html if available', err.message);
        const cachedIndex = await matchCache(RUNTIME_CACHE, '/index.html') || await caches.match('/index.html');
        if (cachedIndex) return cachedIndex;
        return new Response('<h1>Offline</h1><p>Contenido no disponible.</p>', { headers: { 'Content-Type': 'text/html' } , status: 503});
      }
    })());
    return;
  }

  // Images: cache-first with trimming
  if (isImageUrl(url)) {
    event.respondWith((async () => {
      const cached = await matchCache(IMAGE_CACHE, request);
      if (cached) {
        // update LRU by re-putting (best-effort)
        log('Image cache hit', url);
        // Kick off background revalidation
        event.waitUntil((async () => {
          try {
            const networkResp = await fetch(request);
            if (networkResp && networkResp.status === 200) {
              await putInCache(IMAGE_CACHE, request, networkResp);
            }
          } catch (e) { /* ignore network failures */ }
          // Trim cache
          await trimCache(IMAGE_CACHE, IMAGE_CACHE_MAX_ENTRIES);
        })());
        return cached;
      }
      // No cached image: fetch and cache
      try {
        const networkResp = await fetch(request);
        if (networkResp && networkResp.status === 200) {
          await putInCache(IMAGE_CACHE, request, networkResp);
          // ensure we don't grow indefinitely
          await trimCache(IMAGE_CACHE, IMAGE_CACHE_MAX_ENTRIES);
        }
        return networkResp;
      } catch (err) {
        log('Image network failed, returning placeholder', err.message);
        return caches.match('/icons/logo-192.png') || new Response('', { status: 503 });
      }
    })());
    return;
  }

  // Styles/scripts/fonts: stale-while-revalidate
  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'font') {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cachedResp = await cache.match(request);
      const networkFetch = fetch(request).then(networkResp => {
        if (networkResp && networkResp.status === 200) {
          cache.put(request, networkResp.clone());
          // trim runtime cache
          trimCache(RUNTIME_CACHE, RUNTIME_CACHE_MAX_ENTRIES).catch(() => {});
        }
        return networkResp;
      }).catch(() => null);
      // Return cached if available otherwise wait for network
      return cachedResp || networkFetch;
    })());
    return;
  }

  // Default: network-first with cache fallback
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.status === 200) {
        putInCache(RUNTIME_CACHE, request, response);
      }
      return response;
    } catch (err) {
      const cached = await matchCache(RUNTIME_CACHE, request) || await caches.match(request);
      if (cached) return cached;
      // If the request expects HTML, fallback to index
      if ((request.headers.get('accept') || '').includes('text/html')) {
        return caches.match('/index.html');
      }
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    }
  })());
});

/* ===========================
   Background Sync
   =========================== */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cart') {
    log('Background sync: sync-cart triggered');
    event.waitUntil((async () => {
      // Placeholder: in a real app, we would read IndexedDB or clients to get pending orders
      // and attempt to send them to backend.
      try {
        // Simulated work
        await new Promise(res => setTimeout(res, 500));
        log('Background sync: simulated cart sync complete');
      } catch (e) {
        console.warn('Background sync error', e);
      }
    })());
  }
});

/* ===========================
   Push & Notification handlers
   =========================== */
self.addEventListener('push', (event) => {
  log('push received');
  let payload = {
    title: 'BEBU Store',
    body: 'Tienes una notificación',
    icon: '/icons/logo-192.png',
    badge: '/icons/logo-192.png',
    data: {}
  };
  if (event.data) {
    try {
      const d = event.data.json();
      payload = { ...payload, ...d };
    } catch (e) {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag || 'bebu-notification',
      data: payload.data || {}
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  log('notificationclick', event.notification && event.notification.data);
  event.notification.close();
  const urlToOpen = event.notification?.data?.url || '/';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if (client.url === urlToOpen && 'focus' in client) {
        return client.focus();
      }
    }
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  })());
});

/* ===========================
   Message Handling (client -> SW)
   =========================== */
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  log('message received from client', msg);
  if (!msg || !msg.type) return;

  if (msg.type === 'SKIP_WAITING') {
    log('SKIP_WAITING received — calling skipWaiting()');
    self.skipWaiting();
    return;
  }

  if (msg.type === 'CLEAR_CACHE') {
    log('CLEAR_CACHE received — deleting caches');
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      // notify client that caches were cleared
      const clientsList = await clients.matchAll();
      for (const c of clientsList) {
        c.postMessage({ type: 'CACHES_CLEARED' });
      }
    })());
    return;
  }

  if (msg.type === 'CACHE_URLS' && Array.isArray(msg.urls)) {
    log('CACHE_URLS received', msg.urls.length, 'urls');
    event.waitUntil((async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        await cache.addAll(msg.urls);
        log('CACHE_URLS done');
      } catch (e) {
        console.warn('CACHE_URLS failed', e);
      }
    })());
    return;
  }

  if (msg.type === 'GET_VERSION') {
    const sourceClientId = event.source && event.source.id;
    clients.matchAll().then(list => {
      for (const c of list) {
        if (c.id === sourceClientId) {
          c.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
          break;
        }
      }
    });
    return;
  }

  if (msg.type === 'CHECK_NEW_VERSION') {
    // When a client asks to check for a waiting worker, we reply if there's a waiting SW
    self.registration.then(reg => {
      if (reg && reg.waiting) {
        // notify clients that new version available
        clients.matchAll().then(list => {
          for (const c of list) {
            c.postMessage({ type: 'NEW_VERSION', version: SW_VERSION });
          }
        });
      }
    }).catch(() => {});
    return;
  }
});

/* ===========================
   Helper: Notify clients of NEW_VERSION when we activate
   (Also called from activate above)
   =========================== */
async function notifyClientsNewVersion() {
  try {
    const list = await clients.matchAll({ includeUncontrolled: true });
    for (const client of list) {
      client.postMessage({ type: 'NEW_VERSION', version: SW_VERSION });
    }
  } catch (e) {
    console.warn('notifyClientsNewVersion failed', e);
  }
}

/* ===========================
   End of file
   =========================== */
log('Service Worker loaded — version', SW_VERSION);