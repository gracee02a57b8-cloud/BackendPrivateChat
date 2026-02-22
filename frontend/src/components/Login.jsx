import { useState } from 'react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    setError('');

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        let errMsg = 'Ошибка сервера';
        try { const d = await res.json(); errMsg = d.error || errMsg; } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      onLogin(data.token, data.username, data.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-particles">
        {[...Array(6)].map((_, i) => <div key={i} className="particle" />)}
      </div>
      <div className="login-card">
        <div className="login-logo">🐱</div>
        <h1>BarsikChat</h1>
        <p className="login-subtitle">
          {isRegister ? 'Создайте аккаунт' : 'Безопасный чат для команды'}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="login-input-wrapper">
            <span className="login-input-icon">👤</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Имя пользователя..."
              maxLength={20}
              autoFocus
            />
          </div>
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
          <button type="submit" disabled={loading || !username.trim() || !password}>
            {loading ? (
              <span className="btn-loading"><span className="spinner" /> {isRegister ? 'Регистрация...' : 'Вход...'}</span>
            ) : (isRegister ? 'Зарегистрироваться' : 'Войти в чат')}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <p className="login-toggle" onClick={() => { setIsRegister(!isRegister); setError(''); setConfirmPassword(''); }}>
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
