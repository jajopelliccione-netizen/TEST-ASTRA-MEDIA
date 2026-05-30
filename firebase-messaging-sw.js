importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyCOQaxFQ5qzOu7cjfaRmGkk4XlqySh4BcA",
  authDomain:        "astragency-88b1a.firebaseapp.com",
  projectId:         "astragency-88b1a",
  storageBucket:     "astragency-88b1a.firebasestorage.app",
  messagingSenderId: "1038793326642",
  appId:             "1:1038793326642:web:b6e1fb1719bed36a7abc2b"
});

const messaging = firebase.messaging();

// Notifiche in background (app chiusa/minimizzata)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Astra Agency';
  const body  = payload.notification?.body  || 'Nuova notifica';
  self.registration.showNotification(title, {
    body,
    icon:     '/admin/icon.png',
    badge:    '/admin/icon.png',
    tag:      'astra-notif',
    renotify: true,
    data:     { url: '/admin/dashboard.html' }
  });
});

self.addEventListener('notificationclick', (e) => {
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
