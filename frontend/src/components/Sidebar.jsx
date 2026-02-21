import { useState } from 'react';
import UserSearch from './UserSearch';
import CreateRoom from './CreateRoom';
import JoinRoom from './JoinRoom';

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
  sidebarOpen,
  onCloseSidebar,
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [shareCopied, setShareCopied] = useState(null);

  const copyShareLink = (e, roomId) => {
    e.stopPropagation();
    const url = `${window.location.origin}?join=${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
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

  return (
    <div className={`chat-sidebar${sidebarOpen ? ' open' : ''}`}>
      {/* Mobile overlay close */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={onCloseSidebar} />}

      <div className="sidebar-header">
        <h2>🐱 BarsikChat</h2>
        <span className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? '● В сети' : '● Офлайн'}
        </span>
      </div>

      <div className="user-info">
        <div className="user-info-left">
          <div className="avatar-circle small" style={{ background: getAvatarColor(username) }}>
            {getInitials(username)}
          </div>
          <strong>{username}</strong>
        </div>
        <button onClick={onLogout} className="logout-btn">Выйти</button>
      </div>

      <div className="sidebar-actions">
        <div className="sidebar-actions-row">
          <button className="action-btn" onClick={() => setShowSearch(!showSearch)} title="Найти пользователя">🔍 Поиск</button>
          <button className="action-btn" onClick={() => setShowCreate(true)} title="Создать комнату">➕ Создать</button>
          <button className="action-btn" onClick={() => setShowJoin(true)} title="Войти по ссылке">🔗 Войти</button>
        </div>
        <div className="sidebar-actions-row">
          <button className="action-btn" onClick={onShowNews} title="Новости">📰 Новости</button>
          <button className="action-btn" onClick={onShowTasks} title="Задачи">📋 Задачи</button>
        </div>
      </div>

      {showSearch && (
        <UserSearch
          token={token}
          username={username}
          onStartChat={(user) => { onStartPrivateChat(user); setShowSearch(false); }}
          onClose={() => setShowSearch(false)}
        />
      )}

      <div className="room-list">
        {generalRooms.map((room) => (
          <div
            key={room.id}
            className={`room-item ${activeRoomId === room.id ? 'active' : ''}`}
            onClick={() => onSelectRoom(room.id)}
          >
            <span className="room-icon">🌐</span>
            <span className="room-name">{room.name}</span>
            {unreadCounts[room.id] > 0 && <span className="unread-badge">{unreadCounts[room.id]}</span>}
          </div>
        ))}

        {privateRooms.length > 0 && <div className="room-section">Личные чаты</div>}
        {privateRooms.map((room) => {
          const otherUser = getPrivateDisplayName(room);
          const isOnline = onlineUsers.includes(otherUser);
          return (
            <div
              key={room.id}
              className={`room-item ${activeRoomId === room.id ? 'active' : ''}`}
              onClick={() => onSelectRoom(room.id)}
            >
              <span className="room-icon">👤</span>
              <span className={`pm-online-dot ${isOnline ? 'online' : 'offline'}`}>●</span>
              <span className="room-name">{otherUser}</span>
              {unreadCounts[room.id] > 0 && <span className="unread-badge">{unreadCounts[room.id]}</span>}
              <span className="room-share" onClick={(e) => copyShareLink(e, room.id)} title="Поделиться чатом">
                {shareCopied === room.id ? '✅' : '📤'}
              </span>
              {room.createdBy === username && (
                <span className="room-delete" onClick={(e) => { e.stopPropagation(); if (confirm('Удалить этот чат?')) onDeleteRoom(room.id); }}>🗑</span>
              )}
            </div>
          );
        })}

        {customRooms.length > 0 && <div className="room-section">Комнаты</div>}
        {customRooms.map((room) => (
          <div
            key={room.id}
            className={`room-item ${activeRoomId === room.id ? 'active' : ''}`}
            onClick={() => onSelectRoom(room.id)}
          >
            <span className="room-icon">🏠</span>
            <span className="room-name">{room.name}</span>
            {unreadCounts[room.id] > 0 && <span className="unread-badge">{unreadCounts[room.id]}</span>}
            <span className="room-share" onClick={(e) => copyShareLink(e, room.id)} title="Поделиться комнатой">
              {shareCopied === room.id ? '✅' : '📤'}
            </span>
            {room.createdBy === username && (
              <span className="room-delete" onClick={(e) => { e.stopPropagation(); if (confirm('Удалить комнату "' + room.name + '"?')) onDeleteRoom(room.id); }}>🗑</span>
            )}
          </div>
        ))}
      </div>

      <div className="online-users">
        <h3>В сети ({onlineUsers.length})</h3>
        <ul>
          {onlineUsers.map((user, i) => (
            <li key={i} onClick={() => { if (user !== username) onStartPrivateChat(user); }}>
              <div className="avatar-circle tiny" style={{ background: getAvatarColor(user) }}>
                {getInitials(user)}
              </div>
              <span className="online-user-name">{user}{user === username ? ' (вы)' : ''}</span>
              <span className="user-dot">●</span>
            </li>
          ))}
        </ul>
      </div>

      {showCreate && <CreateRoom onCreateRoom={onCreateRoom} onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinRoom onJoinRoom={onJoinRoom} onClose={() => setShowJoin(false)} />}
    </div>
  );
}
