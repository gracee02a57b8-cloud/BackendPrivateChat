import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(ts: string | undefined): string {
  if (!ts) return '';
  const d = new Date(ts.includes?.('T') ? ts : ts.replace(' ', 'T'));
  if (isNaN(d.getTime())) return ts.slice(0, 5);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const day = 86400000;
  if (diff < day && d.getDate() === now.getDate()) return 'Сегодня';
  if (diff < 2 * day) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getInitials(name: string): string {
  return name?.charAt(0)?.toUpperCase() || '?';
}

const COLORS = [
  '#f87171','#fb923c','#fbbf24','#a3e635','#34d399',
  '#22d3ee','#60a5fa','#a78bfa','#f472b6','#e879f9',
];

export function getAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < (name?.length || 0); i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

export function formatLastSeen(ts: string | undefined): string {
  if (!ts) return 'давно';
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'только что';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин. назад`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч. назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
}
