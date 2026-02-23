import { useState, useEffect, useCallback } from 'react';
import appSettings from '../utils/appSettings';

/**
 * useMediaPermissions — proactively requests camera + microphone permissions
 * once on mount so that subsequent getUserMedia calls (calls, voice recorder,
 * video circle recorder) don't trigger browser permission popups.
 *
 * Flow:
 *   1. On mount, check via Permissions API if camera & mic are already 'granted'
 *   2. If already granted → done, save to localStorage
 *   3. If 'prompt' → show a friendly banner asking the user to grant access
 *   4. When user clicks "Grant" → call getUserMedia({ audio, video }) → immediately
 *      release tracks → browser remembers the permission
 *   5. On error (denied) → show a hint to enable in browser settings
 *
 * @returns {{ permissionsGranted, permissionsDenied, showBanner, requestPermissions }}
 */
const STORAGE_KEY = 'barsik_media_permissions_granted';

/**
 * Query a single permission name; returns 'granted' | 'denied' | 'prompt' | 'unknown'.
 */
async function queryPermission(name) {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name });
      return result.state; // 'granted' | 'denied' | 'prompt'
    }
  } catch {
    // Some browsers don't support querying 'camera' / 'microphone'
  }
  return 'unknown';
}

export default function useMediaPermissions() {
  const [permissionsGranted, setPermissionsGranted] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true'
  );
  const [permissionsDenied, setPermissionsDenied] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check current permission status on mount
  useEffect(() => {
    let cancelled = false;

    async function check() {
      // If getUserMedia is not available (e.g. HTTP or old browser), skip
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setChecking(false);
        return;
      }

      const [cam, mic] = await Promise.all([
        queryPermission('camera'),
        queryPermission('microphone'),
      ]);

      if (cancelled) return;

      if (cam === 'granted' && mic === 'granted') {
        // Already granted — persist and hide banner
        localStorage.setItem(STORAGE_KEY, 'true');
        setPermissionsGranted(true);
        setShowBanner(false);
      } else if (cam === 'denied' || mic === 'denied') {
        // Explicitly denied — show hint
        localStorage.removeItem(STORAGE_KEY);
        setPermissionsGranted(false);
        setPermissionsDenied(true);
        setShowBanner(true);
      } else {
        // 'prompt' or 'unknown' — need to ask
        // If localStorage says we granted before, re-verify with a quick getUserMedia
        if (localStorage.getItem(STORAGE_KEY) === 'true') {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            stream.getTracks().forEach(t => t.stop());
            if (!cancelled) {
              setPermissionsGranted(true);
              setShowBanner(false);
            }
          } catch {
            if (!cancelled) {
              localStorage.removeItem(STORAGE_KEY);
              setPermissionsGranted(false);
              setShowBanner(true);
            }
          }
        } else {
          setShowBanner(true);
        }
      }

      if (!cancelled) setChecking(false);
    }

    check();
    return () => { cancelled = true; };
  }, []);

  // Listen for permission changes (e.g. user revokes in browser settings)
  useEffect(() => {
    const controllers = [];

    async function listen() {
      for (const name of ['camera', 'microphone']) {
        try {
          if (navigator.permissions && navigator.permissions.query) {
            const status = await navigator.permissions.query({ name });
            const handler = () => {
              if (status.state === 'denied') {
                localStorage.removeItem(STORAGE_KEY);
                setPermissionsGranted(false);
                setPermissionsDenied(true);
                setShowBanner(true);
              } else if (status.state === 'granted') {
                // Re-check both
                Promise.all([
                  queryPermission('camera'),
                  queryPermission('microphone'),
                ]).then(([c, m]) => {
                  if (c === 'granted' && m === 'granted') {
                    localStorage.setItem(STORAGE_KEY, 'true');
                    setPermissionsGranted(true);
                    setPermissionsDenied(false);
                    setShowBanner(false);
                  }
                });
              }
            };
            status.addEventListener('change', handler);
            controllers.push({ status, handler });
          }
        } catch {
          // ignore
        }
      }
    }

    listen();
    return () => {
      controllers.forEach(({ status, handler }) => {
        status.removeEventListener('change', handler);
      });
    };
  }, []);

  /** User clicks "Grant permissions" — request getUserMedia and release */
  const requestPermissions = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // Immediately stop all tracks — we just needed the permission grant
      stream.getTracks().forEach(t => t.stop());
      localStorage.setItem(STORAGE_KEY, 'true');
      appSettings.savePermission('camera', 'granted');
      appSettings.savePermission('microphone', 'granted');
      setPermissionsGranted(true);
      setPermissionsDenied(false);
      setShowBanner(false);
    } catch (err) {
      console.warn('[MediaPermissions] Permission denied:', err.name);
      if (err.name === 'NotAllowedError') {
        setPermissionsDenied(true);
        appSettings.savePermission('camera', 'denied');
        appSettings.savePermission('microphone', 'denied');
      }
      // Don't hide the banner so user can retry or see hint
    }
  }, []);

  /** Dismiss the banner (user doesn't want to grant now) */
  const dismissBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  return {
    permissionsGranted,
    permissionsDenied,
    showBanner,
    checking,
    requestPermissions,
    dismissBanner,
  };
}
