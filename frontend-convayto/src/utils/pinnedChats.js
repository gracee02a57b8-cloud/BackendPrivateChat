// ==========================================
// Pinned Chats — localStorage persistence
// ==========================================

const STORAGE_KEY = "barsik_pinned_chats";

export function getPinnedChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isPinned(chatId) {
  return getPinnedChats().includes(chatId);
}

export function pinChat(chatId) {
  const pinned = getPinnedChats();
  if (!pinned.includes(chatId)) {
    pinned.unshift(chatId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
  }
}

export function unpinChat(chatId) {
  const pinned = getPinnedChats().filter((id) => id !== chatId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
}

export function togglePinChat(chatId) {
  if (isPinned(chatId)) {
    unpinChat(chatId);
    return false;
  } else {
    pinChat(chatId);
    return true;
  }
}
