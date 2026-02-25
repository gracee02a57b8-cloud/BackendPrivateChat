import { useState, useRef, useEffect, useCallback } from 'react';
import UserSearch from './UserSearch';
import CreateRoom from './CreateRoom';
import JoinRoom from './JoinRoom';
import ProfileModal from './ProfileModal';
import MyProfilePage from './MyProfilePage';
import EditProfilePage from './EditProfilePage';
import RecentCalls from './RecentCalls';
import AiChatPage from './AiChatPage';
import StoriesBar from './StoriesBar';
import { copyToClipboard } from '../utils/clipboard';
import appSettings from '../utils/appSettings';
import { getAvatarColor, getInitials, formatLastSeen } from '../utils/avatar';
import { ArrowLeft, MoreVertical, User, Mail, Plus, Bookmark, Download, X, Search, Users, MessageSquare, Pin, Phone, Star, Newspaper, ClipboardList, Link, Volume2, Bell, BellOff, Settings, LogOut, ChevronDown, ChevronUp, FolderPlus, Trash2, Check, CheckCircle, Edit3, ArrowUpDown, Folder, Menu, UserPlus, Clock, Info, RefreshCw, Smartphone } from 'lucide-react';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts.includes?.('T') ? ts : ts.replace(' ', 'T'));
  if (isNaN(d.getTime())) {
    if (/^\d{2}:\d{2}/.test(ts)) return ts.slice(0, 5);
    return '';
  }
  const now = new Date();
  const diff = now - d;
  const oneDay = 86400000;
  if (diff < oneDay && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth()) {
    return 'Вчера';
  }
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  if (diff < 7 * oneDay) return days[d.getDay()];
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function Sidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onlineUsers,
  allUsers = [],
  username,
  connected,
  onLogout,
  onAddAccount,
  onSwitchAccount,
  savedAccounts = [],
  onStartPrivateChat,
  onCreateRoom,
  onJoinRoom,
  onShowNews,
  onShowTasks,
  token,
  unreadCounts = {},
  messagesByRoom = {},
  sidebarOpen,
  onCloseSidebar,
  avatarMap = {},
  avatarUrl,
  wsRef,
  onAvatarChange,
  mobileTab = 'chats',
  setMobileTab,
  onOpenSaved,
  onStartCall,
  myContacts = [],
  onRefreshContacts,
  storiesHook,
  onOpenStoryViewer,
  onOpenStoryUpload,
  typingUsers = {},
}) {
  const [chatFilter, setChatFilter] = useState('all');
  const [showSearch, setShowSearch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [contactSearchResults, setContactSearchResults] = useState([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [pinnedRooms, setPinnedRooms] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`pinnedRooms_${username}`) || '[]')); }
    catch { return new Set(); }
  });
  const [showProfile, setShowProfile] = useState(false);
  const [profileSubView, setProfileSubView] = useState('main');
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [contactsSubView, setContactsSubView] = useState('list'); // 'list' | 'calls'
  const [inviteCopied, setInviteCopied] = useState(false); // 'main' | 'edit' | 'settings'
  const [installPrompt, setInstallPrompt] = useState(null);
  const [notifSoundOn, setNotifSoundOn] = useState(() => appSettings.notifSound);
  const [callSoundOn, setCallSoundOn] = useState(() => appSettings.callSound);
  const [pushOn, setPushOn] = useState(() => appSettings.pushEnabled);
  const [storiesFeedOpen, setStoriesFeedOpen] = useState(false);
  const [chatFolders, setChatFolders] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`chatFolders_${username}`) || '[]'); }
    catch { return []; }
  });
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderSelectedRooms, setFolderSelectedRooms] = useState(new Set());
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [folderContextMenu, setFolderContextMenu] = useState(null);
  const [settingsFolderView, setSettingsFolderView] = useState(null); // null | folderId
  const [showBurgerDrawer, setShowBurgerDrawer] = useState(false);
  const menuRef = useRef(null);
  const filtersRef = useRef(null);
  const contextMenuRef = useRef(null);
  const burgerRef = useRef(null);
  const storiesBarRef = useRef(null);
  const searchInputRef = useRef(null);
  const pullStartY = useRef(0);
  const pullActive = useRef(false);
  const chatListRef = useRef(null);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    // Hide button once installed
    window.addEventListener('appinstalled', () => setInstallPrompt(null));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Interactive stories bar shrink on chat list scroll (Telegram-style)
  useEffect(() => {
    const el = chatListRef.current;
    const bar = storiesBarRef.current;
    if (!el || !bar) return;
    const onScroll = () => {
      const scrollY = el.scrollTop;
      const maxScroll = 60; // px to fully collapse
      const progress = Math.min(scrollY / maxScroll, 1); // 0→1
      // Ring: 48px → 34px
      const ring = 48 - progress * 14;
      // Gap: 8px → 4px
      const gap = 8 - progress * 4;
      // Padding: 8px → 3px
      const pad = 8 - progress * 5;
      // Min width: 56 → 38
      const minW = 56 - progress * 18;
      // Name: visible → hidden
      const nameOpacity = Math.max(1 - progress * 2.5, 0);
      const nameH = nameOpacity > 0 ? 16 : 0;
      // Name gap
      const nameGap = Math.max(3 - progress * 3, 0);

      bar.style.setProperty('--stories-ring', `${ring}px`);
      bar.style.setProperty('--stories-gap', `${gap}px`);
      bar.style.setProperty('--stories-pad', `${pad}px`);
      bar.style.setProperty('--stories-min-w', `${minW}px`);
      bar.style.setProperty('--stories-name-opacity', nameOpacity);
      bar.style.setProperty('--stories-name-h', `${nameH}px`);
      bar.style.setProperty('--stories-name-gap', `${nameGap}px`);
    };
    onScroll(); // apply current scroll position immediately
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [mobileTab, showContacts, !!storiesHook]);

  // Debounced contact search via API (search people by name and tag)
  useEffect(() => {
    if ((mobileTab !== 'contacts' && mobileTab !== 'chats') || !searchFilter.trim()) {
      setContactSearchResults([]);
      return;
    }
    setSearchingContacts(true);
    const timer = setTimeout(() => {
      fetch(`/api/chat/users?search=${encodeURIComponent(searchFilter.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          setContactSearchResults(data.filter(u => u.username !== username));
          setSearchingContacts(false);
        })
        .catch(() => { setContactSearchResults([]); setSearchingContacts(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchFilter, mobileTab, token, username]);

  // Reset profile sub-view when switching tabs
  useEffect(() => {
    if (mobileTab !== 'profile') setProfileSubView('main');
    if (mobileTab !== 'contacts') setContactsSubView('list');
    setShowMobileSettings(false);
  }, [mobileTab]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') setInstallPrompt(null);
  };

  // Click-outside handler for three-dot menu (Bug 3 fix)
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Click-outside handler for folder context menu
  useEffect(() => {
    if (!folderContextMenu) return;
    const handleClick = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) setFolderContextMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [folderContextMenu]);

  // Click-outside handler for burger drawer
  useEffect(() => {
    if (!showBurgerDrawer) return;
    const handleClick = (e) => {
      if (burgerRef.current && !burgerRef.current.contains(e.target)) setShowBurgerDrawer(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showBurgerDrawer]);

  // Horizontal wheel scroll on filter tabs
  useEffect(() => {
    const el = filtersRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mobileTab]);

  // Pull-to-reveal stories gesture
  const handlePullStart = useCallback((e) => {
    const el = chatListRef.current;
    if (el && el.scrollTop <= 0 && !storiesFeedOpen) {
      pullStartY.current = e.touches[0].clientY;
      pullActive.current = true;
    }
  }, [storiesFeedOpen]);

  const handlePullMove = useCallback((e) => {
    if (!pullActive.current) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 60) {
      setStoriesFeedOpen(true);
      pullActive.current = false;
    }
  }, []);

  const handlePullEnd = useCallback(() => {
    pullActive.current = false;
  }, []);

  const togglePin = (e, roomId) => {
    e.stopPropagation();
    setPinnedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId); else next.add(roomId);
      localStorage.setItem(`pinnedRooms_${username}`, JSON.stringify([...next]));
      return next;
    });
  };

  const saveFolders = (folders) => {
    setChatFolders(folders);
    localStorage.setItem(`chatFolders_${username}`, JSON.stringify(folders));
  };

  const openCreateFolder = () => {
    setFolderName('');
    setFolderSelectedRooms(new Set());
    setEditingFolderId(null);
    setShowFolderModal(true);
  };

  const openEditFolder = (e, folder) => {
    if (e) e.stopPropagation();
    setFolderName(folder.name);
    setFolderSelectedRooms(new Set(folder.roomIds));
    setEditingFolderId(folder.id);
    setShowFolderModal(true);
  };

  const handleSaveFolder = () => {
    const name = folderName.trim();
    if (!name || folderSelectedRooms.size === 0) return;
    if (editingFolderId) {
      const updated = chatFolders.map(f => f.id === editingFolderId ? { ...f, name, roomIds: [...folderSelectedRooms] } : f);
      saveFolders(updated);
    } else {
      const newFolder = { id: Date.now().toString(), name, roomIds: [...folderSelectedRooms] };
      saveFolders([...chatFolders, newFolder]);
    }
    setShowFolderModal(false);
    setFolderName('');
    setFolderSelectedRooms(new Set());
    setEditingFolderId(null);
  };

  const deleteFolder = (e, folderId) => {
    e.stopPropagation();
    saveFolders(chatFolders.filter(f => f.id !== folderId));
    if (chatFilter === `folder_${folderId}`) setChatFilter('all');
  };

  const toggleFolderRoom = (roomId) => {
    setFolderSelectedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId); else next.add(roomId);
      return next;
    });
  };

  const handleFolderContextMenu = (e, folder) => {
    e.preventDefault();
    e.stopPropagation();
    setFolderContextMenu({ x: e.clientX, y: e.clientY, folder });
  };

  const moveFolderUp = (folderId) => {
    const idx = chatFolders.findIndex(f => f.id === folderId);
    if (idx <= 0) return;
    const arr = [...chatFolders];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    saveFolders(arr);
  };

  const moveFolderDown = (folderId) => {
    const idx = chatFolders.findIndex(f => f.id === folderId);
    if (idx < 0 || idx >= chatFolders.length - 1) return;
    const arr = [...chatFolders];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    saveFolders(arr);
  };

  const markAllReadInFolder = (folder) => {
    // No server-side API, just visual feedback
    setFolderContextMenu(null);
  };

  const getPrivateDisplayName = (room) => {
    const parts = room.name.split(' & ');
    return parts.find((p) => p !== username) || room.name;
  };

  const getDisplayName = (room) => {
    if (room.type === 'SAVED_MESSAGES') return 'Избранное';
    return room.type === 'PRIVATE' ? getPrivateDisplayName(room) : room.name;
  };

  const getLastMessage = (roomId) => {
    const msgs = messagesByRoom[roomId];
    if (!msgs || msgs.length === 0) return null;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].type === 'CHAT' || msgs[i].type === 'PRIVATE') return msgs[i];
    }
    return msgs[msgs.length - 1];
  };

  const getLastMessageTime = (roomId) => {
    const msg = getLastMessage(roomId);
    if (!msg?.timestamp) return 0;
    const d = new Date(msg.timestamp.includes?.('T') ? msg.timestamp : msg.timestamp.replace(' ', 'T'));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  // Unified sorted + filtered list
  const getSortedRooms = () => {
    let list = [...rooms];

    // Apply filter
    if (chatFilter === 'private') {
      list = list.filter(r => r.type === 'PRIVATE');
    } else if (chatFilter === 'groups') {
      list = list.filter(r => r.type === 'ROOM');
    } else if (chatFilter.startsWith('folder_')) {
      const folderId = chatFilter.replace('folder_', '');
      const folder = chatFolders.find(f => f.id === folderId);
      if (folder) {
        const roomSet = new Set(folder.roomIds);
        list = list.filter(r => roomSet.has(r.id));
      }
    }

    // Apply search
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(r => getDisplayName(r).toLowerCase().includes(q));
    }

    // Sort: pinned first (by last message time), then non-pinned by last message time
    list.sort((a, b) => {
      const aPinned = pinnedRooms.has(a.id);
      const bPinned = pinnedRooms.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return getLastMessageTime(b.id) - getLastMessageTime(a.id);
    });

    return list;
  };

  const renderChatItem = (room) => {
    const isSaved = room.type === 'SAVED_MESSAGES';
    const displayName = isSaved ? 'Избранное' : getDisplayName(room);
    const lastMsg = getLastMessage(room.id);
    const isOnline = room.type === 'PRIVATE' && onlineUsers.includes(displayName);
    const unread = unreadCounts[room.id] || 0;

    // Typing indicator for this room
    const roomTypingMap = typingUsers && typingUsers[room.id] ? typingUsers[room.id] : {};
    const roomTypers = Object.keys(roomTypingMap).filter(u => u !== username);

    let previewText = '';
    let previewCheck = null;
    if (roomTypers.length > 0) {
      previewText = roomTypers.length === 1
        ? `${roomTypers[0]} печатает...`
        : 'печатают...';
    } else if (lastMsg) {
      // Read receipt indicator for own messages
      if (lastMsg.sender === username) {
        const checkIcon = lastMsg.status === 'READ' ? '✓✓ ' : lastMsg.status === 'DELIVERED' ? '✓✓ ' : '✓ ';
        const checkClass = lastMsg.status === 'READ' ? 'sb-check read' : 'sb-check';
        previewCheck = <span className={checkClass}>{checkIcon}</span>;
      }
      const sender = lastMsg.sender === username ? 'Вы: ' : '';
      const text = lastMsg.content || (lastMsg.fileUrl ? '📎 Файл' : '');
      previewText = sender + text;
    }

    return (
      <div
        key={room.id}
        className={`sb-chat-item${activeRoomId === room.id ? ' active' : ''}${pinnedRooms.has(room.id) ? ' pinned' : ''}${unread > 0 ? ' has-unread' : ''}`}
        onClick={() => onSelectRoom(room.id)}
      >
        <div className="sb-chat-avatar-wrap">
          {isSaved ? (
            <div className="sb-chat-avatar sb-saved-avatar">
              <Bookmark size={20} />
            </div>
          ) : (
            <div className="sb-chat-avatar" style={{ background: avatarMap[displayName] ? 'transparent' : getAvatarColor(displayName) }}>
              {avatarMap[displayName]
                ? <img src={avatarMap[displayName]} alt="" className="sb-avatar-img" />
                : getInitials(displayName)}
            </div>
          )}
          {room.type === 'PRIVATE' && isOnline && (
            <span className="sb-online-dot online" />
          )}
        </div>
        <div className="sb-chat-info">
          <div className="sb-chat-top-row">
            <span className="sb-chat-name">{displayName}</span>
            <span className="sb-chat-time">
              {lastMsg ? formatTime(lastMsg.timestamp) : ''}
            </span>
          </div>
          <div className="sb-chat-bottom-row">
            <span className={`sb-chat-preview${roomTypers.length > 0 ? ' typing' : ''}`}>{previewCheck}{previewText}</span>
            {unread > 0 && <span className="sb-unread">{unread}</span>}
          </div>
        </div>
        <div className="sb-chat-actions">
          {!isSaved && (
            <span className={`sb-pin-btn${pinnedRooms.has(room.id) ? ' pinned' : ''}`} onClick={(e) => togglePin(e, room.id)} title={pinnedRooms.has(room.id) ? 'Открепить' : 'Закрепить'} role="button" aria-label="Закрепить чат">
              <Pin size={14} />
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`chat-sidebar${sidebarOpen ? ' open' : ''}`}>
      {/* ── Header (hidden in profile tab) ── */}
      {mobileTab !== 'profile' && mobileTab !== 'ai' && !showMobileSettings && (
      <div className="sb-header">
        <div className="sb-header-left">
          <button className="sb-close-btn" onClick={onCloseSidebar} aria-label="Закрыть меню"><ArrowLeft size={20} /></button>
          <div className="sb-mobile-title">
            {mobileTab === 'chats' && <><span className="sb-cat-emoji">🐱</span>BarsikChat</>}
            {mobileTab === 'contacts' && 'Контакты'}
            {mobileTab === 'settings' && 'Песочница'}
            {mobileTab === 'ai' && 'AI Помощник'}
            {mobileTab === 'profile' && 'Профиль'}
          </div>
          <button className="sb-burger-btn" data-testid="sb-burger-btn" onClick={() => setShowBurgerDrawer(true)} aria-label="Меню">
            <Menu size={22} />
          </button>
          <div className="sb-desktop-brand">
            <span className="sb-cat-emoji">🐱</span>
            <span className="sb-brand-name">BarsikChat</span>
          </div>
          <button className="sb-search-toggle" onClick={() => { setSearchExpanded(e => !e); setTimeout(() => searchInputRef.current?.focus(), 100); }} aria-label="Поиск"><Search size={18} /></button>
        </div>
        <div className="sb-header-right">
          <button className="sb-menu-btn" data-testid="sb-menu-btn" onClick={() => setShowMenu(!showMenu)} aria-label="Меню" title="Меню"><MoreVertical size={20} /></button>
          {showMenu && (
            <div className="sb-menu-dropdown" ref={menuRef}>
              <button onClick={() => { setShowMenu(false); if (setMobileTab) setMobileTab('profile'); else setShowProfile(true); }}><User size={16} /> Профиль</button>
              <button onClick={() => { setShowMenu(false); setShowSearch(!showSearch); }}><Mail size={16} /> Написать</button>
              <button onClick={() => { setShowMenu(false); setShowCreate(true); }}><Plus size={16} /> Создать группу</button>
              <button onClick={() => { setShowMenu(false); if (onOpenSaved) onOpenSaved(); }}><Bookmark size={16} /> Избранное</button>
              {installPrompt && (
                <button onClick={() => { setShowMenu(false); handleInstall(); }}><Download size={16} /> Установить приложение</button>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ══════════  TAB: CHATS  ══════════ */}
      {(mobileTab === 'chats' || showContacts) && (
        <>
          {/* Stories Bar — always visible between header and filters */}
          {storiesHook && (
            <div ref={storiesBarRef}>
            <StoriesBar
              groupedStories={storiesHook.groupedStories}
              username={username}
              avatarUrl={avatarUrl}
              avatarMap={avatarMap}
              onOpenViewer={(author) => onOpenStoryViewer?.(author)}
              onOpenUpload={() => onOpenStoryUpload?.()}
            />
            </div>
          )}

          {/* Filter tabs */}
          <div className="sb-filters" ref={filtersRef}>
            {[  
              { key: 'all', label: 'Все' },
              { key: 'private', label: 'Личные' },
              { key: 'groups', label: 'Группы' },
            ].map(f => {
              // Compute unread count for this filter
              let filterUnread = 0;
              if (f.key === 'all') {
                filterUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
              } else if (f.key === 'private') {
                rooms.filter(r => r.type === 'PRIVATE').forEach(r => { filterUnread += (unreadCounts[r.id] || 0); });
              } else if (f.key === 'groups') {
                rooms.filter(r => r.type === 'ROOM').forEach(r => { filterUnread += (unreadCounts[r.id] || 0); });
              }
              return (
                <button
                  key={f.key}
                  className={`sb-filter${chatFilter === f.key ? ' active' : ''}`}
                  onClick={() => setChatFilter(f.key)}
                >
                  {f.label}
                  {filterUnread > 0 && <span className="sb-filter-badge">{filterUnread > 99 ? '99+' : filterUnread}</span>}
                </button>
              );
            })}
            {chatFolders.map(folder => (
              <button
                key={folder.id}
                className={`sb-filter sb-folder-tab${chatFilter === `folder_${folder.id}` ? ' active' : ''}`}
                onClick={() => setChatFilter(`folder_${folder.id}`)}
                onContextMenu={(e) => handleFolderContextMenu(e, folder)}
              >
                {folder.name}
              </button>
            ))}
            <button className="sb-filter sb-add-folder-btn" onClick={openCreateFolder}>
              <Plus size={14} />
            </button>
          </div>

          {/* Folder context menu */}
          {folderContextMenu && (
            <div className="folder-ctx-overlay" onClick={() => setFolderContextMenu(null)}>
              <div
                className="folder-ctx-menu"
                ref={contextMenuRef}
                style={{ top: folderContextMenu.y, left: Math.min(folderContextMenu.x, window.innerWidth - 200) }}
                onClick={e => e.stopPropagation()}
              >
                <button onClick={() => { openEditFolder(null, folderContextMenu.folder); setFolderContextMenu(null); }}>
                  <Edit3 size={15} /> Редактировать
                </button>
                <button onClick={() => { moveFolderUp(folderContextMenu.folder.id); setFolderContextMenu(null); }}>
                  <ChevronUp size={15} /> Переместить выше
                </button>
                <button onClick={() => { moveFolderDown(folderContextMenu.folder.id); setFolderContextMenu(null); }}>
                  <ChevronDown size={15} /> Переместить ниже
                </button>
                <button onClick={() => { openCreateFolder(); setFolderContextMenu(null); }}>
                  <FolderPlus size={15} /> Добавить папку
                </button>
                <button onClick={() => { markAllReadInFolder(folderContextMenu.folder); }}>
                  <Check size={15} /> Прочитать все
                </button>
                <button className="folder-ctx-danger" onClick={(e) => { deleteFolder(e, folderContextMenu.folder.id); setFolderContextMenu(null); }}>
                  <Trash2 size={15} /> Удалить папку
                </button>
              </div>
            </div>
          )}

          {/* Search */}
          <div className={`sb-search ${searchExpanded ? 'expanded' : 'collapsed'}`}>
            <span className="sb-search-icon"><Search size={16} /></span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Поиск чатов и людей..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              onBlur={() => { if (!searchFilter) setSearchExpanded(false); }}
            />
            {searchFilter && <button className="sb-search-toggle" onClick={() => { setSearchFilter(''); setSearchExpanded(false); }}><X size={14} /></button>}
          </div>

          {/* User Search Modal */}
          {showSearch && (
            <UserSearch
              token={token}
              username={username}
              onStartChat={(user) => { onStartPrivateChat(user); setShowSearch(false); }}
              onClose={() => setShowSearch(false)}
            />
          )}

          {/* Chat List / Contacts (desktop toggle) */}
          {showContacts ? (
            <div className="sb-chat-list">
              <div className="sb-section-header">
                <span className="sb-section-label">КОНТАКТЫ</span>
                <button className="sb-section-add" onClick={() => setShowContacts(false)} title="Закрыть"><X size={16} /></button>
              </div>
              <div className="sb-empty"><span><Search size={32} /></span><p>Используйте поиск выше для поиска людей</p></div>
            </div>
          ) : (
            <div
              className="sb-chat-list"
              ref={chatListRef}
              onTouchStart={handlePullStart}
              onTouchMove={handlePullMove}
              onTouchEnd={handlePullEnd}
            >
              {getSortedRooms().map((room) => renderChatItem(room))}
              {/* People search results in chats tab */}
              {searchFilter.trim() && contactSearchResults.length > 0 && (
                <>
                  <div className="contacts-sort-label"><Users size={14} /> Люди</div>
                  {contactSearchResults.map(user => (
                    <div key={'psr-' + user.username} className="sb-contact-item" onClick={() => onStartPrivateChat(user.username)}>
                      <div className="sb-chat-avatar-wrap">
                        <div className="sb-chat-avatar" style={{ background: (avatarMap[user.username] || user.avatarUrl) ? 'transparent' : getAvatarColor(user.username) }}>
                          {(avatarMap[user.username] || user.avatarUrl)
                            ? <img src={avatarMap[user.username] || user.avatarUrl} alt="" className="sb-avatar-img" />
                            : getInitials(user.username)}
                        </div>
                        <span className={`sb-online-dot ${user.online ? 'online' : 'offline'}`} />
                      </div>
                      <div className="sb-contact-info">
                        <span className="sb-contact-name">{user.username}</span>
                        {user.tag && <span className="sb-contact-tag">{user.tag}</span>}
                        <span className={`sb-contact-status ${user.online ? 'online' : 'offline'}`}>
                          {user.online ? 'В сети' : (user.lastSeen ? formatLastSeen(user.lastSeen) : 'Не в сети')}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {rooms.length === 0 && !searchFilter.trim() && (
                <div className="sb-empty"><span><MessageSquare size={32} /></span><p>Нет чатов</p></div>
              )}
              {rooms.length > 0 && getSortedRooms().length === 0 && chatFilter === 'unread' && (
                <div className="sb-empty"><span><CheckCircle size={32} /></span><p>Все прочитано</p></div>
              )}
              {rooms.length > 0 && getSortedRooms().length === 0 && chatFilter !== 'unread' && searchFilter && contactSearchResults.length === 0 && (
                <div className="sb-empty"><span><Search size={32} /></span><p>Не найдено</p></div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══════════  TAB: CONTACTS (mobile)  ══════════ */}
      {mobileTab === 'contacts' && contactsSubView === 'calls' && (
        <RecentCalls
          token={token}
          username={username}
          onBack={() => setContactsSubView('list')}
          onStartCall={onStartCall}
          avatarMap={avatarMap}
        />
      )}
      {mobileTab === 'contacts' && contactsSubView === 'list' && !showContacts && (
        <>
          <div className="sb-search">
            <span className="sb-search-icon"><Search size={16} /></span>
            <input
              type="text"
              placeholder="Поиск по имени или тегу..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
          <div className="sb-chat-list">
            {/* Action buttons */}
            <div className="contacts-action-item" onClick={() => {
              const link = `${window.location.origin}`;
              copyToClipboard(link).then(() => { setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000); });
            }}>
              <div className="contacts-action-icon" style={{ background: '#3b82f6' }}><svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>
              <span className="contacts-action-label">{inviteCopied ? 'Ссылка скопирована!' : 'Пригласить друзей'}</span>
            </div>
            <div className="contacts-action-item" onClick={() => setContactsSubView('calls')}>
              <div className="contacts-action-icon" style={{ background: '#4ecca3' }}><Phone size={20} color="white" /></div>
              <span className="contacts-action-label">Недавние звонки</span>
            </div>

            {/* My Contacts section (shown when no search or when contacts match) */}
            {(() => {
              const myContactNames = new Set(myContacts.map(c => c.contact || c.username || c));
              const myContactUsers = allUsers
                .filter(u => myContactNames.has(u.username) && u.username !== username)
                .filter(u => {
                  if (!searchFilter.trim()) return true;
                  const q = searchFilter.toLowerCase();
                  return u.username.toLowerCase().includes(q) || (u.tag && u.tag.toLowerCase().includes(q));
                });
              if (myContactUsers.length > 0) {
                const mcOnline = myContactUsers.filter(u => u.online);
                const mcOffline = myContactUsers.filter(u => !u.online);
                return (
                  <>
                    <div className="contacts-sort-label"><Star size={14} /> Мои контакты — {myContactUsers.length}</div>
                    {mcOnline.map(user => (
                      <div key={'mc-' + user.username} className="sb-contact-item" onClick={() => onStartPrivateChat(user.username)}>
                        <div className="sb-chat-avatar-wrap">
                          <div className="sb-chat-avatar" style={{ background: (avatarMap[user.username] || user.avatarUrl) ? 'transparent' : getAvatarColor(user.username) }}>
                            {(avatarMap[user.username] || user.avatarUrl)
                              ? <img src={avatarMap[user.username] || user.avatarUrl} alt="" className="sb-avatar-img" />
                              : getInitials(user.username)}
                          </div>
                          <span className="sb-online-dot online" />
                        </div>
                        <div className="sb-contact-info">
                          <span className="sb-contact-name">{user.username}</span>
                          {user.tag && <span className="sb-contact-tag">{user.tag}</span>}
                          <span className="sb-contact-status online">В сети</span>
                        </div>
                      </div>
                    ))}
                    {mcOffline.map(user => (
                      <div key={'mc-' + user.username} className="sb-contact-item" onClick={() => onStartPrivateChat(user.username)}>
                        <div className="sb-chat-avatar-wrap">
                          <div className="sb-chat-avatar" style={{ background: (avatarMap[user.username] || user.avatarUrl) ? 'transparent' : getAvatarColor(user.username) }}>
                            {(avatarMap[user.username] || user.avatarUrl)
                              ? <img src={avatarMap[user.username] || user.avatarUrl} alt="" className="sb-avatar-img" />
                              : getInitials(user.username)}
                          </div>
                          <span className="sb-online-dot offline" />
                        </div>
                        <div className="sb-contact-info">
                          <span className="sb-contact-name">{user.username}</span>
                          {user.tag && <span className="sb-contact-tag">{user.tag}</span>}
                          <span className="sb-contact-status offline">{user.lastSeen ? formatLastSeen(user.lastSeen) : 'Не в сети'}</span>
                        </div>
                      </div>
                    ))}
                  </>
                );
              }
              return null;
            })()}

            {/* Search results — shown only when user types a search query */}
            {searchFilter.trim() && (
              <>
                <div className="contacts-sort-label"><Search size={14} /> Результаты поиска</div>
                {searchingContacts && (
                  <div className="sb-empty"><span className="spinner" /><p>Поиск...</p></div>
                )}
                {!searchingContacts && contactSearchResults.length > 0 && (
                  <>
                    {contactSearchResults.map(user => (
                      <div key={'sr-' + user.username} className="sb-contact-item" onClick={() => onStartPrivateChat(user.username)}>
                        <div className="sb-chat-avatar-wrap">
                          <div className="sb-chat-avatar" style={{ background: (avatarMap[user.username] || user.avatarUrl) ? 'transparent' : getAvatarColor(user.username) }}>
                            {(avatarMap[user.username] || user.avatarUrl)
                              ? <img src={avatarMap[user.username] || user.avatarUrl} alt="" className="sb-avatar-img" />
                              : getInitials(user.username)}
                          </div>
                          <span className={`sb-online-dot ${user.online ? 'online' : 'offline'}`} />
                        </div>
                        <div className="sb-contact-info">
                          <span className="sb-contact-name">{user.username}</span>
                          {user.tag && <span className="sb-contact-tag">{user.tag}</span>}
                          <span className={`sb-contact-status ${user.online ? 'online' : 'offline'}`}>
                            {user.online ? 'В сети' : (user.lastSeen ? formatLastSeen(user.lastSeen) : 'Не в сети')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {!searchingContacts && contactSearchResults.length === 0 && (
                  <div className="sb-empty"><span><Users size={32} /></span><p>Не найдено</p></div>
                )}
              </>
            )}
            {!searchFilter.trim() && myContacts.length === 0 && (
              <div className="sb-empty"><span><Search size={32} /></span><p>Найдите людей по имени или тегу</p></div>
            )}
          </div>
        </>
      )}

      {/* ══════════  TAB: SETTINGS (mobile)  ══════════ */}
      {mobileTab === 'settings' && (
        <div className="sb-settings-panel">
          <div className="sb-settings-list">
            <button className="sb-settings-item" onClick={onShowNews}>
              <span className="sb-settings-icon"><Newspaper size={18} /></span>
              <span className="sb-settings-label">Новости</span>
              <span className="sb-settings-arrow">›</span>
            </button>
            <button className="sb-settings-item" onClick={onShowTasks}>
              <span className="sb-settings-icon"><ClipboardList size={18} /></span>
              <span className="sb-settings-label">Задачи</span>
              <span className="sb-settings-arrow">›</span>
            </button>
            <button className="sb-settings-item" onClick={() => { setShowSearch(!showSearch); }}>
              <span className="sb-settings-icon"><Mail size={18} /></span>
              <span className="sb-settings-label">Написать сообщение</span>
              <span className="sb-settings-arrow">›</span>
            </button>
            <button className="sb-settings-item" onClick={() => setShowCreate(true)}>
              <span className="sb-settings-icon"><Plus size={18} /></span>
              <span className="sb-settings-label">Создать группу</span>
              <span className="sb-settings-arrow">›</span>
            </button>
            <button className="sb-settings-item" onClick={() => setShowJoin(true)}>
              <span className="sb-settings-icon"><Link size={18} /></span>
              <span className="sb-settings-label">Войти по ссылке</span>
              <span className="sb-settings-arrow">›</span>
            </button>
            {installPrompt && (
              <button className="sb-settings-item" onClick={handleInstall}>
                <span className="sb-settings-icon"><Download size={18} /></span>
                <span className="sb-settings-label">Установить приложение</span>
                <span className="sb-settings-arrow">›</span>
              </button>
            )}
          </div>

          {/* User Search Modal */}
          {showSearch && (
            <UserSearch
              token={token}
              username={username}
              onStartChat={(user) => { onStartPrivateChat(user); setShowSearch(false); }}
              onClose={() => setShowSearch(false)}
            />
          )}
        </div>
      )}

      {/* ══════════  TAB: AI (mobile)  ══════════ */}
      {mobileTab === 'ai' && (
        <AiChatPage />
      )}

      {/* ══════════  TAB: PROFILE (mobile)  ══════════ */}
      {mobileTab === 'profile' && profileSubView === 'edit' && (
        <EditProfilePage
          token={token}
          username={username}
          onBack={() => setProfileSubView('main')}
          onProfileUpdate={() => {}}
        />
      )}
      {showMobileSettings && (
        <div className="sb-settings-panel sb-settings-panel-overlay">
          <div className="edit-profile-header">
            <button className="edit-profile-back" onClick={() => setShowMobileSettings(false)}><ArrowLeft size={20} /></button>
            <h2 className="edit-profile-title">Настройки</h2>
            <div style={{ width: 40 }} />
          </div>
          <div className="sb-settings-list">
            {/* ── Звук ── */}
            <div className="settings-section-title"><Volume2 size={16} /> Звук</div>
            <div className="sb-settings-item sb-settings-toggle-row">
              <span className="sb-settings-label">Звук уведомлений</span>
              <button
                className={`settings-toggle ${notifSoundOn ? 'on' : ''}`}
                onClick={() => { const v = !notifSoundOn; setNotifSoundOn(v); appSettings.notifSound = v; }}
                aria-label="Звук уведомлений"
              >
                <span className="settings-toggle-thumb" />
              </button>
            </div>
            <div className="sb-settings-item sb-settings-toggle-row">
              <span className="sb-settings-label">Звук звонка</span>
              <button
                className={`settings-toggle ${callSoundOn ? 'on' : ''}`}
                onClick={() => { const v = !callSoundOn; setCallSoundOn(v); appSettings.callSound = v; }}
                aria-label="Звук звонка"
              >
                <span className="settings-toggle-thumb" />
              </button>
            </div>

            {/* ── Уведомления ── */}
            <div className="settings-section-title"><Bell size={16} /> Уведомления</div>
            <div className="sb-settings-item sb-settings-toggle-row">
              <span className="sb-settings-label">Push-уведомления</span>
              <button
                className={`settings-toggle ${pushOn ? 'on' : ''}`}
                onClick={async () => {
                  const v = !pushOn;
                  setPushOn(v);
                  appSettings.pushEnabled = v;
                  // Request notification permission when enabling
                  if (v && 'Notification' in window && Notification.permission === 'default') {
                    const perm = await Notification.requestPermission();
                    appSettings.savePermission('notification', perm);
                  }
                }}
                aria-label="Push-уведомления"
              >
                <span className="settings-toggle-thumb" />
              </button>
            </div>

            {/* ── Другое ── */}
            <div className="settings-section-title" style={{ marginTop: 8 }}><Settings size={16} /> Другое</div>
            {installPrompt && (
              <button className="sb-settings-item" onClick={handleInstall}>
                <span className="sb-settings-icon"><Download size={18} /></span>
                <span className="sb-settings-label">Установить приложение</span>
                <span className="sb-settings-arrow">›</span>
              </button>
            )}
            <button className="sb-settings-item" onClick={() => {
              if ('caches' in window) {
                caches.keys().then(names => names.forEach(n => caches.delete(n)));
              }
              localStorage.removeItem('barsik_media_permissions_granted');
              window.location.reload();
            }}>
              <span className="sb-settings-icon"><RefreshCw size={18} /></span>
              <span className="sb-settings-label">Очистить кэш</span>
              <span className="sb-settings-arrow">›</span>
            </button>
            <div className="sb-settings-item" style={{ cursor: 'default' }}>
              <span className="sb-settings-icon"><Info size={18} /></span>
              <span className="sb-settings-label">Версия: 1.0.0</span>
            </div>
            <div className="sb-settings-item" style={{ cursor: 'default' }}>
              <span className="sb-settings-icon"><Smartphone size={18} /></span>
              <span className="sb-settings-label" style={{ fontSize: '0.78rem', color: '#5a6a80' }}>
                {navigator.userAgent.includes('BarsikChat') ? 'Android APK' : 'Браузер'}
              </span>
            </div>

            {/* ── Папки с чатами ── */}
            <div className="settings-section-title" style={{ marginTop: 8 }}><Folder size={16} /> Папки с чатами</div>
            {chatFolders.length === 0 && (
              <div className="sb-settings-item" style={{ color: '#5a6a80', cursor: 'default' }}>
                <span className="sb-settings-label">Нет папок</span>
              </div>
            )}
            {chatFolders.map(folder => (
              <div key={folder.id} className="sb-settings-item sb-settings-folder-row">
                {settingsFolderView === folder.id ? (
                  <div className="settings-folder-edit" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      className="settings-folder-name-input"
                      value={folderName}
                      onChange={e => setFolderName(e.target.value)}
                      maxLength={24}
                      autoFocus
                    />
                    <div className="settings-folder-chats">
                      {rooms.filter(r => r.type !== 'SAVED_MESSAGES').map(room => {
                        const dn = getDisplayName(room);
                        const sel = folderSelectedRooms.has(room.id);
                        return (
                          <div key={room.id} className={`settings-folder-chat-item${sel ? ' selected' : ''}`} onClick={() => toggleFolderRoom(room.id)}>
                            <span className="settings-folder-chat-name">{dn}</span>
                            {sel && <Check size={14} className="folder-modal-check" />}
                          </div>
                        );
                      })}
                    </div>
                    <div className="settings-folder-actions">
                      <button className="settings-folder-save" onClick={() => {
                        const name = folderName.trim();
                        if (name && folderSelectedRooms.size > 0) {
                          saveFolders(chatFolders.map(f => f.id === folder.id ? { ...f, name, roomIds: [...folderSelectedRooms] } : f));
                        }
                        setSettingsFolderView(null);
                      }}>Сохранить</button>
                      <button className="settings-folder-cancel" onClick={() => setSettingsFolderView(null)}>Отмена</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="sb-settings-icon"><Folder size={18} /></span>
                    <span className="sb-settings-label">{folder.name} <span style={{ color: '#5a6a80', fontSize: '0.78rem' }}>({folder.roomIds.length})</span></span>
                    <button className="settings-folder-edit-btn" onClick={() => {
                      setFolderName(folder.name);
                      setFolderSelectedRooms(new Set(folder.roomIds));
                      setSettingsFolderView(folder.id);
                    }} title="Редактировать"><Edit3 size={15} /></button>
                    <button className="settings-folder-del-btn" onClick={(e) => deleteFolder(e, folder.id)} title="Удалить"><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            ))}
            <button className="sb-settings-item" onClick={openCreateFolder}>
              <span className="sb-settings-icon"><FolderPlus size={18} /></span>
              <span className="sb-settings-label">Создать папку</span>
              <span className="sb-settings-arrow">›</span>
            </button>
          </div>
        </div>
      )}
      {mobileTab === 'profile' && profileSubView === 'main' && (
        <MyProfilePage
          username={username}
          avatarUrl={avatarUrl}
          token={token}
          wsRef={wsRef}
          onAvatarChange={onAvatarChange}
          connected={connected}
          onOpenEdit={() => setProfileSubView('edit')}
          onOpenSettings={() => setShowMobileSettings(true)}
          onLogout={onLogout}
          onBack={() => setMobileTab('chats')}
        />
      )}

      {showCreate && <CreateRoom onCreateRoom={onCreateRoom} onClose={(room) => { setShowCreate(false); if (room?.id) onSelectRoom(room.id); }} allUsers={allUsers} username={username} avatarMap={avatarMap} wsRef={wsRef} token={token} />}
      {showJoin && <JoinRoom onJoinRoom={onJoinRoom} onClose={() => setShowJoin(false)} />}

      {showProfile && (
        <ProfileModal
          username={username}
          avatarUrl={avatarUrl}
          token={token}
          wsRef={wsRef}
          onAvatarChange={onAvatarChange}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* Folder creation/edit modal */}
      {showFolderModal && (
        <div className="folder-modal-overlay" onClick={() => setShowFolderModal(false)}>
          <div className="folder-modal" onClick={e => e.stopPropagation()}>
            <div className="folder-modal-header">
              <h3>{editingFolderId ? 'Редактировать папку' : 'Создать папку'}</h3>
              <button className="folder-modal-close" onClick={() => setShowFolderModal(false)}><X size={20} /></button>
            </div>
            <div className="folder-modal-name">
              <input
                type="text"
                placeholder="Название папки..."
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
                autoFocus
                maxLength={24}
              />
            </div>
            <div className="folder-modal-label">Выберите чаты:</div>
            <div className="folder-modal-list">
              {rooms.filter(r => r.type !== 'SAVED_MESSAGES').map(room => {
                const displayName = getDisplayName(room);
                const selected = folderSelectedRooms.has(room.id);
                return (
                  <div key={room.id} className={`folder-modal-item${selected ? ' selected' : ''}`} onClick={() => toggleFolderRoom(room.id)}>
                    <div className="folder-modal-item-avatar" style={{ background: avatarMap[displayName] ? 'transparent' : getAvatarColor(displayName) }}>
                      {avatarMap[displayName]
                        ? <img src={avatarMap[displayName]} alt="" className="sb-avatar-img" />
                        : getInitials(displayName)}
                    </div>
                    <span className="folder-modal-item-name">{displayName}</span>
                    <span className="folder-modal-item-type">{room.type === 'PRIVATE' ? 'Личный' : 'Группа'}</span>
                    {selected && <Check size={16} className="folder-modal-check" />}
                  </div>
                );
              })}
            </div>
            <div className="folder-modal-footer">
              <span className="folder-modal-count">Выбрано: {folderSelectedRooms.size}</span>
              <button className="folder-modal-save" onClick={handleSaveFolder} disabled={!folderName.trim() || folderSelectedRooms.size === 0}>
                {editingFolderId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════  BURGER DRAWER  ══════════ */}
      {showBurgerDrawer && (
        <div className="burger-overlay" onClick={() => setShowBurgerDrawer(false)}>
          <div className="burger-drawer" data-testid="burger-drawer" ref={burgerRef} onClick={e => e.stopPropagation()}>
            {/* User profile row */}
            <button className="burger-menu-item burger-user-row" onClick={() => { setShowBurgerDrawer(false); setShowProfile(true); }}>
              <div className="burger-user-avatar" style={{ background: avatarUrl ? 'transparent' : getAvatarColor(username) }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="" className="sb-avatar-img" />
                  : getInitials(username)}
              </div>
              <span>{username}</span>
            </button>

            {/* Other saved accounts */}
            {savedAccounts.filter(a => a.username !== username).map(acc => (
              <button key={acc.username} className="burger-menu-item burger-user-row burger-alt-account" onClick={() => { setShowBurgerDrawer(false); if (onSwitchAccount) onSwitchAccount(acc); }}>
                <div className="burger-user-avatar" style={{ background: (avatarMap[acc.username] || acc.avatarUrl) ? 'transparent' : getAvatarColor(acc.username) }}>
                  {(avatarMap[acc.username] || acc.avatarUrl)
                    ? <img src={avatarMap[acc.username] || acc.avatarUrl} alt="" className="sb-avatar-img" />
                    : getInitials(acc.username)}
                </div>
                <span>{acc.username}</span>
                {acc.tag && <span className="sb-contact-tag">{acc.tag}</span>}
              </button>
            ))}

            {/* Add account */}
            <button className="burger-menu-item" onClick={() => { setShowBurgerDrawer(false); if (onAddAccount) onAddAccount(); }}>
              <UserPlus size={20} />
              <span>Добавить аккаунт</span>
            </button>

            <div className="burger-menu-divider" />

            {/* Menu items */}
            <div className="burger-menu-list">
              <button className="burger-menu-item" onClick={() => { setShowBurgerDrawer(false); if (onOpenSaved) onOpenSaved(); }}>
                <Bookmark size={20} />
                <span>Сохранённые сообщения</span>
              </button>
              <button className="burger-menu-item" onClick={() => { setShowBurgerDrawer(false); if (onOpenStoryUpload) onOpenStoryUpload(); }}>
                <Clock size={20} />
                <span>Мои истории</span>
              </button>
              <button className="burger-menu-item" onClick={() => { setShowBurgerDrawer(false); setShowContacts(true); }}>
                <Users size={20} />
                <span>Контакты</span>
              </button>

              <div className="burger-menu-divider" />

              <button className="burger-menu-item" onClick={() => { setShowBurgerDrawer(false); setShowMobileSettings(true); }}>
                <Settings size={20} />
                <span>Настройки</span>
              </button>
              {installPrompt && (
                <button className="burger-menu-item" onClick={() => { setShowBurgerDrawer(false); handleInstall(); }}>
                  <Download size={20} />
                  <span>Установить приложение</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
