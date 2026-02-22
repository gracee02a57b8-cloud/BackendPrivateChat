import { describe, it, expect } from 'vitest';

// ====== formatLastSeen ======
// Replicated from Sidebar.jsx for unit testing
function formatLastSeen(ts) {
  if (!ts) return 'Не в сети';
  const d = new Date(ts.includes?.('T') ? ts : ts.replace(' ', 'T'));
  if (isNaN(d.getTime())) return 'Не в сети';
  const now = new Date();
  const diff = now - d;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (diff < 60000) return 'был(а) только что';
  if (diff < 3600000) return `был(а) ${Math.floor(diff / 60000)} мин. назад`;
  if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
    return `был(а) в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear()) {
    return `был(а) вчера в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diff < 7 * 86400000) {
    const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    return `был(а) ${days[d.getDay()]}`;
  }
  return `был(а) ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
}

// ====== formatTime ======
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts.includes?.('T') ? ts : ts.replace(' ', 'T'));
  if (isNaN(d.getTime())) {
    if (/^\d{2}:\d{2}/.test(ts)) return ts.slice(0, 5);
    return '';
  }
  const now = new Date();
  const diff = now - d;
  const oneDay = 86400000;
  if (diff < oneDay && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth()) {
    return 'Вчера';
  }
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  if (diff < 7 * oneDay) return days[d.getDay()];
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// ====== Sorting logic ======
function getLastMessageTime(room, messagesByRoom) {
  const msgs = messagesByRoom[room.id];
  if (!msgs || msgs.length === 0) return 0;
  let lastMsg = null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].type === 'CHAT' || msgs[i].type === 'PRIVATE') { lastMsg = msgs[i]; break; }
  }
  if (!lastMsg) lastMsg = msgs[msgs.length - 1];
  if (!lastMsg?.timestamp) return 0;
  const d = new Date(lastMsg.timestamp.includes?.('T') ? lastMsg.timestamp : lastMsg.timestamp.replace(' ', 'T'));
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function getSortedRooms(rooms, chatFilter, searchFilter, unreadCounts, messagesByRoom, username) {
  let list = [...rooms];

  if (chatFilter === 'private') {
    list = list.filter(r => r.type === 'PRIVATE');
  } else if (chatFilter === 'groups') {
    list = list.filter(r => r.type === 'ROOM' || r.type === 'GENERAL');
  } else if (chatFilter === 'unread') {
    list = list.filter(r => (unreadCounts[r.id] || 0) > 0);
  }

  if (searchFilter.trim()) {
    const q = searchFilter.toLowerCase();
    list = list.filter(r => {
      const name = r.type === 'PRIVATE'
        ? (r.name.split(' & ').find(p => p !== username) || r.name)
        : r.name;
      return name.toLowerCase().includes(q);
    });
  }

  list.sort((a, b) => getLastMessageTime(b, messagesByRoom) - getLastMessageTime(a, messagesByRoom));
  return list;
}

// ====================================================================
// Tests
// ====================================================================

describe('formatLastSeen', () => {
  it('returns "Не в сети" for null', () => {
    expect(formatLastSeen(null)).toBe('Не в сети');
  });

  it('returns "Не в сети" for undefined', () => {
    expect(formatLastSeen(undefined)).toBe('Не в сети');
  });

  it('returns "Не в сети" for invalid date', () => {
    expect(formatLastSeen('not-a-date')).toBe('Не в сети');
  });

  it('returns "был(а) только что" for <1 min ago', () => {
    const ts = new Date(Date.now() - 30000).toISOString();
    expect(formatLastSeen(ts)).toBe('был(а) только что');
  });

  it('returns minutes ago for <1 hour', () => {
    const ts = new Date(Date.now() - 15 * 60000).toISOString();
    expect(formatLastSeen(ts)).toMatch(/был\(а\) 1[45] мин\. назад/);
  });

  it('returns "был(а) в HH:MM" for earlier today', () => {
    const d = new Date();
    d.setHours(d.getHours() - 3);
    if (d.getDate() !== new Date().getDate()) return; // skip if crosses midnight
    const ts = d.toISOString();
    expect(formatLastSeen(ts)).toMatch(/был\(а\) в \d{2}:\d{2}/);
  });

  it('returns "был(а) вчера" for yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(14, 30, 0, 0);
    const ts = d.toISOString();
    expect(formatLastSeen(ts)).toMatch(/был\(а\) вчера в \d{2}:\d{2}/);
  });

  it('returns day name for this week', () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const ts = d.toISOString();
    expect(formatLastSeen(ts)).toMatch(/был\(а\) (пн|вт|ср|чт|пт|сб|вс)/);
  });

  it('returns date for older timestamps', () => {
    const ts = '2025-06-15 10:00:00';
    expect(formatLastSeen(ts)).toMatch(/был\(а\)/);
  });

  it('handles space-separated timestamps', () => {
    const d = new Date(Date.now() - 20000);
    const ts = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');
    expect(formatLastSeen(ts)).toBe('был(а) только что');
  });
});

describe('getSortedRooms — Unified sorted chat list', () => {
  const rooms = [
    { id: 'general', name: 'General', type: 'GENERAL' },
    { id: 'pm-1', name: 'alice & bob', type: 'PRIVATE' },
    { id: 'pm-2', name: 'alice & carol', type: 'PRIVATE' },
    { id: 'room-1', name: 'Dev Room', type: 'ROOM' },
    { id: 'room-2', name: 'Design', type: 'ROOM' },
  ];

  const messagesByRoom = {
    'general': [{ type: 'CHAT', timestamp: '2026-02-22 10:00:00', sender: 'x' }],
    'pm-1': [{ type: 'PRIVATE', timestamp: '2026-02-22 12:00:00', sender: 'bob' }],
    'pm-2': [{ type: 'PRIVATE', timestamp: '2026-02-22 08:00:00', sender: 'carol' }],
    'room-1': [{ type: 'CHAT', timestamp: '2026-02-22 14:00:00', sender: 'y' }],
    'room-2': [],
  };

  const unreadCounts = { 'pm-1': 3, 'room-1': 1 };

  it('returns all rooms sorted by last message time (newest first)', () => {
    const result = getSortedRooms(rooms, 'all', '', {}, messagesByRoom, 'alice');
    expect(result.map(r => r.id)).toEqual(['room-1', 'pm-1', 'general', 'pm-2', 'room-2']);
  });

  it('filters private rooms only', () => {
    const result = getSortedRooms(rooms, 'private', '', {}, messagesByRoom, 'alice');
    expect(result.every(r => r.type === 'PRIVATE')).toBe(true);
    expect(result.length).toBe(2);
  });

  it('filters groups (ROOM + GENERAL)', () => {
    const result = getSortedRooms(rooms, 'groups', '', {}, messagesByRoom, 'alice');
    expect(result.every(r => r.type === 'ROOM' || r.type === 'GENERAL')).toBe(true);
    expect(result.length).toBe(3);
  });

  it('filters unread rooms', () => {
    const result = getSortedRooms(rooms, 'unread', '', unreadCounts, messagesByRoom, 'alice');
    expect(result.map(r => r.id)).toEqual(['room-1', 'pm-1']);
  });

  it('returns empty for unread filter when no unread', () => {
    const result = getSortedRooms(rooms, 'unread', '', {}, messagesByRoom, 'alice');
    expect(result.length).toBe(0);
  });

  it('applies text search filter', () => {
    const result = getSortedRooms(rooms, 'all', 'dev', {}, messagesByRoom, 'alice');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Dev Room');
  });

  it('search filter works for private chat display names', () => {
    const result = getSortedRooms(rooms, 'all', 'bob', {}, messagesByRoom, 'alice');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('pm-1');
  });

  it('search is case-insensitive', () => {
    const result = getSortedRooms(rooms, 'all', 'DESIGN', {}, messagesByRoom, 'alice');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Design');
  });

  it('rooms without messages sort to the end', () => {
    const result = getSortedRooms(rooms, 'all', '', {}, messagesByRoom, 'alice');
    expect(result[result.length - 1].id).toBe('room-2');
  });

  it('combines filter + search', () => {
    const result = getSortedRooms(rooms, 'groups', 'gen', {}, messagesByRoom, 'alice');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('general');
  });
});

describe('formatTime', () => {
  it('returns empty for null', () => {
    expect(formatTime(null)).toBe('');
  });

  it('returns empty for empty string', () => {
    expect(formatTime('')).toBe('');
  });

  it('returns HH:MM for today', () => {
    const ts = new Date().toISOString();
    expect(formatTime(ts)).toMatch(/\d{2}:\d{2}/);
  });

  it('returns "Вчера" for yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(12, 0, 0, 0);
    expect(formatTime(d.toISOString())).toBe('Вчера');
  });

  it('returns day abbreviation for this week', () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    expect(formatTime(d.toISOString())).toMatch(/^(Вс|Пн|Вт|Ср|Чт|Пт|Сб)$/);
  });

  it('handles HH:MM format directly', () => {
    expect(formatTime('14:30')).toBe('14:30');
  });
});
