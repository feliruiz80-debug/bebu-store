'use strict';

const SW_VERSION = '2026.08.22_v3';
const CACHE_PREFIX = 'bebu';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${SW_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${SW_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${SW_VERSION}`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/logo.png'
];

const API_HOSTNAMES = ['docs.google.com', 'opensheet.elk.sh', 'sheets.googleapis.com'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];

const IMAGE_CACHE_MAX_ENTRIES = 120;
const RUNTIME_CACHE_MAX_ENTRIES = 200;
const API_CACHE_TTL_MS = 1000 * 60 * 2;
const NAVIGATION_NETWORK_TIMEOUT = 7000;
const API_NETWORK_TIMEOUT = 8000;

function log(...args) {
  const ENABLE_LOG = false;
  if (ENABLE_LOG) console.debug('[SW]', ...args);
}

function isApiUrl(url) {
  try {
    const u = new URL(url);
    return API_HOSTNAMES.some(h => u.hostname.includes(h));
  } catch (e) {
    return false;
  }
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html'));
}

function isImageUrl(url) {
  try {
    const u = new URL(url);
    return IMAGE_EXTENSIONS.some(ext => u.pathname.toLowerCase().endsWith(ext));
  } catch (e) {
    return false;
  }
}

function fetchWithTimeout(request, timeout = 7000) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('network-timeout')), timeout))
  ]);
}

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
    console.warn('[SW] trimCache error', e);
  }
}

async function putInCache(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch (e) {
    console.warn('[SW] putInCache error', e);
  }
}

async function matchCache(cacheName, request) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    return cached || null;
  } catch (e) {
    return null;
  }
}

self.addEventListener('install', event => {
  log('install event — version', SW_VERSION);
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        await cache.addAll(APP_SHELL);
        await self.skipWaiting();
        log('App shell cached and skipWaiting called');
      } catch (e) {
        console.warn('[SW] install: cache.addAll failed', e);
      }
    })()
  );
});

self.addEventListener('activate', event => {
  log('activate event — version', SW_VERSION);
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(async key => {
          if (![STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE, API_CACHE].includes(key)) {
            log('Deleting old cache', key);
            await caches.delete(key);
          }
        }));

        await self.clients.claim();

        const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
        for (const client of clientsList) {
          client.postMessage({ type: 'NEW_VERSION', version: SW_VERSION });
        }
      } catch (e) {
        console.warn('[SW] activate error', e);
      }
    })()
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = request.url;

  if (request.method !== 'GET') {
    return;
  }

  if (url.startsWith('chrome-extension://')) return;

  if (isApiUrl(url)) {
    event.respondWith((async () => {
      try {
        const response = await fetchWithTimeout(request, API_NETWORK_TIMEOUT);
        if (response && response.status === 200) {
          putInCache(API_CACHE, request, response);
        }
        return response;
      } catch (err) {
        log('API network failed, attempting cache fallback', err.message);
        const cached = await matchCache(API_CACHE, request);
        if (cached) return cached;
        const runtimeCached = await matchCache(RUNTIME_CACHE, request);
        if (runtimeCached) return runtimeCached;
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      }
    })());
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith((async () => {
      try {
        const response = await fetchWithTimeout(request, NAVIGATION_NETWORK_TIMEOUT);
        if (response && response.status === 200) {
          await putInCache(RUNTIME_CACHE, '/index.html', response);
        }
        return response;
      } catch (err) {
        log('Navigation network failed, serving cached index.html if available', err.message);
        const cachedIndex = await matchCache(RUNTIME_CACHE, '/index.html') || await caches.match('/index.html');
        if (cachedIndex) return cachedIndex;
        return new Response('<h1>Offline</h1><p>Contenido no disponible.</p>', { 
          headers: { 'Content-Type': 'text/html' }, 
          status: 503 
        });
      }
    })());
    return;
  }

  if (isImageUrl(url)) {
    event.respondWith((async () => {
      const cached = await matchCache(IMAGE_CACHE, request);
      if (cached) {
        log('Image cache hit', url);
        event.waitUntil((async () => {
          try {
            const networkResp = await fetch(request);
            if (networkResp && networkResp.status === 200) {
              await putInCache(IMAGE_CACHE, request, networkResp);
            }
          } catch (e) {}
          await trimCache(IMAGE_CACHE, IMAGE_CACHE_MAX_ENTRIES);
        })());
        return cached;
      }
      try {
        const networkResp = await fetch(request);
        if (networkResp && networkResp.status === 200) {
          await putInCache(IMAGE_CACHE, request, networkResp);
          await trimCache(IMAGE_CACHE, IMAGE_CACHE_MAX_ENTRIES);
        }
        return networkResp;
      } catch (err) {
        log('Image network failed, returning fallback', err.message);
        return caches.match('/logo.png') || new Response('', { status: 503 });
      }
    })());
    return;
  }

  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'font') {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cachedResp = await cache.match(request);
      const networkFetch = fetch(request).then(networkResp => {
        if (networkResp && networkResp.status === 200) {
          cache.put(request, networkResp.clone());
          trimCache(RUNTIME_CACHE, RUNTIME_CACHE_MAX_ENTRIES).catch(() => {});
        }
        return networkResp;
      }).catch(() => null);
      return cachedResp || networkFetch;
    })());
    return;
  }

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
      if ((request.headers.get('accept') || '').includes('text/html')) {
        return caches.match('/index.html');
      }
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    }
  })());
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cart') {
    log('Background sync: sync-cart triggered');
    event.waitUntil((async () => {
      try {
        await new Promise(res => setTimeout(res, 500));
        log('Background sync: cart sync complete');
      } catch (e) {
        console.warn('[SW] Background sync error', e);
      }
    })());
  }
});

self.addEventListener('push', (event) => {
  log('push received');
  let payload = {
    title: '🎉 BEBU Store',
    body: 'Tienes una notificación',
    icon: '/logo.png',
    badge: '/logo.png',
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
      try {
        if (new URL(client.url).pathname === new URL(urlToOpen, location.origin).pathname && 'focus' in client) {
          return client.focus();
        }
      } catch (e) {}
    }
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  })());
});

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
        console.warn('[SW] CACHE_URLS failed', e);
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
    try {
      if (self.registration && self.registration.waiting) {
        (async () => {
          const list = await clients.matchAll({ includeUncontrolled: true });
          for (const c of list) {
            c.postMessage({ type: 'NEW_VERSION', version: SW_VERSION });
          }
        })();
      }
    } catch (e) {
      console.warn('[SW] CHECK_NEW_VERSION error', e);
    }
    return;
  }
});

async function notifyClientsNewVersion() {
  try {
    const list = await clients.matchAll({ includeUncontrolled: true });
    for (const client of list) {
      client.postMessage({ type: 'NEW_VERSION', version: SW_VERSION });
    }
  } catch (e) {
    console.warn('[SW] notifyClientsNewVersion failed', e);
  }
}

log('Service Worker loaded — version', SW_VERSION);
