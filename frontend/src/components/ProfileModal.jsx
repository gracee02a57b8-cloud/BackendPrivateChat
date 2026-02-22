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

export default function ProfileModal({ username, avatarUrl, token, wsRef, onAvatarChange, onClose }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(avatarUrl || '');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 5 * 1024 * 1024) {
      setError('Макс. размер аватара 5 МБ');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Только изображения');
      return;
    }

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
      const newUrl = data.avatarUrl;
      setPreview(newUrl);
      onAvatarChange(newUrl);
      localStorage.setItem('avatarUrl', newUrl);

      // Broadcast AVATAR_UPDATE via WebSocket
      if (wsRef?.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'AVATAR_UPDATE',
          content: newUrl,
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setError('');
    setUploading(true);

    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Ошибка удаления');
      }

      setPreview('');
      onAvatarChange('');
      localStorage.setItem('avatarUrl', '');

      // Broadcast AVATAR_UPDATE with empty content
      if (wsRef?.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'AVATAR_UPDATE',
          content: '',
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h3>Профиль</h3>
          <button className="profile-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="profile-modal-body">
          <div className="profile-avatar-section">
            <div className="profile-avatar-large" onClick={() => !uploading && fileInputRef.current?.click()}>
              {preview ? (
                <img src={preview} alt="avatar" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-placeholder" style={{ background: getAvatarColor(username) }}>
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="profile-avatar-overlay">
                {uploading ? '⏳' : '📷'}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              hidden
            />
          </div>

          <div className="profile-username">{username}</div>

          <div className="profile-actions">
            <button
              className="profile-btn upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              📷 {preview ? 'Изменить фото' : 'Загрузить фото'}
            </button>
            {preview && (
              <button
                className="profile-btn delete"
                onClick={handleDelete}
                disabled={uploading}
              >
                🗑 Удалить фото
              </button>
            )}
          </div>

          {error && <p className="profile-error">{error}</p>}

          <p className="profile-hint">
            JPG, PNG, GIF или WebP • до 5 МБ
          </p>
        </div>
      </div>
    </div>
  );
}
