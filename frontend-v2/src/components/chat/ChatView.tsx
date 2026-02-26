// ═══════════════════════════════════════════════
//  Chat View — Header + Messages + Input
// ═══════════════════════════════════════════════
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn, formatTime, formatDate } from '@/lib/utils';
import { useStore, type Message } from '@/store';
import { fetchMessages } from '@/lib/api';
import { wsManager } from '@/lib/ws';
import Avatar from '@/components/ui/Avatar';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageInput from '@/components/chat/MessageInput';
import {
  ArrowLeft, Phone, MoreVertical, Search, ChevronDown,
  Pin, X, ChevronUp, Bookmark, Users,
} from 'lucide-react';

export default function ChatView() {
  const {
    activeRoomId, rooms, messages, username, token,
    isMobile, setActiveRoom, avatarMap, typingMap, onlineUsers,
    setMessages, addMessage, updateMessage, deleteMessage,
    setSidebarOpen,
  } = useStore();

  const room = rooms.find((r) => r.id === activeRoomId);
  const msgs = (activeRoomId ? messages[activeRoomId] : null) || [];

  // ── State ──
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editMsg, setEditMsg] = useState<Message | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIdx, setSearchIdx] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Message | null>(null);

  // ── Refs ──
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(new Set<number>());

  // ── Fetch messages on room change ──
  useEffect(() => {
    if (!activeRoomId || !token) return;
    if (fetchedRef.current.has(activeRoomId)) return;
    fetchedRef.current.add(activeRoomId);
    fetchMessages(token, activeRoomId)
      .then((data) => setMessages(activeRoomId, data))
      .catch(console.error);
  }, [activeRoomId, token, setMessages]);

  // ── Auto-scroll to bottom on new messages ──
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [msgs.length]);

  // ── Scroll listener ──
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(fromBottom > 400);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [activeRoomId]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Read receipt on view ──
  useEffect(() => {
    if (!activeRoomId || !username) return;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg && lastMsg.sender !== username && lastMsg.id) {
      wsManager.send({ type: 'READ_RECEIPT', roomId: activeRoomId, messageId: lastMsg.id, sender: username });
    }
  }, [activeRoomId, msgs.length, username]);

  // ── Search ──
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return msgs.filter((m) => m.content?.toLowerCase().includes(q));
  }, [msgs, searchQuery]);

  const navigateSearch = (dir: 1 | -1) => {
    const next = searchIdx + dir;
    if (next >= 0 && next < searchResults.length) {
      setSearchIdx(next);
      const msgEl = document.getElementById(`msg-${searchResults[next].id}`);
      msgEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // ── Delete message handler ──
  const handleDelete = (msg: Message) => {
    setDeleteConfirm(msg);
  };

  const confirmDelete = () => {
    if (deleteConfirm?.id) {
      wsManager.send({ type: 'DELETE', id: deleteConfirm.id, roomId: activeRoomId, sender: username });
    }
    setDeleteConfirm(null);
  };

  // ── Back button ──
  const handleBack = () => {
    setActiveRoom(null);
    if (isMobile) setSidebarOpen(true);
  };

  // ── Typing indicator text ──
  const typingUsers = activeRoomId ? typingMap[activeRoomId] || [] : [];
  const typingText = useMemo(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0]} печатает`;
    if (typingUsers.length === 2) return `${typingUsers[0]} и ${typingUsers[1]} печатают`;
    return 'Несколько человек печатают';
  }, [typingUsers]);

  // ── Subtitle ──
  const subtitle = useMemo(() => {
    if (typingText) return typingText;
    if (!room) return '';
    if (room.type === 'SAVED') return 'Сохранённые сообщения';
    if (room.type === 'PRIVATE') {
      const other = room.otherUser;
      if (other && onlineUsers.includes(other)) return 'в сети';
      return 'не в сети';
    }
    const memberCount = room.members?.length || 0;
    const onlineCount = room.members?.filter((m) => onlineUsers.includes(m)).length || 0;
    return `${memberCount} участников, ${onlineCount} в сети`;
  }, [room, typingText, onlineUsers]);

  // ── Date dividers + grouping ──
  const groupedMsgs = useMemo(() => {
    const result: { type: 'date' | 'msg'; date?: string; msg?: Message; showSender?: boolean; showAvatar?: boolean }[] = [];
    let lastDate = '';
    let lastSender = '';

    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const date = formatDate(m.timestamp || '');
      if (date !== lastDate) {
        result.push({ type: 'date', date });
        lastDate = date;
        lastSender = '';
      }
      const isNewSender = m.sender !== lastSender;
      const nextIsSameSender = i + 1 < msgs.length && msgs[i + 1].sender === m.sender &&
        formatDate(msgs[i + 1].timestamp || '') === date;
      result.push({
        type: 'msg',
        msg: m,
        showSender: isNewSender,
        showAvatar: !nextIsSameSender,
      });
      lastSender = m.sender;
    }
    return result;
  }, [msgs]);

  // ── No room selected ──
  if (!room || !activeRoomId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-(--color-bg-primary) text-(--color-text-tertiary)">
        <div className="text-6xl mb-4">🐱</div>
        <p className="text-lg font-medium">BarsikChat</p>
        <p className="text-sm mt-1">Выберите чат для начала общения</p>
      </div>
    );
  }

  const isGroup = room.type === 'GROUP';
  const isSaved = room.type === 'SAVED';

  return (
    <div className="flex-1 flex flex-col bg-(--color-bg-primary) h-full min-w-0">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 h-14 bg-(--color-bg-surface) border-b border-(--color-separator) shrink-0">
        {/* Back */}
        {isMobile && (
          <button onClick={handleBack} className="p-1.5 -ml-1 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
            <ArrowLeft size={22} />
          </button>
        )}

        {/* Avatar */}
        {isSaved ? (
          <div className="w-10 h-10 rounded-full bg-(--color-accent) flex items-center justify-center text-white shrink-0">
            <Bookmark size={20} />
          </div>
        ) : (
          <Avatar
            src={isGroup ? room.avatarUrl : avatarMap[room.otherUser || '']}
            name={room.name}
            size="md"
            online={!isGroup && !!room.otherUser && onlineUsers.includes(room.otherUser)}
          />
        )}

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">{room.name}</h2>
          <p className={cn(
            'text-xs truncate',
            typingText ? 'text-(--color-accent)' : 'text-(--color-text-secondary)'
          )}>
            {typingText && <span className="inline-flex gap-0.5 mr-1">
              <span className="w-1 h-1 bg-(--color-accent) rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-(--color-accent) rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-(--color-accent) rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>}
            {subtitle}
          </p>
        </div>

        {/* Actions */}
        {!isSaved && room.type === 'PRIVATE' && (
          <button className="p-2 rounded-full hover:bg-(--color-bg-hover) cursor-pointer text-(--color-text-secondary)">
            <Phone size={20} />
          </button>
        )}
        <button className="p-2 rounded-full hover:bg-(--color-bg-hover) cursor-pointer text-(--color-text-secondary)"
          onClick={() => setSearchOpen(!searchOpen)}>
          <Search size={20} />
        </button>
        <div className="relative">
          <button
            onClick={() => setHeaderMenu(!headerMenu)}
            className="p-2 rounded-full hover:bg-(--color-bg-hover) cursor-pointer text-(--color-text-secondary)"
          >
            <MoreVertical size={20} />
          </button>
          {headerMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setHeaderMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-(--color-bg-surface) border border-(--color-border) rounded-xl shadow-xl z-50 py-1 min-w-[180px] animate-scaleIn">
                {isGroup && (
                  <HeaderBtn icon={<Users size={16} />} label="Участники" onClick={() => setHeaderMenu(false)} />
                )}
                <HeaderBtn icon={<Search size={16} />} label="Поиск" onClick={() => { setSearchOpen(true); setHeaderMenu(false); }} />
                <HeaderBtn icon={<Pin size={16} />} label="Закреплённые" onClick={() => setHeaderMenu(false)} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Search bar ── */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2 bg-(--color-bg-surface) border-b border-(--color-separator)">
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigateSearch(e.shiftKey ? -1 : 1);
              if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
            }}
            placeholder="Поиск сообщений..."
            className="flex-1 text-sm bg-transparent outline-none"
          />
          {searchResults.length > 0 && (
            <span className="text-xs text-(--color-text-tertiary) shrink-0">
              {searchIdx + 1}/{searchResults.length}
            </span>
          )}
          <button onClick={() => navigateSearch(-1)} className="p-1 rounded hover:bg-(--color-bg-hover) cursor-pointer">
            <ChevronUp size={16} />
          </button>
          <button onClick={() => navigateSearch(1)} className="p-1 rounded hover:bg-(--color-bg-hover) cursor-pointer">
            <ChevronDown size={16} />
          </button>
          <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="p-1 rounded hover:bg-(--color-bg-hover) cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={listRef} className="flex-1 overflow-y-auto py-2 space-y-0.5 scroll-smooth">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-(--color-text-tertiary)">
            <div className="text-5xl mb-3">💬</div>
            <p className="text-sm">Нет сообщений</p>
          </div>
        )}

        {groupedMsgs.map((item, i) => {
          if (item.type === 'date') {
            return (
              <div key={`date-${i}`} className="flex justify-center my-3">
                <span className="text-xs text-(--color-text-tertiary) bg-(--color-bg-tertiary) px-3 py-1 rounded-full font-medium">
                  {item.date}
                </span>
              </div>
            );
          }
          const m = item.msg!;
          return (
            <div key={m.id || m.tempId || i} id={`msg-${m.id}`} className="py-0.5">
              <MessageBubble
                msg={m}
                own={m.sender === username}
                showSender={!!item.showSender}
                showAvatar={!!item.showAvatar}
                avatarMap={avatarMap}
                isGroup={isGroup}
                onReply={(msg) => setReplyTo(msg)}
                onEdit={(msg) => setEditMsg(msg)}
                onDelete={handleDelete}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Scroll-to-bottom ── */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-6 w-10 h-10 rounded-full bg-(--color-bg-surface) border border-(--color-border) shadow-lg flex items-center justify-center hover:bg-(--color-bg-hover) transition-colors cursor-pointer z-10"
        >
          <ChevronDown size={22} className="text-(--color-text-secondary)" />
        </button>
      )}

      {/* ── Input ── */}
      <MessageInput
        roomId={activeRoomId}
        replyTo={replyTo}
        editMsg={editMsg}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditMsg(null)}
      />

      {/* ── Delete confirmation modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-(--color-bg-surface) rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-2">Удалить сообщение?</h3>
            <p className="text-sm text-(--color-text-secondary) mb-4 line-clamp-2">{deleteConfirm.content}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm rounded-lg hover:bg-(--color-bg-hover) cursor-pointer">
                Отмена
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm rounded-lg bg-(--color-danger) text-white hover:opacity-90 cursor-pointer">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
          <button className="absolute top-4 right-4 text-white/80 hover:text-white cursor-pointer">
            <X size={28} />
          </button>
        </div>
      )}
    </div>
  );
}

function HeaderBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-(--color-bg-hover) transition-colors cursor-pointer">
      {icon} {label}
    </button>
  );
}
