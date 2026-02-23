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

export default function CreateRoom({ onCreateRoom, onClose, allUsers = [], username, avatarMap = {}, wsRef }) {
  const [step, setStep] = useState(1); // 1 = name, 2 = select users
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const otherUsers = allUsers.filter(u => u.username !== username);
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

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const room = await onCreateRoom(name.trim());
      if (room && wsRef?.current && selected.size > 0) {
        for (const target of selected) {
          const invite = {
            type: 'GROUP_INVITE',
            extra: {
              target,
              roomId: room.id,
              roomName: room.name || name.trim(),
            },
          };
          wsRef.current.send(JSON.stringify(invite));
        }
      }
      onClose();
    } catch (err) {
      console.error('Create group failed:', err);
      setCreating(false);
    }
  };

  return (
    <div className="create-group-overlay">
      <div className="create-group-page">
        <div className="edit-profile-header">
          <button className="edit-profile-back" onClick={step === 2 ? () => setStep(1) : onClose}>←</button>
          <h2 className="edit-profile-title">
            {step === 1 ? 'Новая группа' : 'Добавить участников'}
          </h2>
          <div style={{ width: 40 }} />
        </div>

        {step === 1 && (
          <div className="create-group-step">
            <div className="create-group-name-section">
              <div className="create-group-icon">👥</div>
              <input
                className="create-group-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название группы..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(2)}
              />
            </div>
            <button
              className="create-group-next-btn"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
            >
              Далее →
            </button>
          </div>
        )}

        {step === 2 && (
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
                <div className="sb-empty"><span>👥</span><p>Нет пользователей</p></div>
              )}
            </div>

            <button
              className="create-group-create-btn"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? '⏳ Создание...' : `Создать группу${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
