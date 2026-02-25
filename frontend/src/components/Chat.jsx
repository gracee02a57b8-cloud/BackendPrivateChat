import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Users, User, FlaskConical, Bot, Camera, MessageSquarePlus } from 'lucide-react';
import Sidebar from './Sidebar';
import ChatRoom from './ChatRoom';
import TaskPanel from './TaskPanel';
import TaskNotificationPopup from './TaskNotificationPopup';
import ReplyNotificationPopup from './ReplyNotificationPopup';
import MessageNotificationPopup from './MessageNotificationPopup';
import IncomingCallModal from './IncomingCallModal';
import CallScreen from './CallScreen';
import ConferenceScreen from './ConferenceScreen';
import AddMembersPanel from './AddMembersPanel';
import StoryUploadModal from './StoryUploadModal';
import StoryViewer from './StoryViewer';
import ToastContainer, { showToast } from './Toast';
import useWebRTC from '../hooks/useWebRTC';
import useConference from '../hooks/useConference';
import useMediaPermissions from '../hooks/useMediaPermissions';
import useStories from '../hooks/useStories';
import appSettings from '../utils/appSettings';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

export default function Chat({ token, username, avatarUrl, onAvatarChange, onLogout, onAddAccount, onSwitchAccount, savedAccounts, joinRoomId, joinConfId, onShowNews }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomIdRaw] = useState(() => {
    const saved = sessionStorage.getItem('activeRoomId');
    return saved ? Number(saved) : null;
  });
  const setActiveRoomId = (id) => { setActiveRoomIdRaw(id); if (id != null) sessionStorage.setItem('activeRoomId', id); else sessionStorage.removeItem('activeRoomId'); };
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [showConnBanner, setShowConnBanner] = useState(false);
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
  const [avatarMap, setAvatarMap] = useState({});
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [isConfMinimized, setIsConfMinimized] = useState(false);
  const [newlyCreatedRoomId, setNewlyCreatedRoomId] = useState(null);
  const [showAddMembersPanel, setShowAddMembersPanel] = useState(false);
  const [myContacts, setMyContacts] = useState([]);
  const [showStoryUpload, setShowStoryUpload] = useState(false);
  const [storyViewerAuthor, setStoryViewerAuthor] = useState(null);
  const [disappearingTimers, setDisappearingTimers] = useState({});

  const wsRef = useRef(null);
  const loadedRooms = useRef(new Set());
  const activeRoomIdRef = useRef(null);
  const typingTimeouts = useRef({});
  const typingThrottle = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const unmounted = useRef(false);
  const documentVisible = useRef(true);
  const notifSound = useRef(null);
  const roomsRef = useRef([]); // always-current rooms for ws.onmessage closure

  // WebRTC calls hook
  const webrtc = useWebRTC({ wsRef, username, token });

  // Conference hook
  const conference = useConference({ wsRef, username, token });

  // Media permissions (camera + mic) — request once on login
  const mediaPerm = useMediaPermissions();

  // Stories hook
  const storiesHook = useStories({ token, username, wsRef });

  // Keep refs up-to-date so ws.onmessage closure always accesses latest values (Bug 1 fix)
  const webrtcRef = useRef(webrtc);
  useEffect(() => { webrtcRef.current = webrtc; });
  const confRef = useRef(conference);
  useEffect(() => { confRef.current = conference; });
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  const storiesRef = useRef(storiesHook);
  useEffect(() => { storiesRef.current = storiesHook; });

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

      // On mobile, AudioContext starts in 'suspended' state and needs
      // a user gesture to resume. We attach a one-time touch/click listener.
      const resumeAudio = () => {
        if (ctx.state === 'suspended') {
          ctx.resume().then(() => {
            console.log('[Sound] AudioContext resumed');
          }).catch(() => {});
        }
      };
      // Resume on any user interaction
      document.addEventListener('touchstart', resumeAudio, { once: true, passive: true });
      document.addEventListener('click', resumeAudio, { once: true });
      // Also try to resume immediately (works on some browsers)
      resumeAudio();

      notifSound.current = () => {
        // Ensure context is running before playing
        if (ctx.state === 'suspended') ctx.resume();
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

  // Track tab visibility & reconnect WS when user returns to tab
  useEffect(() => {
    const handleVisibility = () => {
      documentVisible.current = !document.hidden;
      // Clear title badge when user returns to tab
      if (!document.hidden) {
        document.title = '🐱 BarsikChat';
        // Force reconnect if WS is not open when tab becomes visible
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reconnectAttempts.current = 0;
          clearTimeout(reconnectTimer.current);
          // connectWs will be triggered via the 'reconnect' custom event
          window.dispatchEvent(new Event('ws-reconnect'));
        }
      }
    };
    const handleOnline = () => {
      // Browser came back online — force reconnect
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reconnectAttempts.current = 0;
        clearTimeout(reconnectTimer.current);
        window.dispatchEvent(new Event('ws-reconnect'));
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
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
    if (documentVisible.current && roomId === activeRoomIdRef.current) return;

    // Play sound when notification arrives (even on mobile)
    try { if (appSettings.notifSound) notifSound.current?.(); } catch (e) {}

    // Vibrate on mobile if available
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}

    // Check if browser Notification API is available (not in Capacitor WebView)
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

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

  // Delay showing connection banner to avoid flash during initial WS handshake
  useEffect(() => {
    if (connected) { setShowConnBanner(false); return; }
    const t = setTimeout(() => setShowConnBanner(true), 2500);
    return () => clearTimeout(t);
  }, [connected]);

  useEffect(() => {
    fetchRooms();
    fetchContacts();
    unmounted.current = false;

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

      // Handle STORY_POSTED — refresh stories bar
      if (msg.type === 'STORY_POSTED') {
        storiesRef.current.fetchStories();
        return;
      }

      const roomId = msg.roomId;
      if (!roomId) return; // ignore messages without room

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
      // Auto-reconnect with exponential backoff (no limit, max 60s delay)
      if (!unmounted.current) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 60000);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connectWs, delay);
      }
    };
    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setConnected(false);
    };
    }

    // Listen for forced reconnect events (visibility change, online event)
    const handleForceReconnect = () => {
      if (!unmounted.current) connectWs();
    };
    window.addEventListener('ws-reconnect', handleForceReconnect);

    connectWs();

    return () => {
      unmounted.current = true;
      clearTimeout(reconnectTimer.current);
      window.removeEventListener('ws-reconnect', handleForceReconnect);
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

  /**
   * Forward one or more messages to selected contacts/rooms.
   * targets can contain room IDs or "user:<username>" for users without an existing room.
   */
  const forwardToContacts = async (messagesToForward, targets) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    let successCount = 0;

    for (const target of targets) {
      let targetRoomId = target;

      // If target is a user without existing chat, create a private room first
      if (target.startsWith('user:')) {
        const targetUser = target.replace('user:', '');
        try {
          const res = await fetch(`/api/rooms/private/${targetUser}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) continue;
          const room = await res.json();
          targetRoomId = room.id;
          fetchRooms();
        } catch {
          continue;
        }
      }

      // Send each forwarded message
      for (const msg of messagesToForward) {
        const forwardedContent = `↪ ${msg.sender}: ${msg.content || ''}`.trim();
        const fwdMsg = {
          type: 'CHAT',
          roomId: targetRoomId,
          content: forwardedContent || (msg.fileUrl ? '' : 'Пересланное сообщение'),
        };
        if (msg.fileUrl) {
          fwdMsg.fileUrl = msg.fileUrl;
          fwdMsg.fileName = msg.fileName;
          fwdMsg.fileSize = msg.fileSize;
          fwdMsg.fileType = msg.fileType;
        }
        wsRef.current.send(JSON.stringify(fwdMsg));
      }
      successCount++;
    }

    if (successCount > 0) {
      const msgWord = messagesToForward.length > 1 ? `${messagesToForward.length} сообщений` : 'сообщение';
      const recipientWord = successCount > 1 ? `${successCount} получателям` : '1 получателю';
      showToast(`Переслано ${msgWord} ${recipientWord}`, 'success');
      fetchRooms();
    }
  };

  // Disappearing messages: set timer for a room
  const setDisappearingTimer = (roomId, seconds) => {
    setDisappearingTimers(prev => ({ ...prev, [roomId]: seconds }));
    if (seconds > 0) {
      showToast(`Исчезающие сообщения: ${seconds >= 86400 ? `${seconds / 86400} д.` : seconds >= 3600 ? `${seconds / 3600} ч.` : seconds >= 60 ? `${seconds / 60} мин.` : `${seconds} сек.`}`, 'success');
    } else {
      showToast('Исчезающие сообщения выключены', 'success');
    }
  };

  // Disappearing messages auto-delete effect
  useEffect(() => {
    const intervals = [];
    for (const [roomId, timer] of Object.entries(disappearingTimers)) {
      if (timer <= 0) continue;
      const interval = setInterval(() => {
        setMessagesByRoom(prev => {
          const msgs = prev[roomId];
          if (!msgs || msgs.length === 0) return prev;
          const now = Date.now();
          const filtered = msgs.filter(msg => {
            if (msg.type === 'JOIN' || msg.type === 'LEAVE' || msg.type === 'CALL_LOG') return true;
            if (!msg.timestamp) return true;
            const ts = new Date(msg.timestamp.includes?.('T') ? msg.timestamp : msg.timestamp.replace(' ', 'T'));
            if (isNaN(ts.getTime())) return true;
            return (now - ts.getTime()) < timer * 1000;
          });
          if (filtered.length === msgs.length) return prev;
          return { ...prev, [roomId]: filtered };
        });
      }, 5000); // check every 5 seconds
      intervals.push(interval);
    }
    return () => intervals.forEach(clearInterval);
  }, [disappearingTimers]);

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

  // Reset call minimize when call ends
  useEffect(() => {
    if (webrtc.callState === 'idle') {
      setIsCallMinimized(false);
    }
  }, [webrtc.callState]);

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
      {showConnBanner && (
        <div className="connection-banner" role="alert" data-testid="connection-banner">
          <span className="connection-banner-icon">⚠️</span>
          <span className="connection-banner-text">Нет соединения с сервером. Переподключение...</span>
        </div>
      )}

      {/* Toast container */}
      <ToastContainer />

      {/* Desktop: hamburger for sidebar drawer */}
      {!sidebarOpen && (
        <button className="mobile-hamburger desktop-only-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Открыть меню" data-testid="mobile-hamburger">☰</button>
      )}

      {/* Desktop: sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} data-testid="sidebar-overlay" />
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
        onAddAccount={onAddAccount}
        onSwitchAccount={onSwitchAccount}
        savedAccounts={savedAccounts}
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
        setMobileTab={setMobileTab}
        myContacts={myContacts}
        onRefreshContacts={fetchContacts}
        storiesHook={storiesHook}
        onOpenStoryViewer={(author) => setStoryViewerAuthor(author)}
        onOpenStoryUpload={() => setShowStoryUpload(true)}
        typingUsers={typingUsers}
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
          avatarMap={avatarMap}
          onStartCall={(type) => {
            const peer = getPeerUsername(activeRoom);
            if (peer) webrtc.startCall(peer, type);
          }}
          callState={webrtc.callState}
          onLeaveRoom={deleteRoom}
          onForwardToSaved={forwardToSaved}
          onForwardToContacts={forwardToContacts}
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
          rooms={rooms}
          disappearingTimer={disappearingTimers[activeRoomId] || 0}
          onSetDisappearingTimer={(seconds) => setDisappearingTimer(activeRoomId, seconds)}
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
          onUpgradeToConference={upgradeToConference}
          isMinimized={isCallMinimized}
          onMinimize={() => setIsCallMinimized(true)}
          onRestore={() => setIsCallMinimized(false)}
          onSwitchCamera={webrtc.switchCamera}
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

      {/* ── FAB Buttons (visible on chats tab, no active room on mobile) ── */}
      {!activeRoomId && mobileTab === 'chats' && (
        <div className="fab-container" data-testid="fab-container">
          <button className="fab fab-story" onClick={() => setShowStoryUpload(true)} title="Новая история">
            <Camera size={22} />
          </button>
          <button className="fab fab-chat" onClick={() => { setMobileTab('contacts'); }} title="Новое сообщение">
            <MessageSquarePlus size={22} />
          </button>
        </div>
      )}

      {/* ── Story Upload Modal ── */}
      {showStoryUpload && (
        <StoryUploadModal
          onClose={() => setShowStoryUpload(false)}
          onUpload={storiesHook.uploadStory}
        />
      )}

      {/* ── Story Viewer ── */}
      {storyViewerAuthor && storiesHook.groupedStories.length > 0 && (
        <StoryViewer
          groupedStories={storiesHook.groupedStories}
          initialAuthor={storyViewerAuthor}
          username={username}
          avatarMap={avatarMap}
          onClose={() => setStoryViewerAuthor(null)}
          onView={storiesHook.viewStory}
          onDelete={storiesHook.deleteStory}
          onGetViewers={storiesHook.getViewers}
        />
      )}

      {/* ── Mobile Bottom Navigation (Telegram-style) ── */}
      <nav className="mobile-bottom-nav" data-testid="mobile-bottom-nav">
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
        <button className={`bottom-nav-item${mobileTab === 'ai' ? ' active' : ''}`} onClick={() => { setMobileTab('ai'); if (activeRoomId) setActiveRoomId(null); }}>
          <span className="bottom-nav-icon"><Bot size={22} /></span>
          <span className="bottom-nav-label">AI</span>
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
