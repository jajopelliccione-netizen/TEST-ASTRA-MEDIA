const CACHE = 'astra-admin-v3';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      '/admin/dashboard.html',
      '/css/portal.css?v=3',
      '/admin/icon.png'
    ]))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Notifica push ricevuta dal server (FCM)
self.addEventListener('push', e => {
  let payload = {};
  try { payload = e.data ? e.data.json() : {}; } catch (_) {}
  // FCM v1 wrappa i dati in payload.notification
  const n     = payload.notification || payload;
  const title = n.title || 'Astra Agency';
  const body  = n.body  || 'Hai una nuova notifica';
  const url   = payload.fcmOptions?.link || payload.url || '/admin/dashboard.html';
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/admin/icon.png',
      badge: '/admin/icon.png',
      tag: 'astra-notif',
      renotify: true,
      data: { url }
    })
  );
});

// Click sulla notifica → apre la dashboard
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/admin/dashboard.html';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes('/admin/') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
