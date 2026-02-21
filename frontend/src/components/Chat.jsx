import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import ChatRoom from './ChatRoom';
import TaskPanel from './TaskPanel';
import TaskNotificationPopup from './TaskNotificationPopup';
import ReplyNotificationPopup from './ReplyNotificationPopup';
import SecurityCodeModal from './SecurityCodeModal';
import e2eManager from '../crypto/E2EManager';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

export default function Chat({ token, username, onLogout, joinRoomId, onShowNews }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState('general');
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [showTasks, setShowTasks] = useState(false);
  const [taskNotification, setTaskNotification] = useState(null);
  const [replyNotification, setReplyNotification] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [e2eReady, setE2eReady] = useState(false);
  const [securityCode, setSecurityCode] = useState(null);
  const [securityCodePeer, setSecurityCodePeer] = useState(null);
  const [e2eUnavailable, setE2eUnavailable] = useState(false);
  const wsRef = useRef(null);
  const loadedRooms = useRef(new Set());
  const activeRoomIdRef = useRef('general');
  const typingTimeouts = useRef({});
  const typingThrottle = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const unmounted = useRef(false);
  const documentVisible = useRef(true);
  const notifSound = useRef(null);

  // Create notification sound
  useEffect(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      notifSound.current = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1050, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      };
    } catch (e) {
      notifSound.current = null;
    }
  }, []);

  // Track tab visibility
  useEffect(() => {
    const handleVisibility = () => {
      documentVisible.current = !document.hidden;
      // Clear title badge when user returns to tab
      if (!document.hidden) {
        document.title = '🐱 BarsikChat';
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showBrowserNotification = (title, body, roomId) => {
    // Update page title when tab is not visible
    if (document.hidden) {
      const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0) + 1;
      document.title = `(${totalUnread}) 🐱 BarsikChat`;
    }

    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (documentVisible.current && roomId === activeRoomIdRef.current) return;
    try {
      const n = new Notification(title, {
        body: body.length > 100 ? body.slice(0, 100) + '…' : body,
        icon: '/barsik-icon.png',
        tag: 'barsik-msg-' + roomId,
        renotify: true,
        silent: false,
      });
      n.onclick = () => {
        window.focus();
        setActiveRoomId(roomId);
        n.close();
      };
      setTimeout(() => n.close(), 5000);
    } catch (e) {
      // Notification constructor may fail in some contexts
    }
  };

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    fetchRooms();
    loadRoomHistory('general');
    unmounted.current = false;

    // Initialize E2E encryption
    e2eManager.initialize(token).then(() => {
      setE2eReady(e2eManager.isReady());
    }).catch(err => console.warn('[E2E] Init error:', err));

    function connectWs() {
      if (unmounted.current) return;

      // Close previous socket if still open (prevent duplicate connections)
      if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
        wsRef.current.onclose = null; // prevent triggering reconnect
        wsRef.current.close();
      }

      const ws = new WebSocket(`${WS_URL}/ws/chat?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
        fetchUsers();
        if (joinRoomId) {
          fetch(`/api/rooms/join/${joinRoomId}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => { if (res.ok) return res.json(); throw new Error('join failed'); })
            .then((room) => {
              fetchRooms();
              setActiveRoomId(room.id);
              loadRoomHistory(room.id);
            })
            .catch(console.error);
        }
      };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      // Handle status updates (delivery/read receipts)
      if (msg.type === 'STATUS_UPDATE') {
        setMessagesByRoom((prev) => {
          const roomMsgs = prev[msg.roomId];
          if (!roomMsgs) return prev;
          return {
            ...prev,
            [msg.roomId]: roomMsgs.map((m) =>
              m.id === msg.id ? { ...m, status: msg.status } : m
            ),
          };
        });
        return;
      }

      // Handle EDIT
      if (msg.type === 'EDIT') {
        setMessagesByRoom((prev) => {
          const roomMsgs = prev[msg.roomId];
          if (!roomMsgs) return prev;
          return {
            ...prev,
            [msg.roomId]: roomMsgs.map((m) =>
              m.id === msg.id ? { ...m, content: msg.content, edited: true } : m
            ),
          };
        });
        return;
      }

      // Handle DELETE
      if (msg.type === 'DELETE') {
        setMessagesByRoom((prev) => {
          const roomMsgs = prev[msg.roomId];
          if (!roomMsgs) return prev;
          return {
            ...prev,
            [msg.roomId]: roomMsgs.filter((m) => m.id !== msg.id),
          };
        });
        return;
      }

      // Handle SCHEDULED confirmation
      if (msg.type === 'SCHEDULED') {
        setScheduledMessages((prev) => [...prev, msg]);
        return;
      }

      // Handle task notifications — show rich popup only to relevant user
      if (msg.type === 'TASK_CREATED' || msg.type === 'TASK_COMPLETED' || msg.type === 'TASK_OVERDUE') {
        const assignee = msg.extra?.assignedTo;
        const creator = msg.sender;
        // TASK_CREATED: only show to assignee (not creator)
        // TASK_COMPLETED: only show to creator (not assignee)
        // TASK_OVERDUE: show to both
        const showPopup =
          (msg.type === 'TASK_CREATED' && assignee === username && creator !== username) ||
          (msg.type === 'TASK_COMPLETED' && creator === username && assignee !== username) ||
          (msg.type === 'TASK_OVERDUE');

        if (!showPopup) return;

        const label = msg.type === 'TASK_CREATED' ? '📋 Новая задача' :
                      msg.type === 'TASK_COMPLETED' ? '✅ Задача выполнена' : '⚠️ Просрочена';
        setTaskNotification({
          label,
          title: msg.content,
          id: msg.id,
          sender: msg.sender,
          description: msg.extra?.description || '',
          assignedTo: msg.extra?.assignedTo || '',
          deadline: msg.extra?.deadline || '',
          taskStatus: msg.extra?.taskStatus || '',
          msgType: msg.type,
        });
        return;
      }

      // Handle TYPING indicator
      if (msg.type === 'TYPING') {
        const rid = msg.roomId;
        const sender = msg.sender;
        if (rid && sender) {
          setTypingUsers((prev) => {
            const roomTyping = { ...(prev[rid] || {}) };
            roomTyping[sender] = Date.now();
            return { ...prev, [rid]: roomTyping };
          });
          const key = `${rid}:${sender}`;
          clearTimeout(typingTimeouts.current[key]);
          typingTimeouts.current[key] = setTimeout(() => {
            setTypingUsers((prev) => {
              const roomTyping = { ...(prev[rid] || {}) };
              delete roomTyping[sender];
              return { ...prev, [rid]: roomTyping };
            });
          }, 3000);
        }
        return;
      }

      // Handle REPLY / MENTION notifications — show popup
      if (msg.type === 'REPLY_NOTIFICATION' || msg.type === 'MENTION_NOTIFICATION') {
        setReplyNotification(msg);
        return;
      }

      const roomId = msg.roomId || 'general';

      // Decrypt E2E message if encrypted
      if (msg.encrypted && msg.sender !== username) {
        try {
          const result = await e2eManager.decrypt(msg.sender, msg);
          if (result.error) {
            msg.content = '🔒 Не удалось расшифровать';
            msg._decryptError = true;
          } else {
            msg.content = result.text;
            if (result.fileKey) msg._fileKey = result.fileKey;
          }
        } catch (err) {
          console.error('[E2E] Decrypt error:', err);
          msg.content = '🔒 Не удалось расшифровать';
          msg._decryptError = true;
        }
      }

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), msg],
      }));

      // Browser push notification for new messages
      if ((msg.type === 'CHAT' || msg.type === 'PRIVATE') && msg.sender !== username) {
        const roomObj = rooms.find(r => r.id === roomId);
        const roomName = roomObj ? (roomObj.type === 'PRIVATE'
          ? roomObj.name.split(' & ').find(n => n !== username) || roomObj.name
          : roomObj.name) : 'Чат';
        const body = msg.content || (msg.fileUrl ? '📎 Файл' : 'Новое сообщение');
        showBrowserNotification(`${msg.sender} — ${roomName}`, body, roomId);
        // Play sound if not active tab or not current room
        if (document.hidden || roomId !== activeRoomIdRef.current) {
          try { notifSound.current?.(); } catch (e) {}
        }
      }

      // Track unread messages
      if (msg.type === 'CHAT' && msg.sender !== username) {
        if (roomId !== activeRoomIdRef.current) {
          setUnreadCounts((prev) => ({
            ...prev,
            [roomId]: (prev[roomId] || 0) + 1,
          }));
        } else {
          // Auto-send read receipt for active room
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'READ_RECEIPT', roomId }));
          }
        }
      }

      if (msg.type === 'JOIN' || msg.type === 'LEAVE') {
        fetchUsers();
      }
    };

    ws.onclose = (e) => {
      // Only reconnect if this is still the active socket
      if (wsRef.current !== ws) return;
      setConnected(false);
      // Code 4001 = replaced by new session on same device, don't reconnect
      if (e.code === 4001) return;
      // Auto-reconnect with exponential backoff (R1)
      if (!unmounted.current && reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connectWs, delay);
      }
    };
    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setConnected(false);
    };
    }

    connectWs();

    return () => {
      unmounted.current = true;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [token]);

  const fetchRooms = () => {
    fetch('/api/rooms', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then((data) => setRooms(data))
      .catch(console.error);
  };

  const loadRoomHistory = (roomId) => {
    if (loadedRooms.current.has(roomId)) return;
    loadedRooms.current.add(roomId);
    fetch(`/api/rooms/${roomId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then((data) => {
        if (data.length > 0) {
          setMessagesByRoom((prev) => ({ ...prev, [roomId]: data }));
        }
      })
      .catch(console.error);
  };

  const fetchUsers = () => {
    fetch('/api/chat/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then((data) => setOnlineUsers(data))
      .catch(console.error);
  };

  const selectRoom = (roomId) => {
    setActiveRoomId(roomId);
    setShowTasks(false);
    loadRoomHistory(roomId);
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'READ_RECEIPT', roomId }));
    }
  };

  const sendMessage = async (content, fileData, replyData, mentions) => {
    if (!wsRef.current) return;
    if (!content && !fileData) return;
    const msg = { content: content || '', roomId: activeRoomId };
    if (fileData) {
      msg.fileUrl = fileData.fileUrl;
      msg.fileName = fileData.fileName;
      msg.fileSize = fileData.fileSize;
      msg.fileType = fileData.fileType;
    }
    if (replyData) {
      msg.replyToId = replyData.replyToId;
      msg.replyToSender = replyData.replyToSender;
      msg.replyToContent = replyData.replyToContent;
    }
    if (mentions) {
      msg.mentions = mentions;
    }

    // E2E encrypt for private rooms
    const room = rooms.find(r => r.id === activeRoomId);
    if (room?.type === 'PRIVATE' && e2eReady) {
      const peerUser = getPeerUsername(room);
      if (peerUser) {
        try {
          const peerHasE2E = await e2eManager.peerHasE2E(token, peerUser);
          if (peerHasE2E) {
            const encrypted = await e2eManager.encrypt(peerUser, content || '', token);
            Object.assign(msg, encrypted);
          }
        } catch (err) {
          console.warn('[E2E] Encrypt failed, sending plaintext:', err);
        }
      }
    }

    wsRef.current.send(JSON.stringify(msg));
  };

  const editMessage = (msgId, newContent) => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'EDIT',
      id: msgId,
      roomId: activeRoomId,
      content: newContent,
    }));
  };

  const deleteMessage = (msgId) => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'DELETE',
      id: msgId,
      roomId: activeRoomId,
    }));
  };

  const scheduleMessage = (content, scheduledAt, fileData) => {
    if (!wsRef.current) return;
    const msg = {
      type: 'SCHEDULED',
      content: content || '',
      roomId: activeRoomId,
      scheduledAt,
    };
    if (fileData) {
      msg.fileUrl = fileData.fileUrl;
      msg.fileName = fileData.fileName;
      msg.fileSize = fileData.fileSize;
      msg.fileType = fileData.fileType;
    }
    wsRef.current.send(JSON.stringify(msg));
  };

  const startPrivateChat = async (targetUser) => {
    try {
      const res = await fetch(`/api/rooms/private/${targetUser}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const room = await res.json();
      fetchRooms();
      selectRoom(room.id);
    } catch (err) {
      console.error(err);
    }
  };

  const createRoom = async (name) => {
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const room = await res.json();
      fetchRooms();
      selectRoom(room.id);
      return room;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const joinRoom = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/join/${roomId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const room = await res.json();
      fetchRooms();
      selectRoom(room.id);
      return room;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const deleteRoom = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMessagesByRoom((prev) => {
          const copy = { ...prev };
          delete copy[roomId];
          return copy;
        });
        loadedRooms.current.delete(roomId);
        if (activeRoomId === roomId) setActiveRoomId('general');
        fetchRooms();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sendTyping = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (typingThrottle.current) return;
    wsRef.current.send(JSON.stringify({ type: 'TYPING', roomId: activeRoomId }));
    typingThrottle.current = setTimeout(() => { typingThrottle.current = null; }, 2000);
  };

  const activeTypingUsers = typingUsers[activeRoomId]
    ? Object.keys(typingUsers[activeRoomId]).filter((u) => u !== username)
    : [];

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const activeMessages = messagesByRoom[activeRoomId] || [];
  const roomName = activeRoom ? activeRoom.name : 'Общий чат';

  const getPeerUsername = (room) => {
    if (!room || room.type !== 'PRIVATE') return null;
    const parts = room.name.split(' & ');
    return parts.find((p) => p !== username) || null;
  };

  const isPrivateE2E = activeRoom?.type === 'PRIVATE' && e2eReady;

  const showSecurityCode = async () => {
    const peer = getPeerUsername(activeRoom);
    if (!peer) return;
    try {
      const code = await e2eManager.getSecurityCode(peer);
      if (code) {
        setSecurityCode(code);
        setSecurityCodePeer(peer);
        setE2eUnavailable(false);
      } else {
        setSecurityCode(null);
        setSecurityCodePeer(peer);
        setE2eUnavailable(true);
      }
    } catch {
      setSecurityCode(null);
      setSecurityCodePeer(peer);
      setE2eUnavailable(true);
    }
  };

  return (
    <div className="chat-container">
      {/* Mobile hamburger */}
      <button className="mobile-hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
      <Sidebar
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={(id) => { selectRoom(id); setSidebarOpen(false); }}
        onlineUsers={onlineUsers}
        username={username}
        connected={connected}
        onLogout={onLogout}
        onStartPrivateChat={startPrivateChat}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onDeleteRoom={deleteRoom}
        onShowNews={onShowNews}
        onShowTasks={() => setShowTasks(true)}
        token={token}
        unreadCounts={unreadCounts}
        messagesByRoom={messagesByRoom}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
      />
      {showTasks ? (
        <TaskPanel token={token} username={username} onClose={() => setShowTasks(false)} />
      ) : (
        <ChatRoom
          messages={activeMessages}
          onSendMessage={sendMessage}
          onEditMessage={editMessage}
          onDeleteMessage={deleteMessage}
          onScheduleMessage={scheduleMessage}
          scheduledMessages={scheduledMessages.filter(m => m.roomId === activeRoomId)}
          roomName={roomName}
          username={username}
          connected={connected}
          token={token}
          activeRoom={activeRoom}
          onlineUsers={onlineUsers}
          typingUsers={activeTypingUsers}
          onTyping={sendTyping}
          isE2E={isPrivateE2E}
          onShowSecurityCode={showSecurityCode}
        />
      )}
      {taskNotification && (
        <TaskNotificationPopup
          notification={taskNotification}
          onClose={() => setTaskNotification(null)}
          onOpenTasks={() => { setTaskNotification(null); setShowTasks(true); }}
        />
      )}
      {(securityCode || e2eUnavailable) && (
        <SecurityCodeModal
          securityCode={securityCode}
          peerUsername={securityCodePeer}
          unavailable={e2eUnavailable}
          onClose={() => { setSecurityCode(null); setSecurityCodePeer(null); setE2eUnavailable(false); }}
        />
      )}
      {replyNotification && (
        <ReplyNotificationPopup
          notification={replyNotification}
          onClose={() => setReplyNotification(null)}
          onGoToMessage={(notif) => {
            if (notif.roomId && notif.roomId !== activeRoomId) {
              selectRoom(notif.roomId);
            }
          }}
        />
      )}
    </div>
  );
}
