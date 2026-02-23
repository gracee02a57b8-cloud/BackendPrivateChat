import { useState } from 'react';

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

export default function AddMembersPanel({ allUsers = [], username, avatarMap = {}, activeRoom, wsRef, onClose }) {
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);

  const existingMembers = activeRoom?.members || [];
  const otherUsers = allUsers.filter(u => u.username !== username && !existingMembers.includes(u.username));
  const filtered = otherUsers.filter(u =>
    !search.trim() || u.username.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (uname) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uname)) next.delete(uname);
      else next.add(uname);
      return next;
    });
  };

  const handleSend = () => {
    if (selected.size === 0 || !wsRef?.current || !activeRoom) return;
    setSending(true);
    for (const target of selected) {
      const invite = {
        type: 'GROUP_INVITE',
        extra: {
          target,
          roomId: activeRoom.id,
          roomName: activeRoom.name || 'Группа',
        },
      };
      wsRef.current.send(JSON.stringify(invite));
    }
    setSending(false);
    onClose();
  };

  return (
    <div className="create-group-overlay">
      <div className="create-group-page">
        <div className="edit-profile-header">
          <button className="edit-profile-back" onClick={onClose}>←</button>
          <div style={{ flex: 1 }}>
            <h2 className="edit-profile-title" style={{ margin: 0 }}>Добавить участников</h2>
          </div>
          <div style={{ width: 40 }} />
        </div>

        <div className="create-group-step">
          {selected.size > 0 && (
            <div className="create-group-chips">
              {[...selected].map(u => (
                <div key={u} className="create-group-chip" onClick={() => toggleUser(u)}>
                  <span>{u}</span>
                  <span className="chip-remove">✕</span>
                </div>
              ))}
            </div>
          )}

          <div className="sb-search" style={{ margin: '0 0 4px 0' }}>
            <span className="sb-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Поиск пользователей..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="create-group-user-list">
            {filtered.map(user => {
              const av = avatarMap[user.username] || user.avatarUrl;
              const isSelected = selected.has(user.username);
              return (
                <div
                  key={user.username}
                  className={`create-group-user-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleUser(user.username)}
                >
                  <div className="sb-chat-avatar-wrap">
                    <div className="sb-chat-avatar" style={{ background: av ? 'transparent' : getAvatarColor(user.username) }}>
                      {av ? <img src={av} alt="" className="sb-avatar-img" /> : getInitials(user.username)}
                    </div>
                    {user.online && <span className="sb-online-dot online" />}
                  </div>
                  <div className="sb-contact-info">
                    <span className="sb-contact-name">{user.username}</span>
                    <span className={`sb-contact-status ${user.online ? 'online' : 'offline'}`}>
                      {user.online ? 'В сети' : 'Не в сети'}
                    </span>
                  </div>
                  <div className={`create-group-check ${isSelected ? 'checked' : ''}`}>
                    {isSelected ? '✓' : ''}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="sb-empty"><span>👥</span><p>Нет пользователей для приглашения</p></div>
            )}
          </div>

          {selected.size > 0 && (
            <button
              className="create-group-fab"
              onClick={handleSend}
              disabled={sending}
              title="Отправить приглашения"
            >
              {sending ? '⏳' : '✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
