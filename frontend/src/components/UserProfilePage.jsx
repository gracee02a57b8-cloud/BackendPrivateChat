import { useState, useEffect, useRef } from 'react';

const AVATAR_COLORS = [
  '#e94560', '#4ecca3', '#f0a500', '#a855f7',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
];
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatLastSeen(ts) {
  if (!ts) return 'не в сети';
  const d = new Date(ts.includes?.('T') ? ts : ts.replace(' ', 'T'));
  if (isNaN(d.getTime())) return 'не в сети';
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'был(а) только что';
  if (diff < 3600000) return `был(а) ${Math.floor(diff / 60000)} мин. назад`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === now.toDateString()) {
    return `был(а) в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return `был(а) вчера в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `был(а) ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
}

export default function UserProfilePage({ targetUsername, token, onBack, onStartChat, onStartCall, onlineUsers = [], avatarMap = {} }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isContact, setIsContact] = useState(false);
  const [iBlocked, setIBlocked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [muteNotif, setMuteNotif] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!targetUsername) return;
    fetchProfile();
  }, [targetUsername]);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/${targetUsername}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setIsContact(!!data.isContact);
        setIBlocked(!!data.iBlockedByMe);
      }
    } catch (err) {
      console.error('Failed to fetch user profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleContact = async () => {
    setActionLoading(true);
    try {
      if (isContact) {
        await fetch(`/api/contacts/${targetUsername}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsContact(false);
      } else {
        await fetch(`/api/contacts/${targetUsername}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsContact(true);
      }
    } catch (err) {
      console.error('Contact toggle failed', err);
    } finally {
      setActionLoading(false);
      setShowMenu(false);
    }
  };

  const handleToggleBlock = async () => {
    setActionLoading(true);
    try {
      if (iBlocked) {
        await fetch(`/api/blocks/${targetUsername}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        setIBlocked(false);
      } else {
        await fetch(`/api/blocks/${targetUsername}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        setIBlocked(true);
      }
    } catch (err) {
      console.error('Block toggle failed', err);
    } finally {
      setActionLoading(false);
      setShowMenu(false);
    }
  };

  const isOnline = onlineUsers.includes(targetUsername);
  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') || targetUsername
    : targetUsername;
  const avatarUrl = avatarMap[targetUsername] || profile?.avatarUrl;
  const profileColor = profile?.profileColor || getAvatarColor(targetUsername);

  if (loading) {
    return (
      <div className="user-profile-page">
        <div className="user-profile-header-bar">
          <button className="user-profile-back" onClick={onBack}>←</button>
          <div style={{ flex: 1 }} />
        </div>
        <div className="user-profile-loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="user-profile-page">
      {/* Top bar */}
      <div className="user-profile-header-bar">
        <button className="user-profile-back" onClick={onBack}>←</button>
        <div style={{ flex: 1 }} />
        <div className="user-profile-menu-wrap" ref={menuRef}>
          <button className="user-profile-dots" onClick={() => setShowMenu(!showMenu)}>⋮</button>
          {showMenu && (
            <div className="user-profile-dropdown">
              <button onClick={handleToggleContact} disabled={actionLoading}>
                <span className="upd-icon">{isContact ? '➖' : '➕'}</span>
                {isContact ? 'Удалить контакт' : 'Добавить контакт'}
              </button>
              <button onClick={handleToggleBlock} disabled={actionLoading}>
                <span className="upd-icon">🚫</span>
                {iBlocked ? 'Разблокировать' : 'Заблокировать'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Avatar */}
      <div className="user-profile-avatar-section">
        <div className="user-profile-avatar" style={{ background: avatarUrl ? 'transparent' : profileColor }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="user-profile-avatar-img" />
            : <span className="user-profile-avatar-letter">{(targetUsername || '?').charAt(0).toUpperCase()}</span>}
        </div>
        <div className="user-profile-display-name">{displayName}</div>
        <div className={`user-profile-status ${isOnline ? 'online' : ''}`}>
          {isOnline ? '● в сети' : formatLastSeen(profile?.lastSeen)}
        </div>
      </div>

      {/* Action buttons row */}
      <div className="user-profile-actions">
        <button className="user-profile-action-btn" onClick={() => { if (onStartChat) onStartChat(targetUsername); onBack(); }}>
          <span className="user-profile-action-icon">💬</span>
          <span className="user-profile-action-label">Чат</span>
        </button>
        <button className="user-profile-action-btn" onClick={() => setMuteNotif(!muteNotif)}>
          <span className="user-profile-action-icon">{muteNotif ? '🔕' : '🔔'}</span>
          <span className="user-profile-action-label">{muteNotif ? 'Откл.' : 'Звук'}</span>
        </button>
        <button className="user-profile-action-btn" onClick={() => { if (onStartCall) onStartCall(targetUsername, 'audio'); }}>
          <span className="user-profile-action-icon">📞</span>
          <span className="user-profile-action-label">Звонок</span>
        </button>
      </div>

      {/* Block banner */}
      {iBlocked && (
        <div className="user-profile-block-banner">
          🚫 Пользователь заблокирован
          <button onClick={handleToggleBlock} disabled={actionLoading}>Разблокировать</button>
        </div>
      )}

      {/* Info section */}
      <div className="user-profile-info">
        {profile?.bio && (
          <div className="user-profile-info-row">
            <div className="user-profile-info-value">{profile.bio}</div>
            <div className="user-profile-info-label">О себе</div>
          </div>
        )}
        <div className="user-profile-info-row">
          <div className="user-profile-info-value">@{targetUsername}</div>
          <div className="user-profile-info-label">Имя пользователя</div>
        </div>
        {profile?.phone && (
          <div className="user-profile-info-row">
            <div className="user-profile-info-value">{profile.phone}</div>
            <div className="user-profile-info-label">Телефон</div>
          </div>
        )}
      </div>

      {/* Add to contacts button */}
      <div className="user-profile-contact-btn-wrap">
        <button
          className={`user-profile-contact-btn ${isContact ? 'is-contact' : ''}`}
          onClick={handleToggleContact}
          disabled={actionLoading}
        >
          <span className="upd-icon">{isContact ? '✅' : '➕'}</span>
          {isContact ? 'В контактах' : 'Добавить в контакты'}
        </button>
      </div>

      {/* Shared media tabs placeholder */}
      <div className="user-profile-tabs">
        <button className="user-profile-tab active">Медиа</button>
        <button className="user-profile-tab">Файлы</button>
        <button className="user-profile-tab">Ссылки</button>
      </div>
      <div className="user-profile-tab-content">
        <div className="user-profile-empty-tab">
          <span>📂</span>
          <p>Пока ничего нет</p>
        </div>
      </div>
    </div>
  );
}
