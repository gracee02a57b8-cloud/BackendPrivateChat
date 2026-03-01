// ══════════════════════════════════════════════════════════
// BarsikChat — Push Notification Service Worker
// ══════════════════════════════════════════════════════════

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "BarsikChat", body: event.data.text() };
  }

  const title = data.title || "BarsikChat";
  const body = data.body || "Новое уведомление";
  const type = data.type || "message";
  const tag = data.tag || "barsik-" + type;

  const icon = "/images/barsik-logo.svg";
  const badge = "/images/barsik-logo.svg";

  const options = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/",
      type,
      roomId: data.roomId || null,
    },
  };

  // Different notification style based on type
  if (type === "call" || type === "video-call") {
    options.requireInteraction = true;
    options.vibrate = [300, 100, 300, 100, 300];
    options.actions = [
      { action: "answer", title: "Ответить" },
      { action: "decline", title: "Отклонить" },
    ];
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = data.url || "/";

  if (data.type === "call" || data.type === "video-call") {
    if (event.action === "decline") return;
    url = "/";
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("notificationclose", () => {
  // Cleanup if needed
});
