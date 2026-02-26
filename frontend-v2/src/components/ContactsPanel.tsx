// ═══════════════════════════════════════════════
//  Contacts Panel
// ═══════════════════════════════════════════════
import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import Avatar from '@/components/ui/Avatar';
import { Search, ArrowLeft, UserPlus } from 'lucide-react';
import { createPrivateRoom, searchUsers } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ContactsPanelProps {
  onClose: () => void;
}

export default function ContactsPanel({ onClose }: ContactsPanelProps) {
  const { token, username, contacts, users, onlineUsers, avatarMap, addRoom, setActiveRoom, setSidebarOpen } = useStore();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'contacts' | 'online'>('contacts');

  const contactList = useMemo(() => {
    const q = search.toLowerCase();
    const list = tab === 'contacts' ? contacts : users.filter((u) => onlineUsers.includes(u.username));
    return list
      .filter((u) => u.username !== username && u.username.toLowerCase().includes(q))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [contacts, users, onlineUsers, search, tab, username]);

  const handleChat = async (target: string) => {
    if (!token) return;
    try {
      const room = await createPrivateRoom(token, target);
      addRoom(room);
      setActiveRoom(room.id);
      setSidebarOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Group by first letter
  const grouped = useMemo(() => {
    const map = new Map<string, typeof contactList>();
    contactList.forEach((c) => {
      const letter = c.username[0].toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(c);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [contactList]);

  return (
    <div className="flex flex-col h-full bg-(--color-bg-primary)">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 bg-(--color-bg-surface) border-b border-(--color-separator) shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
          <ArrowLeft size={22} />
        </button>
        <h2 className="text-base font-semibold flex-1">Контакты</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-(--color-separator) bg-(--color-bg-surface)">
        <button
          onClick={() => setTab('contacts')}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium cursor-pointer transition-colors',
            tab === 'contacts' ? 'text-(--color-accent) border-b-2 border-(--color-accent)' : 'text-(--color-text-secondary)'
          )}
        >
          Контакты ({contacts.length})
        </button>
        <button
          onClick={() => setTab('online')}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium cursor-pointer transition-colors',
            tab === 'online' ? 'text-(--color-accent) border-b-2 border-(--color-accent)' : 'text-(--color-text-secondary)'
          )}
        >
          В сети ({onlineUsers.length})
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-2 bg-(--color-bg-surface)">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-tertiary)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск"
            className="w-full pl-9 pr-3 py-2 text-sm bg-(--color-bg-tertiary) rounded-lg outline-none focus:ring-1 focus:ring-(--color-accent)"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-(--color-text-tertiary)">
            <p className="text-sm">{search ? 'Не найдено' : 'Нет контактов'}</p>
          </div>
        ) : (
          grouped.map(([letter, items]) => (
            <div key={letter}>
              <div className="px-4 py-1.5 text-xs font-semibold text-(--color-accent) bg-(--color-bg-tertiary)/50">
                {letter}
              </div>
              {items.map((u) => (
                <button
                  key={u.username}
                  onClick={() => handleChat(u.username)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-(--color-bg-hover) transition-colors cursor-pointer"
                >
                  <Avatar
                    src={avatarMap[u.username] || u.avatarUrl}
                    name={u.username}
                    size="md"
                    online={onlineUsers.includes(u.username)}
                  />
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium truncate">{u.username}</p>
                    {u.tag && <p className="text-xs text-(--color-text-tertiary)">@{u.tag}</p>}
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
