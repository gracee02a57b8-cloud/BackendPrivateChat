import { useState } from 'react';
import { getAvatarColor, getInitials } from '../utils/avatar';
import { ArrowLeft, X, Search, Check, Users, Loader2 } from 'lucide-react';

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
          <button className="edit-profile-back" onClick={onClose}><ArrowLeft size={20} /></button>
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
                  <span className="chip-remove"><X size={12} /></span>
                </div>
              ))}
            </div>
          )}

          <div className="sb-search" style={{ margin: '0 0 4px 0' }}>
            <span className="sb-search-icon"><Search size={16} /></span>
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
                    {isSelected ? <Check size={16} /> : ''}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="sb-empty"><span><Users size={32} /></span><p>Нет пользователей для приглашения</p></div>
            )}
          </div>

          {selected.size > 0 && (
            <button
              className="create-group-fab"
              onClick={handleSend}
              disabled={sending}
              title="Отправить приглашения"
            >
              {sending ? <Loader2 size={24} className="spin" /> : <Check size={24} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
