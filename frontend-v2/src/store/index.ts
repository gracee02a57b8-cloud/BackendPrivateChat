// ═══════════════════════════════════════════════
//  BarsikChat Global Store (Zustand)
// ═══════════════════════════════════════════════
import { create } from 'zustand';

// ── Types ──
export interface User {
  username: string;
  avatarUrl?: string;
  tag?: string;
  online?: boolean;
  lastSeen?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  phone?: string;
  birthday?: string;
}

export interface Message {
  id?: number;
  tempId?: string;
  roomId: number;
  sender: string;
  content: string;
  type?: 'CHAT' | 'VOICE' | 'VIDEO_CIRCLE' | 'JOIN' | 'LEAVE' | 'CALL_LOG';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyToId?: number;
  replyToSender?: string;
  replyToContent?: string;
  editedAt?: string;
  status?: 'SENT' | 'DELIVERED' | 'READ';
  timestamp?: string;
  reactions?: Record<string, string[]>;
  mentions?: string[];
  pinnedBy?: string;
  forwardedFrom?: string;
  disappearAfter?: number;
  scheduledAt?: string;
  callType?: string;
  callDuration?: number;
  callStatus?: string;
}

export interface Room {
  id: number;
  name: string;
  type: 'GROUP' | 'PRIVATE' | 'SAVED';
  lastMessage?: string;
  lastMessageTime?: string;
  lastSender?: string;
  unreadCount?: number;
  avatarUrl?: string;
  members?: string[];
  createdBy?: string;
  description?: string;
  pinned?: boolean;
  muted?: boolean;
  otherUser?: string;
  typingUsers?: string[];
  e2eEnabled?: boolean;
  disappearingTtl?: number;
}

export type View = 'chats' | 'contacts' | 'settings' | 'profile' | 'ai';
export type Theme = 'auto' | 'dark' | 'light';

interface AppState {
  // ── Auth ──
  token: string | null;
  username: string | null;
  role: string | null;
  avatarUrl: string | null;
  tag: string | null;

  // ── Data ──
  rooms: Room[];
  messages: Record<number, Message[]>;
  users: User[];
  contacts: User[];
  activeRoomId: number | null;
  onlineUsers: string[];
  avatarMap: Record<string, string>;
  typingMap: Record<number, string[]>;
  unreadMap: Record<number, number>;
  scheduledMessages: Message[];

  // ── UI ──
  view: View;
  sidebarOpen: boolean;
  theme: Theme;
  isMobile: boolean;
  wsConnected: boolean;

  // ── Actions ──
  setAuth: (token: string, username: string, role: string, avatarUrl?: string, tag?: string) => void;
  logout: () => void;
  setRooms: (rooms: Room[]) => void;
  updateRoom: (id: number, data: Partial<Room>) => void;
  addRoom: (room: Room) => void;
  removeRoom: (id: number) => void;
  setMessages: (roomId: number, msgs: Message[]) => void;
  addMessage: (roomId: number, msg: Message) => void;
  updateMessage: (roomId: number, msgId: number, data: Partial<Message>) => void;
  deleteMessage: (roomId: number, msgId: number) => void;
  setActiveRoom: (id: number | null) => void;
  setUsers: (users: User[]) => void;
  setContacts: (contacts: User[]) => void;
  setView: (view: View) => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  setIsMobile: (mobile: boolean) => void;
  setAvatarUrl: (url: string | null) => void;
  setOnlineUsers: (users: string[]) => void;
  setAvatarMap: (map: Record<string, string>) => void;
  updateAvatarMap: (username: string, url: string) => void;
  setTyping: (roomId: number, users: string[]) => void;
  setUnread: (roomId: number, count: number) => void;
  incrementUnread: (roomId: number) => void;
  clearUnread: (roomId: number) => void;
  setWsConnected: (connected: boolean) => void;
  addScheduledMessage: (msg: Message) => void;
  removeScheduledMessage: (id: number) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // ── Auth ──
  token: localStorage.getItem('token'),
  username: localStorage.getItem('username'),
  role: localStorage.getItem('role'),
  avatarUrl: localStorage.getItem('avatarUrl'),
  tag: localStorage.getItem('tag'),

  // ── Data ──
  rooms: [],
  messages: {},
  users: [],
  contacts: [],
  activeRoomId: null,
  onlineUsers: [],
  avatarMap: {},
  typingMap: {},
  unreadMap: {},
  scheduledMessages: [],

  // ── UI ──
  view: 'chats',
  sidebarOpen: true,
  theme: (localStorage.getItem('barsik_theme') as Theme) || 'auto',
  isMobile: window.innerWidth <= 768,
  wsConnected: false,

  // ── Actions ──
  setAuth: (token, username, role, avatarUrl, tag) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    localStorage.setItem('role', role);
    if (avatarUrl) localStorage.setItem('avatarUrl', avatarUrl);
    if (tag) localStorage.setItem('tag', tag);
    set({ token, username, role, avatarUrl: avatarUrl || null, tag: tag || null });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('avatarUrl');
    localStorage.removeItem('tag');
    set({ token: null, username: null, role: null, avatarUrl: null, tag: null, rooms: [], messages: {}, activeRoomId: null });
  },

  setRooms: (rooms) => set({ rooms }),
  updateRoom: (id, data) => set((s) => ({
    rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...data } : r)),
  })),
  addRoom: (room) => set((s) => ({
    rooms: s.rooms.some((r) => r.id === room.id) ? s.rooms : [room, ...s.rooms],
  })),
  removeRoom: (id) => set((s) => ({
    rooms: s.rooms.filter((r) => r.id !== id),
    activeRoomId: s.activeRoomId === id ? null : s.activeRoomId,
  })),

  setMessages: (roomId, msgs) => set((s) => ({
    messages: { ...s.messages, [roomId]: msgs },
  })),
  addMessage: (roomId, msg) => set((s) => {
    const existing = s.messages[roomId] || [];
    // Dedupe by id or tempId
    if (msg.id && existing.some((m) => m.id === msg.id)) return s;
    // Replace temp with real
    const filtered = msg.id && msg.tempId
      ? existing.filter((m) => m.tempId !== msg.tempId)
      : existing;
    return { messages: { ...s.messages, [roomId]: [...filtered, msg] } };
  }),
  updateMessage: (roomId, msgId, data) => set((s) => ({
    messages: {
      ...s.messages,
      [roomId]: (s.messages[roomId] || []).map((m) => (m.id === msgId ? { ...m, ...data } : m)),
    },
  })),
  deleteMessage: (roomId, msgId) => set((s) => ({
    messages: {
      ...s.messages,
      [roomId]: (s.messages[roomId] || []).filter((m) => m.id !== msgId),
    },
  })),

  setActiveRoom: (id) => set({ activeRoomId: id }),
  setUsers: (users) => set({ users }),
  setContacts: (contacts) => set({ contacts }),
  setView: (view) => set({ view }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => {
    localStorage.setItem('barsik_theme', theme);
    set({ theme });
  },
  setIsMobile: (mobile) => set({ isMobile: mobile }),
  setAvatarUrl: (url) => {
    if (url) localStorage.setItem('avatarUrl', url);
    else localStorage.removeItem('avatarUrl');
    set({ avatarUrl: url });
  },

  // ── New actions ──
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  setAvatarMap: (map) => set({ avatarMap: map }),
  updateAvatarMap: (username, url) => set((s) => ({
    avatarMap: { ...s.avatarMap, [username]: url },
  })),
  setTyping: (roomId, users) => set((s) => ({
    typingMap: { ...s.typingMap, [roomId]: users },
  })),
  setUnread: (roomId, count) => set((s) => ({
    unreadMap: { ...s.unreadMap, [roomId]: count },
  })),
  incrementUnread: (roomId) => set((s) => ({
    unreadMap: { ...s.unreadMap, [roomId]: (s.unreadMap[roomId] || 0) + 1 },
  })),
  clearUnread: (roomId) => set((s) => ({
    unreadMap: { ...s.unreadMap, [roomId]: 0 },
  })),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  addScheduledMessage: (msg) => set((s) => ({
    scheduledMessages: [...s.scheduledMessages, msg],
  })),
  removeScheduledMessage: (id) => set((s) => ({
    scheduledMessages: s.scheduledMessages.filter((m) => m.id !== id),
  })),
}));
