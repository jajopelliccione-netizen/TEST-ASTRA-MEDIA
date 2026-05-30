const CACHE = 'astra-admin-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      '/admin/dashboard.html',
      '/css/portal.css?v=3',
      '/logo.png'
    ]))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Notifica push ricevuta dal server (FCM)
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Astra Agency', {
      body: data.body || 'Hai una nuova notifica',
      icon: '/admin/icon.png',
      badge: '/admin/icon.png',
      tag: data.tag || 'astra-notif',
      renotify: true,
      data: { url: data.url || '/admin/dashboard.html' }
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
