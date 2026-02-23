import { useState, useRef, useEffect } from 'react';
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

export default function MyProfilePage({ username, avatarUrl, token, wsRef, onAvatarChange, connected, onOpenEdit, onOpenSettings, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

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

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
    }
  };

  const getDisplayName = () => {
    if (profile?.firstName || profile?.lastName) {
      return [profile.firstName, profile.lastName].filter(Boolean).join(' ');
    }
    return username;
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/@${username}`;
    copyToClipboard(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    setShowMenu(false);
  };

  const handleOpenNameModal = () => {
    setNewFirstName(profile?.firstName || '');
    setNewLastName(profile?.lastName || '');
    setShowMenu(false);
    setShowNameModal(true);
  };

  const handleSaveName = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName: newFirstName, lastName: newLastName }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setShowNameModal(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Ошибка сохранения');
      }
    } catch (err) {
      setError('Ошибка сети');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 5 * 1024 * 1024) { setError('Макс. размер аватара 5 МБ'); return; }
    if (!file.type.startsWith('image/')) { setError('Только изображения'); return; }

    setError('');
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Ошибка загрузки');
      }
      const data = await res.json();
      onAvatarChange(data.avatarUrl);
      localStorage.setItem('avatarUrl', data.avatarUrl);
      if (wsRef?.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'AVATAR_UPDATE', content: data.avatarUrl }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const formatBirthday = (bd) => {
    if (!bd) return '';
    // Expect format "YYYY-MM-DD" or "DD.MM.YYYY"
    const months = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
    let d;
    if (bd.includes('-')) {
      d = new Date(bd);
    } else if (bd.includes('.')) {
      const parts = bd.split('.');
      d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      return bd;
    }
    if (isNaN(d.getTime())) return bd;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} (${age} ${getAgeWord(age)})`;
  };

  const getAgeWord = (age) => {
    const lastTwo = age % 100;
    const lastOne = age % 10;
    if (lastTwo >= 11 && lastTwo <= 19) return 'лет';
    if (lastOne === 1) return 'год';
    if (lastOne >= 2 && lastOne <= 4) return 'года';
    return 'лет';
  };

  const profileColor = profile?.profileColor || getAvatarColor(username);

  return (
    <div className="my-profile-page">
      {/* Header with title and three-dot menu */}
      <div className="my-profile-header">
        <h2 className="my-profile-title">Профиль</h2>
        <div className="my-profile-menu-wrap" ref={menuRef}>
          <button className="my-profile-dots-btn" onClick={() => setShowMenu(!showMenu)} aria-label="Меню">⋮</button>
          {showMenu && (
            <div className="my-profile-dropdown">
              <button onClick={handleOpenNameModal}>
                <span className="my-profile-dropdown-icon">@</span>
                Изменить имя
              </button>
              <button onClick={handleCopyLink}>
                <span className="my-profile-dropdown-icon">🔗</span>
                {copied ? 'Скопировано!' : 'Копировать ссылку'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Avatar */}
      <div className="my-profile-avatar-section">
        <div className="my-profile-avatar" style={{ background: avatarUrl ? 'transparent' : profileColor }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="my-profile-avatar-img" />
            : <span className="my-profile-avatar-letter">{username.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="my-profile-display-name">{getDisplayName()}</div>
        <div className={`my-profile-online-status ${connected ? 'online' : ''}`}>
          {connected ? '● в сети' : '● не в сети'}
        </div>
      </div>

      {/* Action buttons */}
      <div className="my-profile-actions">
        <button className="my-profile-action-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <span className="my-profile-action-icon">📷</span>
          <span className="my-profile-action-label">Выбрать фото</span>
        </button>
        <button className="my-profile-action-btn" onClick={onOpenEdit}>
          <span className="my-profile-action-icon">✏️</span>
          <span className="my-profile-action-label">Изменить</span>
        </button>
        <button className="my-profile-action-btn" onClick={onOpenSettings}>
          <span className="my-profile-action-icon">⚙️</span>
          <span className="my-profile-action-label">Настройка</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          hidden
        />
      </div>

      {error && <div className="my-profile-error">{error}</div>}

      {/* Info section */}
      <div className="my-profile-info">
        {profile?.phone && (
          <div className="my-profile-info-row">
            <div className="my-profile-info-value">{profile.phone}</div>
            <div className="my-profile-info-label">Телефон</div>
          </div>
        )}
        {profile?.bio && (
          <div className="my-profile-info-row">
            <div className="my-profile-info-value">{profile.bio}</div>
            <div className="my-profile-info-label">О себе</div>
          </div>
        )}
        <div className="my-profile-info-row">
          <div className="my-profile-info-value">@{username}</div>
          <div className="my-profile-info-label">Имя пользователя</div>
        </div>
        {profile?.birthday && (
          <div className="my-profile-info-row">
            <div className="my-profile-info-value">{formatBirthday(profile.birthday)}</div>
            <div className="my-profile-info-label">День рождения</div>
          </div>
        )}
      </div>

      {/* Logout */}
      {onLogout && (
        <button className="my-profile-logout-btn" onClick={onLogout}>
          🚪 Выйти из аккаунта
        </button>
      )}

      {/* Change name modal */}
      {showNameModal && (
        <div className="my-profile-modal-overlay" onClick={() => setShowNameModal(false)}>
          <div className="my-profile-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Изменить имя</h3>
            <div className="my-profile-modal-fields">
              <div className="my-profile-field">
                <label>Имя</label>
                <input
                  type="text"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="Имя"
                  maxLength={50}
                />
              </div>
              <div className="my-profile-field">
                <label>Фамилия</label>
                <input
                  type="text"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="Фамилия"
                  maxLength={50}
                />
              </div>
            </div>
            {error && <div className="my-profile-error">{error}</div>}
            <div className="my-profile-modal-actions">
              <button className="my-profile-modal-cancel" onClick={() => setShowNameModal(false)}>Отмена</button>
              <button className="my-profile-modal-save" onClick={handleSaveName} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
