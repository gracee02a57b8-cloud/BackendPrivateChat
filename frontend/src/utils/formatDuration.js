/**
 * Format seconds into a human-readable duration string.
 * @param {number} sec - duration in seconds
 * @returns {string} formatted string like "0:00", "1:05", "5:00"
 */
export function formatDuration(sec) {
  if (sec == null || isNaN(sec)) return '0:00';
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const remainder = s % 60;
  return `${m}:${String(remainder).padStart(2, '0')}`;
}
