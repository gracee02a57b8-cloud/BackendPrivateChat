/**
 * pushManager — registers service worker for push notifications
 * and manages push subscription with the backend.
 */
import appSettings from './appSettings.js';

// VAPID public key — must match the backend private key
// Generated once; hardcoded here, private key on server
const VAPID_PUBLIC_KEY = 'BNK2e0mE0mNMI2MkBGHqY7EPVCFVIRnFnLqFDOqJcO3TQWCRO5Fx-mHf5PUpiDdSgNFE2ywaUwjQHX25jZz_aw';

let swRegistration = null;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register push SW and subscribe to push notifications.
 * Call after login when token is available.
 */
export async function registerPush(token) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Push messaging not supported');
    return false;
  }

  if (!appSettings.pushEnabled) {
    console.log('[Push] Push disabled in settings');
    return false;
  }

  try {
    // Register the push service worker
    swRegistration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
    console.log('[Push] SW registered');

    // Wait for SW to be ready
    await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await swRegistration.pushManager.getSubscription();

    if (!subscription) {
      // Request permission
      const permission = await Notification.requestPermission();
      appSettings.savePermission('notification', permission);

      if (permission !== 'granted') {
        console.warn('[Push] Notification permission denied');
        return false;
      }

      // Subscribe to push
      subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Send subscription to backend
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(subscription.toJSON()),
    });

    console.log('[Push] Subscribed successfully');
    appSettings.savePermission('notification', 'granted');
    return true;
  } catch (err) {
    console.error('[Push] Registration failed:', err);
    return false;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unregisterPush(token) {
  try {
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.getRegistration('/push-sw.js');
    }
    if (!swRegistration) return;

    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      // Notify backend
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => {});

      await subscription.unsubscribe();
    }
    console.log('[Push] Unsubscribed');
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err);
  }
}

/**
 * Listen for messages from push-sw (e.g. PUSH_NAVIGATE)
 */
export function onPushMessage(callback) {
  if (!('serviceWorker' in navigator)) return () => {};
  const handler = (event) => {
    if (event.data && event.data.type) {
      callback(event.data);
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
