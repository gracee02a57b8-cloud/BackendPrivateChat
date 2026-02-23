import { useState, useEffect } from 'react';

export default function EditProfilePage({ token, username, onBack, onProfileUpdate }) {
  const [profile, setProfile] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setPhone(data.phone || '');
        setBio(data.bio || '');
        setBirthday(data.birthday || '');
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName, lastName, phone, bio, birthday }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setSuccess('Профиль сохранён');
        if (onProfileUpdate) onProfileUpdate(data);
        setTimeout(() => setSuccess(''), 2000);
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

  return (
    <div className="edit-profile-page">
      {/* Header */}
      <div className="edit-profile-header">
        <button className="edit-profile-back" onClick={onBack}>←</button>
        <h2 className="edit-profile-title">Аккаунт</h2>
        <button className="edit-profile-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? '...' : '✓'}
        </button>
      </div>

      {/* Info section */}
      <div className="edit-profile-section">
        <div className="edit-profile-section-title">Информация о Вас</div>
        <div className="edit-profile-info-card">
          <div className="edit-profile-info-row">
            <span className="edit-profile-info-icon">📞</span>
            <div className="edit-profile-info-content">
              <div className="edit-profile-info-value">{phone || 'Не указан'}</div>
              <div className="edit-profile-info-sublabel">Нажмите, чтобы изменить номер телефона</div>
            </div>
          </div>
          <div className="edit-profile-info-row">
            <span className="edit-profile-info-icon">@</span>
            <div className="edit-profile-info-content">
              <div className="edit-profile-info-value">@{username}</div>
              <div className="edit-profile-info-sublabel">Имя пользователя</div>
            </div>
          </div>
          <div className="edit-profile-info-row">
            <span className="edit-profile-info-icon">🎂</span>
            <div className="edit-profile-info-content">
              <div className="edit-profile-info-value">{birthday || 'Не указан'}</div>
              <div className="edit-profile-info-sublabel">День рождения</div>
            </div>
          </div>
        </div>
        <div className="edit-profile-hint">
          Ваш день рождения могут видеть только контакты.
        </div>
      </div>

      {/* Name section */}
      <div className="edit-profile-section">
        <div className="edit-profile-section-title">Ваше имя</div>
        <div className="edit-profile-fields-card">
          <div className="edit-profile-field">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Имя"
              maxLength={50}
            />
          </div>
          <div className="edit-profile-field-divider" />
          <div className="edit-profile-field">
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Фамилия"
              maxLength={50}
            />
          </div>
        </div>
      </div>

      {/* Bio section */}
      <div className="edit-profile-section">
        <div className="edit-profile-section-title">О себе</div>
        <div className="edit-profile-fields-card">
          <div className="edit-profile-field edit-profile-field-bio">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Расскажите о себе..."
              maxLength={500}
              rows={3}
            />
            <span className="edit-profile-char-count">{bio.length}/500</span>
          </div>
        </div>
        <div className="edit-profile-hint">
          Вы можете добавить несколько строк о себе.
        </div>
      </div>

      {/* Phone edit section */}
      <div className="edit-profile-section">
        <div className="edit-profile-section-title">Телефон</div>
        <div className="edit-profile-fields-card">
          <div className="edit-profile-field">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 (___) ___-__-__"
              maxLength={30}
            />
          </div>
        </div>
      </div>

      {/* Birthday edit section */}
      <div className="edit-profile-section">
        <div className="edit-profile-section-title">День рождения</div>
        <div className="edit-profile-fields-card">
          <div className="edit-profile-field">
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <div className="edit-profile-error">{error}</div>}
      {success && <div className="edit-profile-success">{success}</div>}
    </div>
  );
}
