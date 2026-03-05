// ══════════════════════════════════════════════════════════
// BarsikChat — Push Notification Service
// Handles Web Push subscription lifecycle (VAPID-based)
// ══════════════════════════════════════════════════════════

const SW_PATH = "/push-sw.js";

/**
 * Convert a URL-safe base64 VAPID key to a Uint8Array for subscribe()
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Register the service worker and subscribe to push notifications.
 * Called after successful login / profile load.
 */
export async function initPushNotifications() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // Check user preference
    if (localStorage.getItem("pushEnabled") === "false") return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.register(SW_PATH);
    await navigator.serviceWorker.ready;

    // Get VAPID public key from backend
    const token = localStorage.getItem("token");
    const res = await fetch("/api/push/vapid-key", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const { vapidPublicKey } = await res.json();
    if (!vapidPublicKey) return;

    // Subscribe (or reuse existing subscription)
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    // Send subscription to backend
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")))),
          auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")))),
        },
      }),
    });
  } catch (err) {
    console.warn("[Push] Failed to init push notifications:", err.message);
  }
}

/**
 * Unsubscribe from push notifications.
 * Called during signout.
 */
export async function unsubscribePush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!reg) return;

    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    // Notify backend
    const token = localStorage.getItem("token");
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});

    // Unsubscribe locally
    await sub.unsubscribe();
  } catch (err) {
    console.warn("[Push] Failed to unsubscribe:", err.message);
  }
}
