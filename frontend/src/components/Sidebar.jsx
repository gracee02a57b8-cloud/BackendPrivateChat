import { useState } from 'react';
import UserSearch from './UserSearch';
import CreateRoom from './CreateRoom';
import JoinRoom from './JoinRoom';

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
  token,
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const generalRooms = rooms.filter((r) => r.type === 'GENERAL');
  const privateRooms = rooms.filter((r) => r.type === 'PRIVATE');
  const customRooms = rooms.filter((r) => r.type === 'ROOM');

  const getPrivateDisplayName = (room) => {
    const parts = room.name.split(' & ');
    return parts.find((p) => p !== username) || room.name;
  };

  return (
    <div className="chat-sidebar">
      <div className="sidebar-header">
        <h2>💬 BarsikChat</h2>
        <span className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? '● В сети' : '● Офлайн'}
        </span>
      </div>

      <div className="user-info">
        <span>Вы: <strong>{username}</strong></span>
        <button onClick={onLogout} className="logout-btn">Выйти</button>
      </div>

      <div className="sidebar-actions">
        <button className="action-btn" onClick={() => setShowSearch(!showSearch)} title="Найти пользователя">🔍</button>
        <button className="action-btn" onClick={() => setShowCreate(true)} title="Создать комнату">➕</button>
        <button className="action-btn" onClick={() => setShowJoin(true)} title="Войти по ссылке">🔗</button>
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
          </div>
        ))}

        {privateRooms.length > 0 && <div className="room-section">Личные чаты</div>}
        {privateRooms.map((room) => (
          <div
            key={room.id}
            className={`room-item ${activeRoomId === room.id ? 'active' : ''}`}
            onClick={() => onSelectRoom(room.id)}
          >
            <span className="room-icon">👤</span>
            <span className="room-name">{getPrivateDisplayName(room)}</span>
          </div>
        ))}

        {customRooms.length > 0 && <div className="room-section">Комнаты</div>}
        {customRooms.map((room) => (
          <div
            key={room.id}
            className={`room-item ${activeRoomId === room.id ? 'active' : ''}`}
            onClick={() => onSelectRoom(room.id)}
          >
            <span className="room-icon">🏠</span>
            <span className="room-name">{room.name}</span>
          </div>
        ))}
      </div>

      <div className="online-users">
        <h3>В сети ({onlineUsers.length})</h3>
        <ul>
          {onlineUsers.map((user, i) => (
            <li key={i} onClick={() => { if (user !== username) onStartPrivateChat(user); }}>
              <span className="user-dot">●</span> {user}
              {user === username ? ' (вы)' : ''}
            </li>
          ))}
        </ul>
      </div>

      {showCreate && <CreateRoom onCreateRoom={onCreateRoom} onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinRoom onJoinRoom={onJoinRoom} onClose={() => setShowJoin(false)} />}
    </div>
  );
}
