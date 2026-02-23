import { useState, useRef, useEffect } from 'react';
import UserSearch from './UserSearch';
import CreateRoom from './CreateRoom';
import JoinRoom from './JoinRoom';
import ProfileModal from './ProfileModal';
import MyProfilePage from './MyProfilePage';
import EditProfilePage from './EditProfilePage';
import RecentCalls from './RecentCalls';
import AiChatPage from './AiChatPage';
import { copyToClipboard } from '../utils/clipboard';
import appSettings from '../utils/appSettings';
import { getAvatarColor, getInitials, formatLastSeen } from '../utils/avatar';
import { ArrowLeft, MoreVertical, User, Mail, Plus, Bookmark, Download, X, Search, Users, MessageSquare, CheckCircle, Share2, Trash2, Phone, Star, Newspaper, ClipboardList, Link, Volume2, Bell, Settings, LogOut } from 'lucide-react';

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
  onStartPrivateChat,
  onCreateRoom,
  onJoinRoom,
  onDeleteRoom,
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
  onOpenSaved,
  onStartCall,
  myContacts = [],
  onRefreshContacts,
}) {
  const [chatFilter, setChatFilter] = useState('all');
  const [showSearch, setShowSearch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [shareCopied, setShareCopied] = useState(null);
  const [showContacts, setShowContacts] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileSubView, setProfileSubView] = useState('main');
  const [contactsSubView, setContactsSubView] = useState('list'); // 'list' | 'calls'
  const [inviteCopied, setInviteCopied] = useState(false); // 'main' | 'edit' | 'settings'
  const [installPrompt, setInstallPrompt] = useState(null);
  const [notifSoundOn, setNotifSoundOn] = useState(() => appSettings.notifSound);
  const [callSoundOn, setCallSoundOn] = useState(() => appSettings.callSound);
  const [pushOn, setPushOn] = useState(() => appSettings.pushEnabled);
  const menuRef = useRef(null);

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

  // Reset profile sub-view when switching tabs
  useEffect(() => {
    if (mobileTab !== 'profile') setProfileSubView('main');
    if (mobileTab !== 'contacts') setContactsSubView('list');
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

  const copyShareLink = (e, roomId) => {
    e.stopPropagation();
    const url = `${window.location.origin}?join=${roomId}`;
    copyToClipboard(url).then(() => {
      setShareCopied(roomId);
      setTimeout(() => setShareCopied(null), 1500);
    });
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
    } else if (chatFilter === 'unread') {
      list = list.filter(r => (unreadCounts[r.id] || 0) > 0);
    }

    // Apply search
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(r => getDisplayName(r).toLowerCase().includes(q));
    }

    // Sort by last message time (newest first), rooms without messages go last
    list.sort((a, b) => getLastMessageTime(b.id) - getLastMessageTime(a.id));

    return list;
  };

  const renderChatItem = (room) => {
    const isSaved = room.type === 'SAVED_MESSAGES';
    const displayName = isSaved ? 'Избранное' : getDisplayName(room);
    const lastMsg = getLastMessage(room.id);
    const isOnline = room.type === 'PRIVATE' && onlineUsers.includes(displayName);
    const unread = unreadCounts[room.id] || 0;

    let previewText = 'Нет сообщений';
    if (lastMsg) {
      const sender = lastMsg.sender === username ? 'Вы: ' : '';
      const text = lastMsg.content || (lastMsg.fileUrl ? '📎 Файл' : '');
      previewText = sender + (text.length > 35 ? text.slice(0, 35) + '…' : text);
    }

    return (
      <div
        key={room.id}
        className={`sb-chat-item${activeRoomId === room.id ? ' active' : ''}`}
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
          {room.type === 'PRIVATE' && (
            <span className={`sb-online-dot ${isOnline ? 'online' : 'offline'}`} />
          )}
        </div>
        <div className="sb-chat-info">
          <div className="sb-chat-top-row">
            <span className="sb-chat-name">{displayName}</span>
            <span className="sb-chat-time">{lastMsg ? formatTime(lastMsg.timestamp) : ''}</span>
          </div>
          <div className="sb-chat-bottom-row">
            <span className="sb-chat-preview">{previewText}</span>
            {unread > 0 && <span className="sb-unread">{unread}</span>}
          </div>
        </div>
        <div className="sb-chat-actions">
          {!isSaved && (
            <>
              <span className="sb-share-btn" onClick={(e) => copyShareLink(e, room.id)} title="Поделиться" role="button" aria-label="Поделиться ссылкой">
                {shareCopied === room.id ? <CheckCircle size={14} /> : <Share2 size={14} />}
              </span>
              <span className="sb-delete-btn" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: room.id, name: displayName }); }} title="Удалить" role="button" aria-label="Удалить чат">
                <Trash2 size={14} />
              </span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`chat-sidebar${sidebarOpen ? ' open' : ''}`}>
      {/* ── Header (hidden in profile tab) ── */}
      {mobileTab !== 'profile' && mobileTab !== 'ai' && (
      <div className="sb-header">
        <div className="sb-header-left">
          <button className="sb-close-btn" onClick={onCloseSidebar} aria-label="Закрыть меню"><ArrowLeft size={20} /></button>
          <div className="sb-mobile-title">
            {mobileTab === 'chats' && 'BarsikChat'}
            {mobileTab === 'contacts' && 'Контакты'}
            {mobileTab === 'settings' && 'Песочница'}
            {mobileTab === 'ai' && 'AI Помощник'}
            {mobileTab === 'profile' && 'Профиль'}
          </div>
          <div className="sb-desktop-header-user">
            <div className="sb-user-avatar" style={{ background: avatarUrl ? 'transparent' : getAvatarColor(username) }} onClick={() => setShowProfile(true)} title="Открыть профиль">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="sb-avatar-img" />
                : getInitials(username)}
            </div>
            <div className="sb-user-meta">
              <span className="sb-user-name">{username}</span>
              <span className={`sb-user-status ${connected ? 'online' : ''}`}>
                {connected ? '● В сети' : '● Офлайн'}
              </span>
            </div>
          </div>
        </div>
        <div className="sb-header-right">
          <button className="sb-menu-btn" onClick={() => setShowMenu(!showMenu)} aria-label="Меню" title="Меню"><MoreVertical size={20} /></button>
          {showMenu && (
            <div className="sb-menu-dropdown" ref={menuRef}>
              <button className="sb-desktop-only" onClick={() => { setShowMenu(false); setShowProfile(true); }}><User size={16} /> Профиль</button>
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
          {/* Filter tabs */}
          <div className="sb-filters">
            {[
              { key: 'all', label: 'Все' },
              { key: 'private', label: 'Личные' },
              { key: 'groups', label: 'Группы' },
              { key: 'unread', label: 'Непрочитанные' },
            ].map(f => (
              <button
                key={f.key}
                className={`sb-filter${chatFilter === f.key ? ' active' : ''}`}
                onClick={() => setChatFilter(f.key)}
              >
                {f.label}
                {f.key === 'unread' && (() => {
                  const total = Object.values(unreadCounts).reduce((s, v) => s + v, 0);
                  return total > 0 ? <span className="sb-filter-badge">{total}</span> : null;
                })()}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="sb-search">
            <span className="sb-search-icon"><Search size={16} /></span>
            <input
              type="text"
              placeholder="Поиск чатов..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
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
                <span className="sb-section-label">КОНТАКТЫ ({allUsers.filter(u => u.username !== username).length})</span>
                <button className="sb-section-add" onClick={() => setShowContacts(false)} title="Закрыть"><X size={16} /></button>
              </div>
              {(() => {
                const contacts = allUsers
                  .filter(u => u.username !== username)
                  .filter(u => {
                    if (!searchFilter.trim()) return true;
                    return u.username.toLowerCase().includes(searchFilter.toLowerCase());
                  });
                const online = contacts.filter(u => u.online);
                const offline = contacts.filter(u => !u.online);
                return (
                  <>
                    {online.length > 0 && (
                      <div className="sb-section-header">
                        <span className="sb-section-label">В СЕТИ — {online.length}</span>
                      </div>
                    )}
                    {online.map(user => (
                      <div
                        key={user.username}
                        className="sb-contact-item"
                        onClick={() => { onStartPrivateChat(user.username); setShowContacts(false); }}
                      >
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
                          <span className="sb-contact-status online">В сети</span>
                        </div>
                      </div>
                    ))}
                    {offline.length > 0 && (
                      <div className="sb-section-header">
                        <span className="sb-section-label">НЕ В СЕТИ — {offline.length}</span>
                      </div>
                    )}
                    {offline.map(user => (
                      <div
                        key={user.username}
                        className="sb-contact-item"
                        onClick={() => { onStartPrivateChat(user.username); setShowContacts(false); }}
                      >
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
                          <span className="sb-contact-status offline">{user.lastSeen ? formatLastSeen(user.lastSeen) : 'Не в сети'}</span>
                        </div>
                      </div>
                    ))}
                    {contacts.length === 0 && (
                      <div className="sb-empty">
                        <span><Users size={32} /></span>
                        <p>{searchFilter ? 'Не найдено' : 'Нет пользователей'}</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="sb-chat-list">
              {getSortedRooms().map((room) => renderChatItem(room))}
              {rooms.length === 0 && (
                <div className="sb-empty"><span><MessageSquare size={32} /></span><p>Нет чатов</p></div>
              )}
              {rooms.length > 0 && getSortedRooms().length === 0 && chatFilter === 'unread' && (
                <div className="sb-empty"><span><CheckCircle size={32} /></span><p>Все прочитано</p></div>
              )}
              {rooms.length > 0 && getSortedRooms().length === 0 && chatFilter !== 'unread' && searchFilter && (
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
              placeholder="Поиск контактов..."
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

            {/* My Contacts section */}
            {(() => {
              const myContactNames = new Set(myContacts.map(c => c.contact || c.username || c));
              const myContactUsers = allUsers
                .filter(u => myContactNames.has(u.username) && u.username !== username)
                .filter(u => {
                  if (!searchFilter.trim()) return true;
                  return u.username.toLowerCase().includes(searchFilter.toLowerCase());
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
                          <span className="sb-contact-status offline">{user.lastSeen ? formatLastSeen(user.lastSeen) : 'Не в сети'}</span>
                        </div>
                      </div>
                    ))}
                  </>
                );
              }
              return null;
            })()}

            {/* All Users section */}
            <div className="contacts-sort-label">Все пользователи</div>
            {(() => {
              const contacts = allUsers
                .filter(u => u.username !== username)
                .filter(u => {
                  if (!searchFilter.trim()) return true;
                  return u.username.toLowerCase().includes(searchFilter.toLowerCase());
                });
              const online = contacts.filter(u => u.online);
              const offline = contacts.filter(u => !u.online);
              return (
                <>
                  {online.length > 0 && (
                    <div className="sb-section-header">
                      <span className="sb-section-label">В СЕТИ — {online.length}</span>
                    </div>
                  )}
                  {online.map(user => (
                    <div key={user.username} className="sb-contact-item" onClick={() => onStartPrivateChat(user.username)}>
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
                        <span className="sb-contact-status online">В сети</span>
                      </div>
                    </div>
                  ))}
                  {offline.length > 0 && (
                    <div className="sb-section-header">
                      <span className="sb-section-label">НЕ В СЕТИ — {offline.length}</span>
                    </div>
                  )}
                  {offline.map(user => (
                    <div key={user.username} className="sb-contact-item" onClick={() => onStartPrivateChat(user.username)}>
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
                        <span className="sb-contact-status offline">{user.lastSeen ? formatLastSeen(user.lastSeen) : 'Не в сети'}</span>
                      </div>
                    </div>
                  ))}
                  {contacts.length === 0 && (
                    <div className="sb-empty"><span><Users size={32} /></span><p>{searchFilter ? 'Не найдено' : 'Нет пользователей'}</p></div>
                  )}
                </>
              );
            })()}
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
      {mobileTab === 'profile' && profileSubView === 'settings' && (
        <div className="sb-settings-panel">
          <div className="edit-profile-header">
            <button className="edit-profile-back" onClick={() => setProfileSubView('main')}><ArrowLeft size={20} /></button>
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
          onOpenSettings={() => setProfileSubView('settings')}
          onLogout={onLogout}
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

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="delete-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon"><Trash2 size={32} /></div>
            <h3>Удалить «{deleteConfirm.name}»?</h3>
            <p className="delete-modal-preview">Чат и вся история будут удалены</p>
            <div className="delete-modal-actions">
              <button className="delete-modal-cancel" onClick={() => setDeleteConfirm(null)}>
                Отмена
              </button>
              <button className="delete-modal-confirm" onClick={() => { onDeleteRoom(deleteConfirm.id); setDeleteConfirm(null); }}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
