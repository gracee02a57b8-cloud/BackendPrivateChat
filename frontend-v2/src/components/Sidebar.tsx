// ═══════════════════════════════════════════════
//  Sidebar — Telegram-style left panel
// ═══════════════════════════════════════════════
import { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import ChatItem from '@/components/chat/ChatItem';
import Input from '@/components/ui/Input';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import ContactsPanel from '@/components/ContactsPanel';
import SettingsPanel from '@/components/SettingsPanel';
import MyProfilePage from '@/components/profile/MyProfilePage';
import CreateRoomModal from '@/components/CreateRoomModal';
import StoriesBar from '@/components/stories/StoriesBar';
import { Search, Menu, X, Plus, Settings, Moon, Sun, Monitor, Bookmark, Users, Pencil, LogOut, MessageSquare, Newspaper, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const { rooms, activeRoomId, setActiveRoom, username, avatarUrl, theme, setTheme, logout, view, setView, isMobile, setSidebarOpen, unreadMap } = useStore();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const avatarMap = useMemo(() => {
    const map: Record<string, string> = {};
    rooms.forEach((r) => {
      if (r.type === 'PRIVATE' && r.otherUser && r.avatarUrl) {
        map[r.otherUser] = r.avatarUrl;
      }
    });
    return map;
  }, [rooms]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = [...rooms];
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));
    // Sort: pinned first, then by lastMessageTime
    list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const ta = a.lastMessageTime || '';
      const tb = b.lastMessageTime || '';
      return tb.localeCompare(ta);
    });
    return list;
  }, [rooms, search]);

  const cycleTheme = () => {
    const next = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto';
    setTheme(next);
    window.dispatchEvent(new Event('theme-changed'));
  };

  const themeIcon = theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <Monitor size={18} />;
  const themeLabel = theme === 'dark' ? 'Тёмная тема' : theme === 'light' ? 'Светлая тема' : 'Авто (системная)';

  const selectRoom = (id: number) => {
    setActiveRoom(id);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div className="h-full flex flex-col bg-(--color-bg-sidebar) border-r border-(--color-border) relative">
      {/* Sub-views (contacts, settings, profile) */}
      {view === 'contacts' && (
        <div className="absolute inset-0 z-30 bg-(--color-bg-primary)">
          <ContactsPanel onClose={() => setView('chats')} />
        </div>
      )}
      {view === 'settings' && (
        <div className="absolute inset-0 z-30 bg-(--color-bg-primary)">
          <SettingsPanel onClose={() => setView('chats')} />
        </div>
      )}
      {view === 'profile' && (
        <div className="absolute inset-0 z-30 bg-(--color-bg-primary)">
          <MyProfilePage onClose={() => setView('chats')} />
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 h-14 shrink-0">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-(--color-bg-hover) transition-colors cursor-pointer"
          >
            <Menu size={20} className="text-(--color-text-secondary)" />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div className="absolute top-11 left-0 w-56 bg-(--color-bg-surface) border border-(--color-border) rounded-xl shadow-lg z-50 animate-scaleIn origin-top-left overflow-hidden">
              {/* User row */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-(--color-separator)">
                <Avatar src={avatarUrl} name={username || '?'} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{username}</p>
                </div>
              </div>
              <div className="py-1">
                <MenuBtn icon={<Bookmark size={18} />} label="Избранное" onClick={() => { setMenuOpen(false); }} />
                <MenuBtn icon={<Users size={18} />} label="Контакты" onClick={() => { setMenuOpen(false); setView('contacts'); }} />
                <MenuBtn icon={<Settings size={18} />} label="Настройки" onClick={() => { setMenuOpen(false); setView('settings'); }} />
                <MenuBtn icon={themeIcon} label={themeLabel} onClick={() => cycleTheme()} />
                <div className="h-px bg-(--color-separator) my-1" />
                <MenuBtn icon={<LogOut size={18} />} label="Выйти" onClick={() => { setMenuOpen(false); logout(); }} danger />
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="flex-1">
          <Input
            icon={<Search size={16} />}
            placeholder="Поиск"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* ── Stories ── */}
      <StoriesBar />

      {/* ── Chat List ── */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-(--color-text-tertiary)">
            <MessageSquare size={40} strokeWidth={1.5} className="mb-2 opacity-50" />
            <p className="text-sm">{search ? 'Ничего не найдено' : 'Нет чатов'}</p>
          </div>
        ) : (
          filtered.map((room) => (
            <ChatItem
              key={room.id}
              room={{ ...room, unreadCount: unreadMap[room.id] || room.unreadCount }}
              active={room.id === activeRoomId}
              username={username || ''}
              avatarMap={avatarMap}
              onClick={() => selectRoom(room.id)}
            />
          ))
        )}
      </div>

      {/* ── FAB (new chat) ── */}
      <button
        onClick={() => setShowCreateRoom(true)}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-(--color-accent) text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer z-10"
      >
        <Pencil size={22} />
      </button>

      {/* Create Room Modal */}
      {showCreateRoom && <CreateRoomModal onClose={() => setShowCreateRoom(false)} />}
    </div>
  );
}

function MenuBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer',
        danger ? 'text-(--color-danger) hover:bg-(--color-danger)/8' : 'text-(--color-text-primary) hover:bg-(--color-bg-hover)'
      )}
    >
      <span className={cn(danger ? 'text-(--color-danger)' : 'text-(--color-text-secondary)')}>{icon}</span>
      {label}
    </button>
  );
}
