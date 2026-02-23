/* eslint-disable no-restricted-globals */
/**
 * BarsikChat custom push-notification service worker.
 * Handles push events and notification clicks.
 * This is separate from the VitePWA workbox service worker.
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'BarsikChat', body: event.data.text() };
  }

  const title = data.title || 'BarsikChat';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'barsik-push',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      roomId: data.roomId || null,
      type: data.type || 'message',
    },
  };

  // For calls — persistent notification with actions
  if (data.type === 'call') {
    options.requireInteraction = true;
    options.tag = 'barsik-call';
    options.vibrate = [300, 200, 300, 200, 300];
    options.actions = [
      { action: 'answer', title: '📞 Ответить' },
      { action: 'decline', title: '❌ Отклонить' },
    ];
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  event.notification.close();

  // Focus existing tab or open a new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Try to focus an existing BarsikChat tab
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          // Send message to client to navigate to the room
          if (data.roomId) {
            client.postMessage({ type: 'PUSH_NAVIGATE', roomId: data.roomId });
          }
          return;
        }
      }
      // No existing tab — open new
      const url = data.url || '/';
      return self.clients.openWindow(url);
    })
  );
});
