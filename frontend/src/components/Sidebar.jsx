import { useState } from 'react';
import UserSearch from './UserSearch';
import CreateRoom from './CreateRoom';
import JoinRoom from './JoinRoom';
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
}) {
  const [activeTab, setActiveTab] = useState('chats');
  const [showSearch, setShowSearch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [shareCopied, setShareCopied] = useState(null);

  const copyShareLink = (e, roomId) => {
    e.stopPropagation();
    const url = `${window.location.origin}?join=${roomId}`;
    copyToClipboard(url).then(() => {
      setShareCopied(roomId);
      setTimeout(() => setShareCopied(null), 1500);
    });
  };

  const generalRooms = rooms.filter((r) => r.type === 'GENERAL');
  const privateRooms = rooms.filter((r) => r.type === 'PRIVATE');
  const customRooms = rooms.filter((r) => r.type === 'ROOM');

  const getPrivateDisplayName = (room) => {
    const parts = room.name.split(' & ');
    return parts.find((p) => p !== username) || room.name;
  };

  const getLastMessage = (roomId) => {
    const msgs = messagesByRoom[roomId];
    if (!msgs || msgs.length === 0) return null;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].type === 'CHAT' || msgs[i].type === 'PRIVATE') return msgs[i];
    }
    return msgs[msgs.length - 1];
  };

  const filterRooms = (list) => {
    if (!searchFilter.trim()) return list;
    const q = searchFilter.toLowerCase();
    return list.filter(r => {
      const name = r.type === 'PRIVATE' ? getPrivateDisplayName(r) : r.name;
      return name.toLowerCase().includes(q);
    });
  };

  const renderChatItem = (room, displayName) => {
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
          <div className="sb-chat-avatar" style={{ background: getAvatarColor(displayName) }}>
            {getInitials(displayName)}
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
          {(room.type === 'ROOM' || room.type === 'PRIVATE') && (
            <span className="sb-share-btn" onClick={(e) => copyShareLink(e, room.id)} title="Поделиться">
              {shareCopied === room.id ? '✅' : '📤'}
            </span>
          )}
          {room.createdBy === username && (
            <span className="sb-delete-btn" onClick={(e) => { e.stopPropagation(); if (confirm('Удалить "' + displayName + '"?')) onDeleteRoom(room.id); }} title="Удалить">
              🗑
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`chat-sidebar${sidebarOpen ? ' open' : ''}`}>
      {sidebarOpen && <div className="sidebar-overlay" onClick={onCloseSidebar} />}

      {/* ── Header: Avatar + Name + Status + Menu ── */}
      <div className="sb-header">
        <div className="sb-header-left">
          <div className="sb-user-avatar" style={{ background: getAvatarColor(username) }}>
            {getInitials(username)}
          </div>
          <div className="sb-user-meta">
            <span className="sb-user-name">{username}</span>
            <span className={`sb-user-status ${connected ? 'online' : ''}`}>
              {connected ? '● В сети' : '● Офлайн'}
            </span>
          </div>
        </div>
        <div className="sb-header-right">
          <button className="sb-menu-btn" onClick={() => setShowMenu(!showMenu)}>⋮</button>
          {showMenu && (
            <div className="sb-menu-dropdown">
              <button onClick={() => { setShowMenu(false); setShowCreate(true); }}>➕ Создать чат</button>
              <button onClick={() => { setShowMenu(false); setShowJoin(true); }}>🔗 Войти по ссылке</button>
              <button onClick={() => { setShowMenu(false); onLogout(); }}>🚪 Выйти</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="sb-tabs">
        <button
          className={`sb-tab${activeTab === 'chats' ? ' active' : ''}`}
          onClick={() => setActiveTab('chats')}
        >
          💬 Чаты
        </button>
        <button
          className={`sb-tab${activeTab === 'news' ? ' active' : ''}`}
          onClick={() => { setActiveTab('news'); onShowNews(); }}
        >
          📰 Новости
        </button>
        <button
          className={`sb-tab${activeTab === 'tasks' ? ' active' : ''}`}
          onClick={() => { setActiveTab('tasks'); onShowTasks(); }}
        >
          📋 Задачи
        </button>
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

      {/* ── Chat List ── */}
      <div className="sb-chat-list">
        {/* General rooms */}
        {filterRooms(generalRooms).map((room) => renderChatItem(room, room.name))}

        {/* Private chats section */}
        {filterRooms(privateRooms).length > 0 && (
          <div className="sb-section-header">
            <span className="sb-section-label">ЛИЧНЫЕ ЧАТЫ</span>
            <button className="sb-section-add" onClick={() => setShowSearch(!showSearch)} title="Начать чат">+</button>
          </div>
        )}
        {filterRooms(privateRooms).map((room) => renderChatItem(room, getPrivateDisplayName(room)))}

        {/* Custom rooms section */}
        {filterRooms(customRooms).length > 0 && (
          <div className="sb-section-header">
            <span className="sb-section-label">КОМНАТЫ</span>
            <button className="sb-section-add" onClick={() => setShowCreate(true)} title="Создать комнату">+</button>
          </div>
        )}
        {filterRooms(customRooms).map((room) => renderChatItem(room, room.name))}

        {rooms.length === 0 && (
          <div className="sb-empty">
            <span>💬</span>
            <p>Нет чатов</p>
          </div>
        )}
      </div>

      {showCreate && <CreateRoom onCreateRoom={onCreateRoom} onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinRoom onJoinRoom={onJoinRoom} onClose={() => setShowJoin(false)} />}
    </div>
  );
}
