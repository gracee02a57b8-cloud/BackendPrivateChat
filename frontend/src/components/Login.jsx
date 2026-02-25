import { useState, useEffect } from 'react';

export default function Login({ onLogin, pendingConfId, savedAccounts = [], onSwitchAccount }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tag, setTag] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

  // Auto-fill from remembered credentials (pick last used or first available)
  useEffect(() => {
    const remembered = localStorage.getItem('barsik_remembered');
    if (remembered) {
      try {
        const credMap = JSON.parse(remembered);
        // Migration: if old format {username, password}, convert to new map format
        if (credMap.username && credMap.password) {
          const migrated = { [credMap.username]: credMap.password };
          localStorage.setItem('barsik_remembered', JSON.stringify(migrated));
          setUsername(credMap.username);
          setPassword(credMap.password);
          setRememberPassword(true);
          return;
        }
        // New format: { username1: password1, username2: password2 }
        const users = Object.keys(credMap);
        if (users.length > 0) {
          const lastUser = users[users.length - 1];
          setUsername(lastUser);
          setPassword(credMap[lastUser]);
          setRememberPassword(true);
        }
      } catch {}
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    if (isRegister && password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (isRegister && password.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }
    if (isRegister && !tag.trim()) {
      setError('Тег обязателен');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = { username: username.trim(), password };
      if (isRegister) {
        body.tag = tag.trim();
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let errMsg = 'Ошибка сервера';
        try { const d = await res.json(); errMsg = d.error || errMsg; } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();

      // Save or clear remembered credentials (per-account map)
      if (rememberPassword) {
        let credMap = {};
        try { credMap = JSON.parse(localStorage.getItem('barsik_remembered') || '{}'); } catch {}
        // Migration: if old format, reset
        if (credMap.username) credMap = {};
        credMap[data.username] = password;
        localStorage.setItem('barsik_remembered', JSON.stringify(credMap));
      } else {
        // Remove only this account from map
        try {
          const credMap = JSON.parse(localStorage.getItem('barsik_remembered') || '{}');
          if (credMap.username) { localStorage.removeItem('barsik_remembered'); }
          else { delete credMap[data.username]; localStorage.setItem('barsik_remembered', JSON.stringify(credMap)); }
        } catch { localStorage.removeItem('barsik_remembered'); }
      }

      onLogin(data.token, data.username, data.role, data.avatarUrl, data.tag);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" data-testid="login-container">
      <div className="login-particles">
        {[...Array(6)].map((_, i) => <div key={i} className="particle" />)}
      </div>
      <div className="login-card" data-testid="login-card">
        <div className="login-logo">🐱</div>
        <h1>BarsikChat</h1>
        {pendingConfId ? (
          <div className="login-conf-banner">
            <span>📞</span>
            <span>Вас пригласили в конференцию!<br/>Войдите или зарегистрируйтесь для подключения</span>
          </div>
        ) : (
          <p className="login-subtitle">
            {isRegister ? 'Создайте аккаунт' : 'Безопасный чат для команды'}
          </p>
        )}
        <form onSubmit={handleSubmit} data-testid="login-form">
          <div className="login-input-wrapper">
            <span className="login-input-icon">👤</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isRegister ? 'Имя пользователя...' : 'Имя или тег (@tag)...'}
              maxLength={20}
              autoFocus
            />
          </div>
          {isRegister && (
            <div className="login-input-wrapper">
              <span className="login-input-icon">🏷️</span>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Тег (@yourtag)..."
                maxLength={25}
              />
            </div>
          )}
          <div className="login-input-wrapper">
            <span className="login-input-icon">🔒</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль..."
              maxLength={100}
            />
          </div>
          {isRegister && (
            <div className="login-input-wrapper">
              <span className="login-input-icon">🔒</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Подтвердите пароль..."
                maxLength={100}
              />
            </div>
          )}
          <label className="login-remember">
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(e) => setRememberPassword(e.target.checked)}
            />
            <span>Запомнить пароль</span>
          </label>
          <button type="submit" data-testid="login-submit" disabled={loading || !username.trim() || !password}>
            {loading ? (
              <span className="btn-loading"><span className="spinner" /> {isRegister ? 'Регистрация...' : 'Вход...'}</span>
            ) : (isRegister ? 'Зарегистрироваться' : 'Войти в чат')}
          </button>
        </form>
        {error && <p className="error" data-testid="login-error">{error}</p>}

        {/* Saved accounts */}
        {savedAccounts.length > 0 && (
          <div className="login-accounts-section">
            <button className="login-accounts-toggle" onClick={() => setShowAccounts(!showAccounts)}>
              {showAccounts ? '▲' : '▼'} Сохранённые аккаунты ({savedAccounts.length})
            </button>
            {showAccounts && (
              <div className="login-accounts-list">
                {savedAccounts.map((acc, i) => (
                  <button key={i} className="login-account-item" onClick={() => onSwitchAccount && onSwitchAccount(acc)}>
                    <span className="login-account-avatar">👤</span>
                    <span className="login-account-name">{acc.username}</span>
                    {acc.tag && <span className="login-account-tag">{acc.tag}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="login-toggle" data-testid="login-toggle" onClick={() => { setIsRegister(!isRegister); setError(''); setConfirmPassword(''); setTag(''); }}>
          {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </p>
        <div className="login-features">
          <span>💬 Чаты</span>
          <span>📎 Файлы</span>
          <span>📋 Задачи</span>
          <span>📰 Новости</span>
        </div>
      </div>
    </div>
  );
}
