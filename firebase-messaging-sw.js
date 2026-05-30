// Gestisce push in background con evento nativo (compatibile iOS 16.4+)
self.addEventListener('push', event => {
  let title = 'Astra Agency';
  let body  = 'Nuova notifica';

  if (event.data) {
    try {
      const d = event.data.json();
      // FCM può mandare i dati in notification, webpush.notification o data
      title = d.notification?.title || d.data?.title || title;
      body  = d.notification?.body  || d.data?.body  || body;
    } catch (e) { /* payload non-JSON, usa defaults */ }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:        '/admin/icon.png',
      badge:       '/admin/icon.png',
      tag:         'astra-notif',
      renotify:    true,
      data:        { url: '/admin/dashboard.html' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/admin/dashboard.html';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes('/admin/') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
