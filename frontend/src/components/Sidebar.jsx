import { useState, useRef, useEffect } from 'react';
import UserSearch from './UserSearch';
import CreateRoom from './CreateRoom';
import JoinRoom from './JoinRoom';
import ProfileModal from './ProfileModal';
import { copyToClipboard } from '../utils/clipboard';

const AVATAR_COLORS = [
  '#e94560', '#4ecca3', '#f0a500', '#a855f7',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
];
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name) { return name.charAt(0).toUpperCase(); }

function formatLastSeen(ts) {
  if (!ts) return 'Не в сети';
  const d = new Date(ts.includes?.('T') ? ts : ts.replace(' ', 'T'));
  if (isNaN(d.getTime())) return 'Не в сети';
  const now = new Date();
  const diff = now - d;
  const oneDay = 86400000;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (diff < 60000) return 'был(а) только что';
  if (diff < 3600000) return `был(а) ${Math.floor(diff / 60000)} мин. назад`;
  if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
    return `был(а) в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear()) {
    return `был(а) вчера в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diff < 7 * oneDay) {
    const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    return `был(а) ${days[d.getDay()]}`;
  }
  return `был(а) ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
}

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
  const menuRef = useRef(null);

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
    const displayName = getDisplayName(room);
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
          <div className="sb-chat-avatar" style={{ background: avatarMap[displayName] ? 'transparent' : getAvatarColor(displayName) }}>
            {avatarMap[displayName]
              ? <img src={avatarMap[displayName]} alt="" className="sb-avatar-img" />
              : getInitials(displayName)}
          </div>
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
          <span className="sb-share-btn" onClick={(e) => copyShareLink(e, room.id)} title="Поделиться" role="button" aria-label="Поделиться ссылкой">
            {shareCopied === room.id ? '✅' : '📤'}
          </span>
          <span className="sb-delete-btn" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: room.id, name: displayName }); }} title="Удалить" role="button" aria-label="Удалить чат">
            🗑
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className={`chat-sidebar${sidebarOpen ? ' open' : ''}`}>
      {sidebarOpen && <div className="sidebar-overlay" onClick={onCloseSidebar} />}

      {/* ── Header: Avatar + Name + Status + Quick actions ── */}
      <div className="sb-header">
        <div className="sb-header-left">
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
        <div className="sb-header-right">
          <button className="sb-icon-btn" onClick={() => setShowContacts(!showContacts)} title="Контакты" aria-label="Контакты">👥</button>
          <button className="sb-icon-btn" onClick={onShowNews} title="Новости" aria-label="Новости">📰</button>
          <button className="sb-icon-btn" onClick={onShowTasks} title="Задачи" aria-label="Задачи">📋</button>
          <button className="sb-menu-btn" onClick={() => setShowMenu(!showMenu)} aria-label="Меню" title="Меню">⋮</button>
          {showMenu && (
            <div className="sb-menu-dropdown" ref={menuRef}>
              <button onClick={() => { setShowMenu(false); setShowProfile(true); }}>👤 Профиль</button>
              <button onClick={() => { setShowMenu(false); setShowSearch(!showSearch); }}>✉️ Написать</button>
              <button onClick={() => { setShowMenu(false); setShowCreate(true); }}>➕ Создать группу</button>
              <button onClick={() => { setShowMenu(false); setShowJoin(true); }}>🔗 Войти по ссылке</button>
              <button onClick={() => { setShowMenu(false); onLogout(); }}>🚪 Выйти</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter Tabs (Telegram-like folders) ── */}
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

      {/* ── Search ── */}
      <div className="sb-search">
        <span className="sb-search-icon">🔍</span>
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

      {/* ── Chat List / Contacts ── */}
      {showContacts ? (
        <div className="sb-chat-list">
          <div className="sb-section-header">
            <span className="sb-section-label">КОНТАКТЫ ({allUsers.filter(u => u.username !== username).length})</span>
            <button className="sb-section-add" onClick={() => setShowContacts(false)} title="Закрыть">✕</button>
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
                    <span>👥</span>
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
          <div className="sb-empty">
            <span>💬</span>
            <p>Нет чатов</p>
          </div>
        )}

        {rooms.length > 0 && getSortedRooms().length === 0 && chatFilter === 'unread' && (
          <div className="sb-empty">
            <span>✅</span>
            <p>Все прочитано</p>
          </div>
        )}

        {rooms.length > 0 && getSortedRooms().length === 0 && chatFilter !== 'unread' && searchFilter && (
          <div className="sb-empty">
            <span>🔍</span>
            <p>Не найдено</p>
          </div>
        )}
      </div>
      )}

      {showCreate && <CreateRoom onCreateRoom={onCreateRoom} onClose={() => setShowCreate(false)} />}
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
            <div className="delete-modal-icon">🗑</div>
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
