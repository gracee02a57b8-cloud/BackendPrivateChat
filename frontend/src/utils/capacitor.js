/**
 * Capacitor native bridge — initializes plugins on Android/iOS.
 * Safe to import on web — every call is guarded by Capacitor.isNativePlatform().
 */
import { Capacitor } from '@capacitor/core';

/** True when running inside the native Android/iOS shell */
export const isNative = Capacitor.isNativePlatform();

/** Platform: 'android' | 'ios' | 'web' */
export const platform = Capacitor.getPlatform();

/**
 * Initialize all native plugins — called once from main.jsx.
 * On web this is a no-op.
 */
export async function initCapacitor() {
  if (!isNative) return;

  try {
    // ── Status Bar ──
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#e8eef5' });
    await StatusBar.setOverlaysWebView({ overlay: false });

    // ── Keyboard ──
    const { Keyboard } = await import('@capacitor/keyboard');
    // Resize body when keyboard opens (better for chat input)
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty(
        '--keyboard-height', `${info.keyboardHeight}px`
      );
      document.body.classList.add('keyboard-open');
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.body.classList.remove('keyboard-open');
    });

    // ── Hardware Back Button ──
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      // Dispatch a custom event so React components can handle it
      const event = new CustomEvent('capacitor:backButton', {
        detail: { canGoBack },
      });
      window.dispatchEvent(event);

      // Default: if nothing handled it, minimize app
      if (!event.defaultPrevented && !canGoBack) {
        App.minimizeApp();
      }
    });

    // Handle app state changes (background/foreground)
    App.addListener('appStateChange', ({ isActive }) => {
      window.dispatchEvent(
        new CustomEvent('capacitor:appState', { detail: { isActive } })
      );
    });

    console.log('[Capacitor] Native plugins initialized ✓');
  } catch (err) {
    console.warn('[Capacitor] Plugin init error:', err);
  }
}

/**
 * Trigger haptic feedback (light tap).
 * Safe to call on web — will be a no-op.
 */
export async function hapticTap() {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* ignore */ }
}

/**
 * Trigger success haptic feedback.
 */
export async function hapticSuccess() {
  if (!isNative) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch { /* ignore */ }
}
