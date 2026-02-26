// ═══════════════════════════════════════════════
//  Forward Picker — select rooms to forward message
// ═══════════════════════════════════════════════
import { useState, useMemo } from 'react';
import { useStore, type Message, type Room } from '@/store';
import { createPrivateRoom } from '@/lib/api';
import { wsManager } from '@/lib/ws';
import Avatar from '@/components/ui/Avatar';
import { X, Search, Check, Send } from 'lucide-react';

interface ForwardPickerProps {
  messages: Message[];
  onClose: () => void;
}

export default function ForwardPicker({ messages, onClose }: ForwardPickerProps) {
  const { token, username, rooms, users, avatarMap, addRoom } = useStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);

  const targets = useMemo(() => {
    const q = search.toLowerCase();
    return rooms
      .filter((r) => r.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const ta = a.lastMessageTime || '';
        const tb = b.lastMessageTime || '';
        return tb.localeCompare(ta);
      });
  }, [rooms, search]);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleForward = async () => {
    if (!token || !username || selected.size === 0) return;
    setSending(true);
    try {
      for (const roomId of selected) {
        for (const msg of messages) {
          wsManager.send({
            type: 'CHAT',
            roomId,
            sender: username,
            content: msg.content ? `⤵️ ${msg.sender}: ${msg.content}` : '',
            forwardedFrom: msg.sender,
            ...(msg.fileUrl ? { fileUrl: msg.fileUrl, fileName: msg.fileName } : {}),
          });
        }
      }
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-(--color-bg-surface) rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-scaleIn max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-separator)">
          <div>
            <h2 className="text-base font-semibold">Переслать</h2>
            {selected.size > 0 && (
              <p className="text-xs text-(--color-text-secondary)">{selected.size} выбрано</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2">
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

        {/* Room list */}
        <div className="flex-1 overflow-y-auto">
          {targets.map((room) => (
            <button
              key={room.id}
              onClick={() => toggle(room.id)}
              className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-(--color-bg-hover) transition-colors cursor-pointer"
            >
              <Avatar src={avatarMap[room.otherUser || ''] || room.avatarUrl} name={room.name} size="md" />
              <span className="text-sm flex-1 text-left truncate">{room.name}</span>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                selected.has(room.id) ? 'bg-(--color-accent) border-(--color-accent)' : 'border-(--color-text-tertiary)'
              }`}>
                {selected.has(room.id) && <Check size={12} className="text-white" />}
              </div>
            </button>
          ))}
        </div>

        {/* Send button */}
        {selected.size > 0 && (
          <div className="p-4 border-t border-(--color-separator)">
            <button
              onClick={handleForward}
              disabled={sending}
              className="w-full py-2.5 bg-(--color-accent) text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send size={16} /> Переслать ({selected.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
