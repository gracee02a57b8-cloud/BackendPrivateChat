// ═══════════════════════════════════════════════
//  App — Root component
// ═══════════════════════════════════════════════
import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store';
import { wsManager } from '@/lib/ws';
import { fetchRooms, fetchUsers, fetchContacts } from '@/lib/api';
import LoginPage from '@/components/LoginPage';
import Sidebar from '@/components/Sidebar';
import ChatView from '@/components/chat/ChatView';
import { cn } from '@/lib/utils';

export default function App() {
  const {
    token, username, role,
    activeRoomId, isMobile, sidebarOpen, theme,
    setRooms, updateRoom, setUsers, setContacts,
    addMessage, updateMessage, deleteMessage,
    setActiveRoom, setSidebarOpen, setIsMobile, setTheme,
    setWsConnected, setOnlineUsers, setAvatarMap, updateAvatarMap,
    setTyping, incrementUnread, addScheduledMessage,
  } = useStore();

  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeRoomRef = useRef(activeRoomId);
  activeRoomRef.current = activeRoomId;

  // ── Theme management ──
  useEffect(() => {
    const apply = (t: typeof theme) => {
      const html = document.documentElement;
      if (t === 'dark') {
        html.classList.add('dark');
      } else if (t === 'light') {
        html.classList.remove('dark');
      } else {
        // auto
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.classList.toggle('dark', prefersDark);
      }
    };
    apply(theme);

    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle('dark', e.matches);
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  // ── Responsive ──
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setIsMobile, setSidebarOpen]);

  // ── WebSocket message handler ──
  const handleWsMessage = useCallback((data: any) => {
    const type = data.type;

    switch (type) {
      case 'STATUS_UPDATE': {
        if (data.roomId && data.id) {
          updateMessage(data.roomId, data.id, { status: data.status });
        }
        break;
      }

      case 'EDIT': {
        if (data.roomId && data.id) {
          updateMessage(data.roomId, data.id, {
            content: data.content,
            editedAt: data.editedAt || new Date().toISOString(),
          });
        }
        break;
      }

      case 'DELETE': {
        if (data.roomId && data.id) {
          deleteMessage(data.roomId, data.id);
        }
        break;
      }

      case 'SCHEDULED': {
        addScheduledMessage(data);
        break;
      }

      case 'TYPING': {
        const key = `${data.roomId}:${data.sender}`;
        if (data.sender === username) break;
        // Update typing state
        const store = useStore.getState();
        const current = store.typingMap[data.roomId] || [];
        if (!current.includes(data.sender)) {
          setTyping(data.roomId, [...current, data.sender]);
        }
        // Clear after 3s
        if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
        typingTimers.current[key] = setTimeout(() => {
          const s = useStore.getState();
          const cur = s.typingMap[data.roomId] || [];
          setTyping(data.roomId, cur.filter((u: string) => u !== data.sender));
        }, 3000);
        break;
      }

      case 'AVATAR_UPDATE': {
        if (data.username && data.avatarUrl) {
          updateAvatarMap(data.username, data.avatarUrl);
        }
        break;
      }

      case 'GROUP_INVITE': {
        // TODO: show invite popup
        break;
      }

      case 'REPLY_NOTIFICATION':
      case 'MENTION_NOTIFICATION': {
        // TODO: show notification
        break;
      }

      case 'TASK_CREATED':
      case 'TASK_COMPLETED':
      case 'TASK_OVERDUE': {
        // TODO: task notification
        break;
      }

      case 'STORY_POSTED': {
        // TODO: refresh stories
        break;
      }

      // Call/conference types - TODO
      case 'CALL_OFFER':
      case 'CALL_ANSWER':
      case 'CALL_REJECT':
      case 'CALL_END':
      case 'CALL_BUSY':
      case 'ICE_CANDIDATE':
      case 'CONF_PEERS':
      case 'CONF_JOIN':
      case 'CONF_OFFER':
      case 'CONF_ANSWER':
      case 'CONF_ICE':
      case 'CONF_LEAVE':
        break;

      default: {
        // Regular message (CHAT, PRIVATE, VOICE, VIDEO_CIRCLE, etc.)
        if (data.roomId && data.sender) {
          addMessage(data.roomId, data);

          // Update room's last message
          updateRoom(data.roomId, {
            lastMessage: data.content || (data.fileUrl ? '📎 Файл' : ''),
            lastMessageTime: data.timestamp || new Date().toISOString(),
            lastSender: data.sender,
          });

          // Unread count if not active room and not own
          if (data.roomId !== activeRoomRef.current && data.sender !== username) {
            incrementUnread(data.roomId);
          }

          // Send read receipt if in room
          if (data.roomId === activeRoomRef.current && data.sender !== username && data.id) {
            wsManager.send({
              type: 'READ_RECEIPT',
              roomId: data.roomId,
              messageId: data.id,
              sender: username,
            });
          }
        }
        break;
      }
    }
  }, [username, updateMessage, deleteMessage, addMessage, updateRoom, incrementUnread, setTyping, updateAvatarMap, addScheduledMessage]);

  // ── Connect WS + load data ──
  useEffect(() => {
    if (!token || !username) return;

    // Load initial data
    fetchRooms(token)
      .then((data) => {
        setRooms(data);
        // Build avatar map
        const map: Record<string, string> = {};
        data.forEach((r: any) => {
          if (r.avatarUrl) map[r.name] = r.avatarUrl;
        });
        setAvatarMap(map);
      })
      .catch(console.error);

    fetchUsers(token)
      .then((data) => {
        setUsers(data);
        // Update avatar map with user avatars
        const map: Record<string, string> = {};
        data.forEach((u: any) => {
          if (u.avatarUrl) map[u.username] = u.avatarUrl;
        });
        setAvatarMap({ ...useStore.getState().avatarMap, ...map });
        // Online users
        setOnlineUsers(data.filter((u: any) => u.online).map((u: any) => u.username));
      })
      .catch(console.error);

    fetchContacts(token).then(setContacts).catch(console.error);

    // Connect WebSocket
    wsManager.connect(token, username);
    setWsConnected(true);
    const unsub = wsManager.subscribe(handleWsMessage);

    return () => {
      unsub();
      wsManager.disconnect();
      setWsConnected(false);
    };
  }, [token, username]);

  // ── Select room handler ──
  useEffect(() => {
    if (activeRoomId && isMobile) {
      setSidebarOpen(false);
    }
  }, [activeRoomId, isMobile, setSidebarOpen]);

  // ── Not logged in ──
  if (!token) {
    return <LoginPage />;
  }

  // ── Layout ──
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-(--color-bg-primary) text-(--color-text-primary)">
      {/* Sidebar */}
      <div className={cn(
        'h-full shrink-0 transition-all duration-200',
        isMobile
          ? (sidebarOpen ? 'w-full' : 'w-0 overflow-hidden')
          : 'w-[420px] border-r border-(--color-separator)'
      )}>
        <Sidebar />
      </div>

      {/* Chat area */}
      <div className={cn(
        'flex-1 h-full min-w-0',
        isMobile && sidebarOpen ? 'hidden' : 'flex'
      )}>
        <ChatView />
      </div>
    </div>
  );
}
