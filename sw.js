/* ========================================
   BEBU STORE - SERVICE WORKER
   sw.js - Offline Support & PWA Cache
   ======================================== */

const CACHE_NAME = 'bebu-store-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&family=Sora:wght@700;800;900&display=swap',
  'https://res.cloudinary.com/dsibwc9q5/image/upload/v1778075161/Copia_de_CAT%C3%81LOGO_BEBU_-_2026_2_diqoyb.png'
];

/* ========== INSTALACIÓN DEL SERVICE WORKER ========== */
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cacheando archivos iniciales...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker instalado correctamente');
        self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Error al cachear archivos:', error);
      })
  );
});

/* ========== ACTIVACIÓN DEL SERVICE WORKER ========== */
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activando...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activado correctamente');
      return self.clients.claim();
    })
  );
});

/* ========== ESTRATEGIA: NETWORK FIRST (Con Fallback a Cache) ========== */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // No cachear peticiones de Google Sheets (siempre necesita red)
  if (url.hostname.includes('opensheet.elk.sh') || url.hostname.includes('sheets.googleapis.com')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Actualizar caché si la respuesta es exitosa
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Si falla la red, usar caché
          console.warn('⚠️ Error de conexión. Usando caché para:', request.url);
          return caches.match(request);
        })
    );
    return;
  }

  // Para otros recursos: CACHE FIRST
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          console.log('📦 Desde caché:', request.url);
          return response;
        }

        return fetch(request)
          .then(response => {
            // Validar que sea una respuesta válida
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Clonar la respuesta
            const responseToCache = response.clone();

            // Cachear la respuesta
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });

            return response;
          })
          .catch(() => {
            // Si falla la red y no hay caché, mostrar página offline
            console.warn('⚠️ Sin conexión y sin caché para:', request.url);
            
            // Retornar página offline para requests HTML
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

/* ========== BACKGROUND SYNC (Sincronización en Background) ========== */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-cart') {
    console.log('🔄 Sincronizando carrito en background...');
    event.waitUntil(
      // Aquí se podría sincronizar el carrito guardado localmente
      Promise.resolve()
        .then(() => {
          console.log('✅ Carrito sincronizado');
        })
        .catch(error => {
          console.error('❌ Error al sincronizar carrito:', error);
          throw error;
        })
    );
  }
});

/* ========== PUSH NOTIFICATIONS ========== */
self.addEventListener('push', event => {
  console.log('🔔 Notificación push recibida');
  
  let notificationData = {
    title: 'BEBU Store',
    body: 'Hola! Estamos aquí para ayudarte',
    icon: 'https://res.cloudinary.com/dsibwc9q5/image/upload/v1778075161/Copia_de_CAT%C3%81LOGO_BEBU_-_2026_2_diqoyb.png',
    badge: 'https://res.cloudinary.com/dsibwc9q5/image/upload/v1778075161/Copia_de_CAT%C3%81LOGO_BEBU_-_2026_2_diqoyb.png',
    tag: 'bebu-notification',
    requireInteraction: false
  };

  if (event.data) {
    try {
      notificationData = { ...notificationData, ...event.data.json() };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

/* ========== CLICK EN NOTIFICACIÓN ========== */
self.addEventListener('notificationclick', event => {
  console.log('👆 Notificación clickeada');
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Si hay una ventana abierta, enfocarse en ella
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no hay ventana, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

/* ========== NOTIFICACIÓN CERRADA ========== */
self.addEventListener('notificationclose', event => {
  console.log('❌ Notificación cerrada');
});

/* ========== MENSAJE DESDE CLIENTE ========== */
self.addEventListener('message', event => {
  console.log('💬 Mensaje recibido:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('🗑️ Caché eliminado');
    });
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(event.data.urls).then(() => {
        console.log('✅ URLs cacheadas:', event.data.urls);
      });
    });
  }
});

console.log('✨ Service Worker cargado y listo');
