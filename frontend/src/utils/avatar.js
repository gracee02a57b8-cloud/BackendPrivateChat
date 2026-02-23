/**
 * Shared avatar & user display utilities.
 * Extracted from 12+ components to eliminate duplication.
 */

const AVATAR_COLORS = [
  '#e94560', '#4ecca3', '#f0a500', '#a855f7',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
];

/**
 * Deterministic color for a username.
 * @param {string} name
 * @returns {string} hex color
 */
export function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * First letter(s) of a display name (up to 2 words).
 * @param {string} name
 * @returns {string} initials (1-2 chars)
 */
export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS     = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/**
 * "был(а) …" label for last-seen timestamp.
 * @param {string} ts  ISO-8601 or space-delimited timestamp
 * @returns {string}
 */
export function formatLastSeen(ts) {
  if (!ts) return 'не в сети';
  try {
    const d = new Date(ts.includes?.('T') ? ts : ts.replace(' ', 'T'));
    if (isNaN(d.getTime())) return 'не в сети';

    const now  = new Date();
    const diff = now - d;

    // less than 1 minute
    if (diff < 60_000) return 'был(а) только что';

    // less than 1 hour
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `был(а) ${mins} мин. назад`;

    // today
    if (d.toDateString() === now.toDateString()) {
      return `был(а) в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `был(а) вчера в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // within 7 days
    if (diff < 7 * 86_400_000) {
      return `был(а) в ${WEEKDAYS[d.getDay()]}`;
    }

    // older
    return `был(а) ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  } catch {
    return 'не в сети';
  }
}
