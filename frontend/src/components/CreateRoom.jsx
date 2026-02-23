import { useState, useRef } from 'react';

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

export default function CreateRoom({ onCreateRoom, onClose, allUsers = [], username, avatarMap = {}, wsRef, token }) {
  const [step, setStep] = useState(1); // 1 = select users, 2 = group details
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef(null);

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

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 5 * 1024 * 1024) return;
    if (!file.type.startsWith('image/')) return;
    setGroupPhoto(file);
    setGroupPhotoPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const room = await onCreateRoom(name.trim(), description.trim(), groupPhoto);
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
      onClose(room);
    } catch (err) {
      console.error('Create group failed:', err);
      setCreating(false);
    }
  };

  return (
    <div className="create-group-overlay">
      <div className="create-group-page">
        {/* Step 1: Select members */}
        {step === 1 && (
          <>
            <div className="edit-profile-header">
              <button className="edit-profile-back" onClick={onClose}>←</button>
              <div style={{ flex: 1 }}>
                <h2 className="edit-profile-title" style={{ margin: 0 }}>Создать группу</h2>
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
                  placeholder="Кого бы вы хотели пригласить?"
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

              {/* Next FAB */}
              <button
                className="create-group-fab"
                onClick={() => setStep(2)}
                title="Далее"
              >
                →
              </button>
            </div>
          </>
        )}

        {/* Step 2: Group details */}
        {step === 2 && (
          <>
            <div className="edit-profile-header">
              <button className="edit-profile-back" onClick={() => setStep(1)}>←</button>
              <h2 className="edit-profile-title" style={{ margin: 0 }}>Создать группу</h2>
              <div style={{ width: 40 }} />
            </div>

            <div className="create-group-step create-group-details">
              <div className="create-group-photo-row">
                <div className="create-group-photo" onClick={() => fileInputRef.current?.click()}>
                  {groupPhotoPreview ? (
                    <img src={groupPhotoPreview} alt="" className="create-group-photo-img" />
                  ) : (
                    <span className="create-group-photo-placeholder">📷</span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoSelect}
                />
                <input
                  className="create-group-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Название группы"
                  autoFocus
                />
              </div>

              <textarea
                className="create-group-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Описание (необязательно)"
                rows={3}
              />

              {selected.size > 0 && (
                <div className="create-group-members-preview">
                  <div className="create-group-members-label">{selected.size} участник(ов)</div>
                  {[...selected].map(u => {
                    const av = avatarMap[u];
                    return (
                      <div key={u} className="create-group-member-row">
                        <div className="sb-chat-avatar" style={{ width: 36, height: 36, fontSize: '0.85rem', background: av ? 'transparent' : getAvatarColor(u) }}>
                          {av ? <img src={av} alt="" className="sb-avatar-img" /> : getInitials(u)}
                        </div>
                        <span className="create-group-member-name">{u}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Create FAB */}
              <button
                className="create-group-fab"
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                title="Создать"
              >
                {creating ? '⏳' : '✓'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
