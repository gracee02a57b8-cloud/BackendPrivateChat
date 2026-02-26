// ═══════════════════════════════════════════════
//  Create Room Modal
// ═══════════════════════════════════════════════
import { useState } from 'react';
import { useStore } from '@/store';
import { createRoom, createPrivateRoom, getSavedMessagesRoom } from '@/lib/api';
import { X, Users, MessageSquare, Bookmark, Search } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

interface CreateRoomModalProps {
  onClose: () => void;
}

export default function CreateRoomModal({ onClose }: CreateRoomModalProps) {
  const { token, username, users, addRoom, setActiveRoom } = useStore();
  const [tab, setTab] = useState<'private' | 'group'>('private');
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = users.filter(
    (u) => u.username !== username && u.username.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrivate = async (targetUser: string) => {
    if (!token) return;
    setCreating(true);
    try {
      const room = await createPrivateRoom(token, targetUser);
      addRoom(room);
      setActiveRoom(room.id);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleSaved = async () => {
    if (!token) return;
    setCreating(true);
    try {
      const room = await getSavedMessagesRoom(token);
      addRoom(room);
      setActiveRoom(room.id);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleGroup = async () => {
    if (!token || !groupName.trim()) return;
    setCreating(true);
    try {
      const room = await createRoom(token, groupName.trim());
      addRoom(room);
      setActiveRoom(room.id);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-(--color-bg-surface) rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-scaleIn max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-separator)">
          <h2 className="text-base font-semibold">Новый чат</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-(--color-separator)">
          <button
            onClick={() => setTab('private')}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors cursor-pointer',
              tab === 'private' ? 'text-(--color-accent) border-b-2 border-(--color-accent)' : 'text-(--color-text-secondary)'
            )}
          >
            <MessageSquare size={16} className="inline mr-1.5 -mt-0.5" /> Личный
          </button>
          <button
            onClick={() => setTab('group')}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors cursor-pointer',
              tab === 'group' ? 'text-(--color-accent) border-b-2 border-(--color-accent)' : 'text-(--color-text-secondary)'
            )}
          >
            <Users size={16} className="inline mr-1.5 -mt-0.5" /> Группа
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'private' ? (
            <>
              {/* Saved messages */}
              <button
                onClick={handleSaved}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-(--color-bg-hover) transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-(--color-accent) flex items-center justify-center text-white shrink-0">
                  <Bookmark size={18} />
                </div>
                <span className="text-sm font-medium">Избранное</span>
              </button>

              {/* Search */}
              <div className="px-5 py-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-tertiary)" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск пользователей"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-(--color-bg-tertiary) rounded-lg outline-none focus:ring-1 focus:ring-(--color-accent)"
                  />
                </div>
              </div>

              {/* User list */}
              {filtered.map((u) => (
                <button
                  key={u.username}
                  onClick={() => handlePrivate(u.username)}
                  disabled={creating}
                  className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-(--color-bg-hover) transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Avatar src={u.avatarUrl} name={u.username} size="md" online={u.online} />
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium truncate">{u.username}</p>
                    {u.tag && <p className="text-xs text-(--color-text-tertiary)">@{u.tag}</p>}
                  </div>
                </button>
              ))}
            </>
          ) : (
            <div className="p-5">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Название группы"
                className="w-full px-4 py-2.5 text-sm bg-(--color-bg-tertiary) rounded-lg outline-none focus:ring-1 focus:ring-(--color-accent) mb-4"
              />
              <button
                onClick={handleGroup}
                disabled={!groupName.trim() || creating}
                className="w-full py-2.5 bg-(--color-accent) text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {creating ? 'Создание...' : 'Создать группу'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
