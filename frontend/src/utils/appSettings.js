/**
 * appSettings — persistent settings stored in localStorage.
 *
 * Keys:
 *   barsik_notifSound   – notification sound enabled (true/false)
 *   barsik_callSound    – call ringtone enabled (true/false)
 *   barsik_pushEnabled  – push notifications enabled (true/false)
 *   barsik_permissions  – JSON of granted permissions { camera, microphone, notification }
 */

const DEFAULTS = {
  notifSound: true,
  callSound: true,
  pushEnabled: true,
};

function get(key) {
  try {
    const raw = localStorage.getItem(`barsik_${key}`);
    if (raw === null) return DEFAULTS[key] ?? null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
  } catch {
    return DEFAULTS[key] ?? null;
  }
}

function set(key, value) {
  try {
    localStorage.setItem(`barsik_${key}`, String(value));
  } catch {
    // localStorage full or unavailable
  }
}

const appSettings = {
  // ─── Sound ───
  get notifSound() { return get('notifSound'); },
  set notifSound(v) { set('notifSound', v); },

  get callSound() { return get('callSound'); },
  set callSound(v) { set('callSound', v); },

  // ─── Push ───
  get pushEnabled() { return get('pushEnabled'); },
  set pushEnabled(v) { set('pushEnabled', v); },

  // ─── Permissions memory ───
  getPermissions() {
    try {
      const raw = localStorage.getItem('barsik_permissions');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  savePermission(name, state) {
    // state: 'granted', 'denied', 'prompt'
    const perms = this.getPermissions();
    perms[name] = state;
    try {
      localStorage.setItem('barsik_permissions', JSON.stringify(perms));
    } catch {
      // noop
    }
  },

  isPermissionGranted(name) {
    return this.getPermissions()[name] === 'granted';
  },
};

export default appSettings;
