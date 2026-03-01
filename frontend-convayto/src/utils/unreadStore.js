// ==========================================
// Unread message count store
// Persists to localStorage, notifies React subscribers
// ==========================================
const STORAGE_KEY = "barsik_unread";
const listeners = new Set();
let activeRoomId = null;

function getAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function save(counts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  listeners.forEach((cb) => cb({ ...counts }));
}

/** Increment unread count for a room (skipped if room is active) */
export function increment(roomId) {
  if (activeRoomId === roomId) return;
  const counts = getAll();
  counts[roomId] = (counts[roomId] || 0) + 1;
  save(counts);
}

/** Clear unread count for a room */
export function clear(roomId) {
  const counts = getAll();
  if (counts[roomId]) {
    delete counts[roomId];
    save(counts);
  }
}

/** Get unread count for a specific room */
export function getCount(roomId) {
  return getAll()[roomId] || 0;
}

/** Get all unread counts */
export function getCounts() {
  return getAll();
}

/** Subscribe to unread count changes; returns unsubscribe function */
export function subscribe(cb) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Mark a room as actively viewed (clears unread, blocks future increments) */
export function setActiveRoom(roomId) {
  activeRoomId = roomId;
  if (roomId) clear(roomId);
}

/** Get currently active room */
export function getActiveRoom() {
  return activeRoomId;
}

/** @internal Reset all state — for tests only */
export function _reset() {
  activeRoomId = null;
  listeners.clear();
  localStorage.removeItem(STORAGE_KEY);
}
