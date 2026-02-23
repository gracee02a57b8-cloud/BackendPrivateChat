import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Users, User, FlaskConical } from 'lucide-react';
import Sidebar from './Sidebar';
import ChatRoom from './ChatRoom';
import TaskPanel from './TaskPanel';
import TaskNotificationPopup from './TaskNotificationPopup';
import ReplyNotificationPopup from './ReplyNotificationPopup';
import MessageNotificationPopup from './MessageNotificationPopup';
import SecurityCodeModal from './SecurityCodeModal';
import IncomingCallModal from './IncomingCallModal';
import CallScreen from './CallScreen';
import ConferenceScreen from './ConferenceScreen';
import AddMembersPanel from './AddMembersPanel';
import ToastContainer, { showToast } from './Toast';
import useWebRTC from '../hooks/useWebRTC';
import useConference from '../hooks/useConference';
import useMediaPermissions from '../hooks/useMediaPermissions';
import e2eManager from '../crypto/E2EManager';
import cryptoStore from '../crypto/CryptoStore';
import groupCrypto from '../crypto/GroupCrypto';
import appSettings from '../utils/appSettings';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

export default function Chat({ token, username, avatarUrl, onAvatarChange, onLogout, joinRoomId, joinConfId, onShowNews }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [showTasks, setShowTasks] = useState(false);
  const [taskNotification, setTaskNotification] = useState(null);
  const [groupInvite, setGroupInvite] = useState(null);
  const [replyNotification, setReplyNotification] = useState(null);
  const [messageNotification, setMessageNotification] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTab, setMobileTabRaw] = useState(() => sessionStorage.getItem('mobileTab') || 'chats');
  const setMobileTab = (tab) => { setMobileTabRaw(tab); sessionStorage.setItem('mobileTab', tab); };
  const [e2eReady, setE2eReady] = useState(false);
  const [securityCode, setSecurityCode] = useState(null);
  const [securityCodePeer, setSecurityCodePeer] = useState(null);
  const [e2eUnavailable, setE2eUnavailable] = useState(false);
  const [avatarMap, setAvatarMap] = useState({});
  const [callSecurityCode, setCallSecurityCode] = useState(null);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [isConfMinimized, setIsConfMinimized] = useState(false);
  const [newlyCreatedRoomId, setNewlyCreatedRoomId] = useState(null);
  const [showAddMembersPanel, setShowAddMembersPanel] = useState(false);
  const [myContacts, setMyContacts] = useState([]);
  const wsRef = useRef(null);
  const loadedRooms = useRef(new Set());
  const activeRoomIdRef = useRef(null);
  const typingTimeouts = useRef({});
  const typingThrottle = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const unmounted = useRef(false);
  const documentVisible = useRef(true);
  const notifSound = useRef(null);
  const pendingSent = useRef([]); // queue for restoring own encrypted message content
  const roomsRef = useRef([]); // always-current rooms for ws.onmessage closure

  // WebRTC calls hook
  const webrtc = useWebRTC({ wsRef, username, token });

  // Conference hook
  const conference = useConference({ wsRef, username, token });

  // Media permissions (camera + mic) — request once on login
  const mediaPerm = useMediaPermissions();

  // Keep refs up-to-date so ws.onmessage closure always accesses latest values (Bug 1 fix)
  const webrtcRef = useRef(webrtc);
  useEffect(() => { webrtcRef.current = webrtc; });
  const confRef = useRef(conference);
  useEffect(() => { confRef.current = conference; });
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);

  // Auto-join conference from URL (?conf=<confId>) — works for both fresh login and already-logged-in users
  const joinConfIdHandled = useRef(false);
  useEffect(() => {
    // Use prop or fallback to sessionStorage (survives login/register flow)
    const confIdToJoin = joinConfId || sessionStorage.getItem('pendingConfId');
    if (confIdToJoin && connected && !joinConfIdHandled.current) {
      joinConfIdHandled.current = true;
      // Clear sessionStorage — no longer needed
      sessionStorage.removeItem('pendingConfId');
      // Small delay to ensure WS is fully ready and conference hook is initialized
      const timer = setTimeout(async () => {
        try {
          const joined = await confRef.current.joinConference(confIdToJoin, 'audio');
          if (joined) {
            showToast('Вы подключены к конференции 👥', 'success');
          } else {
            showToast('Не удалось подключиться к конференции', 'error');
          }
        } catch (err) {
          console.error('[Conference] Auto-join from URL failed:', err);
          showToast('Не удалось подключиться к конференции', 'error');
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [joinConfId, connected]);

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

  // Request browser notification permission & save it
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        appSettings.savePermission('notification', perm);
      });
    } else if ('Notification' in window) {
      appSettings.savePermission('notification', Notification.permission);
    }
  }, []);

  // Listen for Service Worker notification clicks (navigate to room)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event) => {
      if (event.data?.type === 'PUSH_NAVIGATE' && event.data?.roomId) {
        setActiveRoomId(event.data.roomId);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  const showBrowserNotification = (title, body, roomId) => {
    // Update page title when tab is not visible
    if (document.hidden) {
      const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0) + 1;
      document.title = `(${totalUnread}) 🐱 BarsikChat`;
    }

    if (!appSettings.pushEnabled) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (documentVisible.current && roomId === activeRoomIdRef.current) return;

    // Use Service Worker notification when available (works in background / mobile PWA)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body: body.length > 100 ? body.slice(0, 100) + '…' : body,
          icon: '/barsik-icon.png',
          badge: '/icon-192.png',
          tag: 'barsik-msg-' + roomId,
          renotify: true,
          data: { roomId, url: window.location.origin },
          vibrate: [200, 100, 200],
        });
      }).catch(() => {});
      return;
    }

    // Fallback: Notification API
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
    fetchContacts();
    unmounted.current = false;

    // Initialize E2E encryption
    e2eManager.initialize(token).then(() => {
      setE2eReady(e2eManager.isReady());
      // Clean up old pending sent entries (older than 1 hour)
      cryptoStore.getAll('sentMessages').then(all => {
        const cutoff = Date.now() - 60 * 60 * 1000;
        for (const s of all) {
          if (s.id && s.id.startsWith('pending_') && (s.savedAt || 0) < cutoff) {
            cryptoStore.delete('sentMessages', s.id).catch(() => {});
          }
        }
      }).catch(() => {});
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

      // Handle GROUP_INVITE — show invite popup
      if (msg.type === 'GROUP_INVITE') {
        const roomId = msg.extra?.roomId;
        const roomName = msg.extra?.roomName;
        if (roomId && roomName) {
          setGroupInvite({ sender: msg.sender, roomId, roomName });
        }
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

      // Handle conference signaling (use confRef to avoid stale closure)
      if (msg.type === 'CONF_PEERS') { confRef.current.handleConfPeers(msg); return; }
      if (msg.type === 'CONF_JOIN') { confRef.current.handleConfJoin(msg); return; }
      if (msg.type === 'CONF_OFFER') { confRef.current.handleConfOffer(msg); return; }
      if (msg.type === 'CONF_ANSWER') { confRef.current.handleConfAnswer(msg); return; }
      if (msg.type === 'CONF_ICE') { confRef.current.handleConfIce(msg); return; }
      if (msg.type === 'CONF_LEAVE') { confRef.current.handleConfLeave(msg); return; }

      // Handle WebRTC call signaling (use refs to avoid stale closure — Bug 1 fix)
      if (msg.type === 'CALL_OFFER') {
        webrtcRef.current.handleOffer(msg);
        // Push notification for incoming call (important on mobile when app is in foreground but screen is off)
        if (appSettings.pushEnabled && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('📞 Входящий звонок', {
              body: `${msg.sender} звонит вам`,
              icon: '/barsik-icon.png',
              badge: '/icon-192.png',
              tag: 'barsik-call',
              requireInteraction: true,
              vibrate: [300, 200, 300, 200, 300],
              data: { type: 'call', url: window.location.origin },
            });
          }).catch(() => {});
        }
        return;
      }
      if (msg.type === 'CALL_ANSWER') { webrtcRef.current.handleAnswer(msg); return; }
      if (msg.type === 'ICE_CANDIDATE') { webrtcRef.current.handleIceCandidate(msg); return; }
      if (msg.type === 'CALL_REJECT' || msg.type === 'CALL_END' || msg.type === 'CALL_BUSY') {
        // Auto-join conference when peer upgrades 1:1 → conference
        const extra = msg.extra || {};
        if (msg.type === 'CALL_END' && extra.reason === 'upgrade_to_conference' && extra.confId) {
          webrtcRef.current.handleCallEnd(msg);
          // Small delay to let 1:1 cleanup finish, then auto-join
          setTimeout(async () => {
            const type = extra.confType || 'audio';
            const joined = await confRef.current.joinConference(extra.confId, type);
            if (joined) {
              showToast('Вы подключены к конференции 👥', 'success');
            }
          }, 400);
          return;
        }
        webrtcRef.current.handleCallEnd(msg);
        return;
      }

      // Handle GROUP_KEY — E2E group key distribution
      if (msg.type === 'GROUP_KEY') {
        const extra = msg.extra || {};
        if (extra.roomId && msg.sender) {
          await groupCrypto.receiveKey(msg.sender, extra.roomId, msg);
        }
        return;
      }

      // Handle AVATAR_UPDATE — update avatarMap for all users in real time
      if (msg.type === 'AVATAR_UPDATE') {
        setAvatarMap(prev => ({ ...prev, [msg.sender]: msg.content || '' }));
        // If it's our own avatar, update parent state + localStorage
        if (msg.sender === username && onAvatarChange) {
          const newUrl = msg.content || '';
          onAvatarChange(newUrl);
          localStorage.setItem('avatarUrl', newUrl);
        }
        return;
      }

      const roomId = msg.roomId;
      if (!roomId) return; // ignore messages without room

      // Decrypt E2E message if encrypted
      if (msg.encrypted && msg.sender !== username) {
        let cacheHit = false;

        // FIX #2: Check plaintext cache FIRST — prevents re-decryption on
        // WebSocket reconnect / duplicate delivery, which would corrupt the
        // Double Ratchet session (OTK consumed, ratchet advanced, etc.)
        if (msg.id) {
          try {
            const cached = await cryptoStore.getDecryptedContent(msg.id);
            if (cached) {
              msg.content = cached.content;
              if (cached.fileKey) msg._fileKey = cached.fileKey;
              if (cached.thumbnailKey) msg._thumbnailKey = cached.thumbnailKey;
              cacheHit = true;
            }
          } catch { /* cache miss */ }
        }

        if (!cacheHit) {
          try {
            let result;
            if (msg.groupEncrypted) {
              result = await groupCrypto.decrypt(roomId, msg.encryptedContent, msg.iv);
            } else {
              result = await e2eManager.decrypt(msg.sender, msg);
            }
            if (result.error) {
              msg.content = '🔒 Не удалось расшифровать';
              msg._decryptError = true;
            } else {
              msg.content = result.text;
              if (result.fileKey) msg._fileKey = result.fileKey;
              if (result.thumbnailKey) msg._thumbnailKey = result.thumbnailKey;
              if (msg.id) {
                cryptoStore.saveDecryptedContent(msg.id, result.text, result.fileKey, result.thumbnailKey).catch(() => {});
              }
            }
          } catch (err) {
            console.error('[E2E] Decrypt error:', err);
            msg.content = '🔒 Не удалось расшифровать';
            msg._decryptError = true;
          }
        }
      }

      // Restore own encrypted message from pending queue & persist locally
      if (msg.encrypted && msg.sender === username) {
        const idx = pendingSent.current.findIndex(p => p.roomId === msg.roomId);
        if (idx !== -1) {
          const pending = pendingSent.current[idx];
          msg.content = pending.content;
          msg._fileKey = pending.fileKey;
          msg._thumbnailKey = pending.thumbnailKey;
          pendingSent.current.splice(idx, 1);
          // Persist to IndexedDB so history reload works
          if (msg.id) {
            cryptoStore.saveSentContent(msg.id, pending.content, pending.fileKey, pending.thumbnailKey).catch(() => {});
            cryptoStore.saveDecryptedContent(msg.id, pending.content, pending.fileKey, pending.thumbnailKey).catch(() => {});
          }
        } else if (msg.id) {
          // FIX #4: pendingSent ref may be empty after component remount —
          // fall back to IndexedDB caches (sentMessages / decryptedMessages)
          try {
            let found = false;
            const cached = await cryptoStore.getSentContent(msg.id);
            if (cached) {
              msg.content = cached.content;
              if (cached.fileKey) msg._fileKey = cached.fileKey;
              if (cached.thumbnailKey) msg._thumbnailKey = cached.thumbnailKey;
              found = true;
            }
            if (!found) {
              const dcached = await cryptoStore.getDecryptedContent(msg.id);
              if (dcached) {
                msg.content = dcached.content;
                if (dcached.fileKey) msg._fileKey = dcached.fileKey;
                if (dcached.thumbnailKey) msg._thumbnailKey = dcached.thumbnailKey;
                found = true;
              }
            }
            // Last resort: search for pending_${roomId}_* entries saved before send
            if (!found) {
              const allSent = await cryptoStore.getAll('sentMessages');
              const prefix = `pending_${msg.roomId}_`;
              const pending = allSent
                .filter(s => s.id && s.id.startsWith(prefix))
                .sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))[0];
              if (pending) {
                msg.content = pending.content;
                if (pending.fileKey) msg._fileKey = pending.fileKey;
                if (pending.thumbnailKey) msg._thumbnailKey = pending.thumbnailKey;
                // Migrate to real ID and clean up pending entry
                cryptoStore.saveSentContent(msg.id, pending.content, pending.fileKey, pending.thumbnailKey).catch(() => {});
                cryptoStore.saveDecryptedContent(msg.id, pending.content, pending.fileKey, pending.thumbnailKey).catch(() => {});
                cryptoStore.delete('sentMessages', pending.id).catch(() => {});
              }
            }
          } catch { /* best effort */ }
        }
      }

      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), msg],
      }));

      // Auto-discover new private chat: if message arrives for unknown room, refresh sidebar
      // Use roomsRef (always-current) instead of stale `rooms` closure (Bug fix)
      if (msg.sender !== username && !roomsRef.current.find(r => r.id === roomId)) {
        fetchRooms();
      }

      // Browser push notification + in-app toast for new messages
      if ((msg.type === 'CHAT' || msg.type === 'PRIVATE') && msg.sender !== username) {
        const roomObj = roomsRef.current.find(r => r.id === roomId);
        const roomName = roomObj ? (roomObj.type === 'PRIVATE'
          ? roomObj.name.split(' & ').find(n => n !== username) || roomObj.name
          : roomObj.name) : 'Чат';
        const body = msg.content || (msg.fileUrl ? '📎 Файл' : 'Новое сообщение');
        showBrowserNotification(`${msg.sender} — ${roomName}`, body, roomId);

        // In-app toast notification (Bug 4 fix)
        if (roomId !== activeRoomIdRef.current || document.hidden) {
          setMessageNotification({
            sender: msg.sender,
            roomName,
            content: body,
            roomId,
            avatarUrl: msg.sender ? (roomsRef.current._avatarMap || {})[msg.sender] : '',
          });
        }

        // Play sound if not active tab or not current room
        if (document.hidden || roomId !== activeRoomIdRef.current) {
          try { if (appSettings.notifSound) notifSound.current?.(); } catch (e) {}
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

  const loadRoomHistory = async (roomId) => {
    if (loadedRooms.current.has(roomId)) return;
    loadedRooms.current.add(roomId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      if (data.length > 0) {
        // Decrypt / restore E2E messages in history
        for (const msg of data) {
          if (!msg.encrypted) continue;
          if (msg.sender !== username) {
            // Check local cache FIRST to avoid re-decrypting (prevents session
            // corruption when the same initial X3DH message is processed twice —
            // once in real-time and again from history load)
            if (msg.id) {
              try {
                const cached = await cryptoStore.getDecryptedContent(msg.id);
                if (cached) {
                  msg.content = cached.content;
                  msg._fileKey = cached.fileKey;
                  msg._thumbnailKey = cached.thumbnailKey;
                  continue;
                }
              } catch { /* cache miss — proceed to decrypt */ }
            }
            try {
              let result;
              if (msg.groupEncrypted) {
                // Group E2E — decrypt with shared room key
                result = await groupCrypto.decrypt(roomId, msg.encryptedContent, msg.iv);
              } else if (e2eManager.isReady()) {
                // Private E2E — decrypt via Double Ratchet
                result = await e2eManager.decrypt(msg.sender, msg);
              }
              if (!result || result.error) {
                // Decrypt failed — try local plaintext cache
                try {
                  const cached = await cryptoStore.getDecryptedContent(msg.id);
                  if (cached) {
                    msg.content = cached.content;
                    msg._fileKey = cached.fileKey;
                    msg._thumbnailKey = cached.thumbnailKey;
                  } else {
                    msg.content = '🔒 Не удалось расшифровать';
                    msg._decryptError = true;
                  }
                } catch {
                  msg.content = '🔒 Не удалось расшифровать';
                  msg._decryptError = true;
                }
              } else {
                msg.content = result.text;
                if (result.fileKey) msg._fileKey = result.fileKey;
                if (result.thumbnailKey) msg._thumbnailKey = result.thumbnailKey;
                // Cache decrypted plaintext for future history loads
                if (msg.id) {
                  cryptoStore.saveDecryptedContent(msg.id, result.text, result.fileKey, result.thumbnailKey).catch(() => {});
                }
              }
            } catch {
              // Decrypt threw — try local plaintext cache
              try {
                const cached = await cryptoStore.getDecryptedContent(msg.id);
                if (cached) {
                  msg.content = cached.content;
                  msg._fileKey = cached.fileKey;
                  msg._thumbnailKey = cached.thumbnailKey;
                } else {
                  msg.content = '🔒 Не удалось расшифровать';
                  msg._decryptError = true;
                }
              } catch {
                msg.content = '🔒 Не удалось расшифровать';
                msg._decryptError = true;
              }
            }
          } else {
            // Own messages — restore from local IndexedDB cache
            try {
              let found = false;
              const cached = await cryptoStore.getSentContent(msg.id);
              if (cached) {
                msg.content = cached.content;
                msg._fileKey = cached.fileKey;
                msg._thumbnailKey = cached.thumbnailKey;
                found = true;
              }
              if (!found) {
                const dcached = await cryptoStore.getDecryptedContent(msg.id);
                if (dcached) {
                  msg.content = dcached.content;
                  msg._fileKey = dcached.fileKey;
                  msg._thumbnailKey = dcached.thumbnailKey;
                  found = true;
                }
              }
              // Last resort: search pending entries
              if (!found && roomId) {
                const allSent = await cryptoStore.getAll('sentMessages');
                const prefix = `pending_${roomId}_`;
                const pending = allSent
                  .filter(s => s.id && s.id.startsWith(prefix))
                  .sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))[0];
                if (pending) {
                  msg.content = pending.content;
                  if (pending.fileKey) msg._fileKey = pending.fileKey;
                  if (pending.thumbnailKey) msg._thumbnailKey = pending.thumbnailKey;
                  // Migrate to real ID
                  cryptoStore.saveSentContent(msg.id, pending.content, pending.fileKey, pending.thumbnailKey).catch(() => {});
                  cryptoStore.saveDecryptedContent(msg.id, pending.content, pending.fileKey, pending.thumbnailKey).catch(() => {});
                  cryptoStore.delete('sentMessages', pending.id).catch(() => {});
                }
              }
            } catch { /* ignore */ }
          }
        }
        setMessagesByRoom((prev) => ({ ...prev, [roomId]: data }));
      }
    } catch (err) {
      console.error('[Chat] loadRoomHistory error:', err);
    }
  };

  const fetchUsers = () => {
    fetch('/api/chat/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then((data) => setOnlineUsers(data))
      .catch(console.error);
    // Also refresh all contacts with online status
    fetchContacts();
  };

  const fetchContacts = () => {
    fetch('/api/chat/contacts', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then((data) => {
        setAllUsers(data);
        // Build avatar map from contacts
        const map = {};
        data.forEach(u => { if (u.avatarUrl) map[u.username] = u.avatarUrl; });
        setAvatarMap(prev => ({ ...prev, ...map }));
      })
      .catch(console.error);

    // Also fetch personal contacts list
    fetch('/api/contacts', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => setMyContacts(data))
      .catch(() => {});
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
      // Voice message fields
      if (fileData.duration != null && !fileData.isVideoCircle) {
        msg.type = 'VOICE';
        msg.duration = fileData.duration;
        msg.waveform = fileData.waveform;
      }
      // Video circle fields
      if (fileData.isVideoCircle) {
        msg.type = 'VIDEO_CIRCLE';
        msg.duration = fileData.duration;
        msg.thumbnailUrl = fileData.thumbnailUrl;
      }
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
            const fileE2E = fileData?.fileKey
              ? { fileKey: fileData.fileKey, ...(fileData.thumbnailKey ? { thumbnailKey: fileData.thumbnailKey } : {}) }
              : undefined;
            const encrypted = await e2eManager.encrypt(peerUser, content || '', token, fileE2E);
            Object.assign(msg, encrypted);
            // Strip plaintext — server must never see the real content
            msg.content = '\ud83d\udd12';
            if (msg.replyToContent) msg.replyToContent = '\ud83d\udd12';
            // Queue for restoring own message when server echoes it back
            const sentText = content || '';
            const sentFK = fileData?.fileKey || null;
            const sentTK = fileData?.thumbnailKey || null;
            pendingSent.current.push({
              roomId: activeRoomId,
              content: sentText,
              fileKey: sentFK,
              thumbnailKey: sentTK,
            });
            // FIX #4: Persist plaintext immediately (survives page refresh)
            const pendingKey = `pending_${activeRoomId}_${Date.now()}`;
            cryptoStore.saveSentContent(pendingKey, sentText, sentFK, sentTK).catch(() => {});
          }
        } catch (err) {
          console.warn('[E2E] Encrypt failed, sending plaintext:', err);
        }
      }
    }

    // E2E encrypt for group rooms
    if (room?.type === 'ROOM' && e2eReady) {
      try {
        // Generate group key if we don't have one yet, and distribute
        if (!(await groupCrypto.hasGroupKey(activeRoomId))) {
          await groupCrypto.generateGroupKey(activeRoomId);
          await groupCrypto.distributeKey(wsRef.current, activeRoomId, room.members || [], username, token);
        }
        const payload = fileData?.fileKey
          ? JSON.stringify({ text: content || '', fileKey: fileData.fileKey, ...(fileData.thumbnailKey ? { thumbnailKey: fileData.thumbnailKey } : {}) })
          : (content || '');
        const encrypted = await groupCrypto.encrypt(activeRoomId, payload);
        Object.assign(msg, encrypted);
        msg.content = '\ud83d\udd12';
        if (msg.replyToContent) msg.replyToContent = '\ud83d\udd12';
        const gText = content || '';
        const gFK = fileData?.fileKey || null;
        const gTK = fileData?.thumbnailKey || null;
        pendingSent.current.push({
          roomId: activeRoomId,
          content: gText,
          fileKey: gFK,
          thumbnailKey: gTK,
        });
        // FIX #4: Persist plaintext immediately (group messages)
        const gPendingKey = `pending_${activeRoomId}_${Date.now()}`;
        cryptoStore.saveSentContent(gPendingKey, gText, gFK, gTK).catch(() => {});
      } catch (err) {
        console.warn('[GroupE2E] Encrypt failed, sending plaintext:', err);
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

  const createRoom = async (name, description, groupPhoto) => {
    try {
      let avatarUrl = null;
      if (groupPhoto) {
        const formData = new FormData();
        formData.append('file', groupPhoto);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          avatarUrl = uploadData.url;
        }
      }
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, description: description || undefined, avatarUrl: avatarUrl || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const room = await res.json();
      fetchRooms();
      selectRoom(room.id);
      setNewlyCreatedRoomId(room.id);
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

  const openSavedChat = async () => {
    try {
      const res = await fetch('/api/rooms/saved', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const room = await res.json();
      fetchRooms();
      selectRoom(room.id);
      setMobileTab('chats');
      return room;
    } catch (err) {
      console.error('[Saved] Failed to open saved messages:', err);
      showToast('Не удалось открыть Избранное', 'error');
      return null;
    }
  };

  const forwardToSaved = async (msg) => {
    try {
      // Ensure saved room exists
      const res = await fetch('/api/rooms/saved', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const savedRoom = await res.json();

      // Send the forwarded message to saved room
      const forwardedContent = `↪ ${msg.sender}: ${msg.content || ''}`.trim();
      const fwdMsg = {
        type: 'CHAT',
        roomId: savedRoom.id,
        content: forwardedContent || (msg.fileUrl ? '' : 'Пересланное сообщение'),
      };
      if (msg.fileUrl) {
        fwdMsg.fileUrl = msg.fileUrl;
        fwdMsg.fileName = msg.fileName;
        fwdMsg.fileSize = msg.fileSize;
        fwdMsg.fileType = msg.fileType;
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(fwdMsg));
        showToast('Сохранено в Избранное', 'success');
        fetchRooms();
      }
    } catch (err) {
      console.error('[Saved] Forward failed:', err);
      showToast('Не удалось переслать в Избранное', 'error');
    }
  };

  const deleteRoom = async (roomId) => {
    // Prevent deleting saved messages room
    const room = rooms.find(r => r.id === roomId);
    if (room?.type === 'SAVED_MESSAGES') {
      showToast('Нельзя удалить Избранное', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessagesByRoom((prev) => {
          const copy = { ...prev };
          delete copy[roomId];
          return copy;
        });
        loadedRooms.current.delete(roomId);
        if (activeRoomId === roomId) setActiveRoomId(null);
        fetchRooms();
        if (data.result === 'left') {
          showToast('Вы покинули группу', 'success');
        } else {
          showToast('Чат удалён', 'success');
        }
      } else {
        showToast('Не удалось удалить чат', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Не удалось удалить чат', 'error');
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
  const roomName = activeRoom
    ? (activeRoom.type === 'SAVED_MESSAGES' ? 'Избранное' : activeRoom.name)
    : 'Выберите чат';

  const getPeerUsername = (room) => {
    if (!room || room.type !== 'PRIVATE') return null;
    const parts = room.name.split(' & ');
    return parts.find((p) => p !== username) || null;
  };

  const isPrivateE2E = activeRoom?.type === 'PRIVATE' && e2eReady;
  const isGroupE2E = activeRoom?.type === 'ROOM' && e2eReady;
  const isE2E = isPrivateE2E || isGroupE2E;

  const showSecurityCode = async () => {
    const peer = getPeerUsername(activeRoom);
    if (!peer) return;
    try {
      const code = await e2eManager.getSecurityCode(peer, token);
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

  // Upgrade 1:1 call → conference: create conference, invite peer, close old 1:1 PC
  const upgradeToConference = useCallback(async () => {
    if (webrtc.callState !== 'active') return;
    const peer = webrtc.callPeer;
    const type = webrtc.callType || 'audio';

    // 1. Create conference first (current user joins)
    const confId = await conference.createConference(type);
    if (!confId) return;

    // 2. Signal peer to auto-join the conference, then end 1:1
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'CALL_END',
        extra: {
          target: peer,
          reason: 'upgrade_to_conference',
          confId,
          confType: type,
        },
      }));
    }

    // 3. Silent cleanup of 1:1 call (don't send another CALL_END)
    webrtc.endCallSilent();

    // 4. Auto-copy conference link and notify user
    const copied = await conference.copyShareLink();
    if (copied) {
      showToast('Конференция создана! Ссылка скопирована 📋', 'success');
    } else {
      showToast('Конференция создана!', 'success');
    }
  }, [webrtc, conference, wsRef]);

  // Compute security code when call becomes active (Bug 5)
  useEffect(() => {
    if (webrtc.callState === 'active' && webrtc.callPeer && e2eReady) {
      e2eManager.getSecurityCode(webrtc.callPeer, token)
        .then(code => setCallSecurityCode(code || null))
        .catch(() => setCallSecurityCode(null));
    } else if (webrtc.callState === 'idle') {
      setCallSecurityCode(null);
      setIsCallMinimized(false);
    }
  }, [webrtc.callState, webrtc.callPeer, e2eReady, token]);

  // Reset conference minimize when conference ends
  useEffect(() => {
    if (conference.confState === 'idle') {
      setIsConfMinimized(false);
    }
  }, [conference.confState]);

  return (
    <div className={`chat-container${sidebarOpen ? ' sidebar-active' : ''}${!activeRoomId ? ' mobile-sidebar-view' : ''}`}>
      {/* Skip navigation */}
      <a href="#chat-main" className="skip-nav">Перейти к чату</a>

      {/* Connection lost banner */}
      {!connected && (
        <div className="connection-banner" role="alert">
          <span className="connection-banner-icon">⚠️</span>
          <span className="connection-banner-text">Нет соединения с сервером. Переподключение...</span>
        </div>
      )}

      {/* Toast container */}
      <ToastContainer />

      {/* Desktop: hamburger for sidebar drawer */}
      {!sidebarOpen && (
        <button className="mobile-hamburger desktop-only-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Открыть меню">☰</button>
      )}

      {/* Desktop: sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={(id) => { selectRoom(id); setSidebarOpen(false); }}
        onlineUsers={onlineUsers}
        allUsers={allUsers}
        username={username}
        connected={connected}
        onLogout={onLogout}
        onStartPrivateChat={startPrivateChat}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onDeleteRoom={deleteRoom}
        onShowNews={onShowNews}
        onShowTasks={() => setShowTasks(true)}
        onOpenSaved={openSavedChat}
        token={token}
        unreadCounts={unreadCounts}
        messagesByRoom={messagesByRoom}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        avatarMap={avatarMap}
        avatarUrl={avatarUrl}
        wsRef={wsRef}
        onAvatarChange={onAvatarChange}
        mobileTab={mobileTab}
        myContacts={myContacts}
        onRefreshContacts={fetchContacts}
        onStartCall={async (peer, type) => {
          await startPrivateChat(peer);
          webrtc.startCall(peer, type);
        }}
      />
      {showTasks ? (
        <TaskPanel token={token} username={username} onClose={() => setShowTasks(false)} />
      ) : (
        <ChatRoom
          id="chat-main"
          messages={activeMessages}
          onSendMessage={sendMessage}
          onEditMessage={editMessage}
          onDeleteMessage={deleteMessage}
          onScheduleMessage={scheduleMessage}
          scheduledMessages={scheduledMessages.filter(m => m.roomId === activeRoomId)}
          roomName={roomName}
          username={username}
          connected={connected}
          onBack={() => { setActiveRoomId(null); setMobileTab('chats'); }}
          token={token}
          activeRoom={activeRoom}
          onlineUsers={onlineUsers}
          allUsers={allUsers}
          typingUsers={activeTypingUsers}
          onTyping={sendTyping}
          isE2E={isE2E}
          onShowSecurityCode={showSecurityCode}
          avatarMap={avatarMap}
          onStartCall={(type) => {
            const peer = getPeerUsername(activeRoom);
            if (peer) webrtc.startCall(peer, type);
          }}
          callState={webrtc.callState}
          onLeaveRoom={deleteRoom}
          onForwardToSaved={forwardToSaved}
          onJoinRoom={joinRoom}
          onJoinConference={async (confId) => {
            try {
              const joined = await conference.joinConference(confId, 'audio');
              if (joined) showToast('Вы подключены к конференции \uD83D\uDC65', 'success');
              else showToast('Не удалось подключиться к конференции', 'error');
            } catch { showToast('Не удалось подключиться к конференции', 'error'); }
          }}
          showAddMembers={newlyCreatedRoomId === activeRoomId && newlyCreatedRoomId !== null}
          onAddMembers={() => setShowAddMembersPanel(true)}
          onDismissAddMembers={() => setNewlyCreatedRoomId(null)}
          onStartPrivateChat={startPrivateChat}
        />
      )}
      {showAddMembersPanel && (
        <AddMembersPanel
          allUsers={allUsers}
          username={username}
          avatarMap={avatarMap}
          activeRoom={activeRoom}
          wsRef={wsRef}
          onClose={() => setShowAddMembersPanel(false)}
        />
      )}
      {taskNotification && (
        <TaskNotificationPopup
          notification={taskNotification}
          onClose={() => setTaskNotification(null)}
          onOpenTasks={() => { setTaskNotification(null); setShowTasks(true); }}
        />
      )}
      {groupInvite && (
        <div className="group-invite-overlay">
          <div className="group-invite-popup">
            <div className="group-invite-icon">📩</div>
            <h3 className="group-invite-title">Приглашение в группу</h3>
            <p className="group-invite-text">
              <strong>{groupInvite.sender}</strong> приглашает вас в группу <strong>«{groupInvite.roomName}»</strong>
            </p>
            <div className="group-invite-actions">
              <button className="group-invite-accept" onClick={async () => {
                await joinRoom(groupInvite.roomId);
                setGroupInvite(null);
              }}>Присоединиться</button>
              <button className="group-invite-decline" onClick={() => setGroupInvite(null)}>Отклонить</button>
            </div>
          </div>
        </div>
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
      {messageNotification && (
        <MessageNotificationPopup
          notification={messageNotification}
          onClose={() => setMessageNotification(null)}
          onGoToRoom={(roomId) => {
            setMessageNotification(null);
            if (roomId) selectRoom(roomId);
          }}
        />
      )}
      {mediaPerm.showBanner && (
        <div className="media-perm-banner">
          <div className="media-perm-content">
            {mediaPerm.permissionsDenied ? (
              <>
                <span className="media-perm-icon">🚫</span>
                <span className="media-perm-text">
                  Доступ к камере/микрофону заблокирован. Разрешите в настройках браузера
                  (🔒 в адресной строке → Разрешения).
                </span>
                <button className="media-perm-dismiss" onClick={mediaPerm.dismissBanner}>✕</button>
              </>
            ) : (
              <>
                <span className="media-perm-icon">📹</span>
                <span className="media-perm-text">
                  Разрешите доступ к камере и микрофону, чтобы звонки работали без задержек.
                </span>
                <button className="media-perm-btn" onClick={mediaPerm.requestPermissions}>
                  Разрешить
                </button>
                <button className="media-perm-dismiss" onClick={mediaPerm.dismissBanner}>✕</button>
              </>
            )}
          </div>
        </div>
      )}
      {webrtc.callState === 'incoming' && (
        <IncomingCallModal
          caller={webrtc.callPeer}
          callType={webrtc.callType}
          avatarUrl={avatarMap[webrtc.callPeer] || ''}
          onAccept={webrtc.acceptCall}
          onReject={webrtc.rejectCall}
        />
      )}
      {(webrtc.callState === 'outgoing' || webrtc.callState === 'connecting' || webrtc.callState === 'active') && (
        <CallScreen
          callState={webrtc.callState}
          callPeer={webrtc.callPeer}
          callType={webrtc.callType}
          callDuration={webrtc.callDuration}
          isMuted={webrtc.isMuted}
          isVideoOff={webrtc.isVideoOff}
          avatarUrl={avatarMap[webrtc.callPeer] || ''}
          localVideoRef={webrtc.localVideoRef}
          remoteVideoRef={webrtc.remoteVideoRef}
          onEndCall={webrtc.endCall}
          onToggleMute={webrtc.toggleMute}
          onToggleVideo={webrtc.toggleVideo}
          securityCode={callSecurityCode}
          onUpgradeToConference={upgradeToConference}
          isMinimized={isCallMinimized}
          onMinimize={() => setIsCallMinimized(true)}
          onRestore={() => setIsCallMinimized(false)}
        />
      )}
      {conference.confState !== 'idle' && (
        <ConferenceScreen
          confState={conference.confState}
          participants={conference.participants}
          username={username}
          confType={conference.confType}
          confDuration={conference.confDuration}
          isMuted={conference.isMuted}
          isVideoOff={conference.isVideoOff}
          avatarMap={avatarMap}
          localVideoRef={conference.localVideoRef}
          localStream={conference.localStreamRef}
          setRemoteVideoRef={conference.setRemoteVideoRef}
          getRemoteStream={conference.getRemoteStream}
          onLeave={conference.leaveConference}
          onToggleMute={conference.toggleMute}
          onToggleVideo={conference.toggleVideo}
          onCopyLink={conference.copyShareLink}
          isMinimized={isConfMinimized}
          onMinimize={() => setIsConfMinimized(true)}
          onRestore={() => setIsConfMinimized(false)}
        />
      )}

      {/* ── Mobile Bottom Navigation (Telegram-style) ── */}
      <nav className="mobile-bottom-nav">
        <button className={`bottom-nav-item${mobileTab === 'chats' ? ' active' : ''}`} onClick={() => { setMobileTab('chats'); if (activeRoomId) setActiveRoomId(null); }}>
          <span className="bottom-nav-icon"><MessageSquare size={22} /></span>
          <span className="bottom-nav-label">Чаты</span>
          {(() => { const t = Object.values(unreadCounts).reduce((s,v) => s+v, 0); return t > 0 ? <span className="bottom-nav-badge">{t > 99 ? '99+' : t}</span> : null; })()}
        </button>
        <button className={`bottom-nav-item${mobileTab === 'contacts' ? ' active' : ''}`} onClick={() => { setMobileTab('contacts'); if (activeRoomId) setActiveRoomId(null); }}>
          <span className="bottom-nav-icon"><Users size={22} /></span>
          <span className="bottom-nav-label">Контакты</span>
        </button>
        <button className={`bottom-nav-item${mobileTab === 'settings' ? ' active' : ''}`} onClick={() => { setMobileTab('settings'); if (activeRoomId) setActiveRoomId(null); }}>
          <span className="bottom-nav-icon"><FlaskConical size={22} /></span>
          <span className="bottom-nav-label">Песочница</span>
        </button>
        <button className={`bottom-nav-item${mobileTab === 'profile' ? ' active' : ''}`} onClick={() => { setMobileTab('profile'); if (activeRoomId) setActiveRoomId(null); }}>
          <span className="bottom-nav-icon">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="bottom-nav-avatar" />
              : <User size={22} />}
          </span>
          <span className="bottom-nav-label">Профиль</span>
        </button>
      </nav>
    </div>
  );
}
