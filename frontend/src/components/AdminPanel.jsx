import { useState, useEffect, useCallback } from 'react';
import { Shield, RefreshCw, LogOut, AlertTriangle, Users, CircleDot, MessageSquare, Zap, UsersRound, Handshake } from 'lucide-react';
import './AdminPanel.css';

export default function AdminPanel({ token, username, onLogout }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Нет доступа');
        throw new Error('Ошибка сервера');
      }
      const data = await res.json();
      setStats(data);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-user-info"><Shield size={18} /> {username}</div>
        <h1>Панель администратора</h1>
        <div className="admin-header-actions">
          <button className="admin-refresh-btn" onClick={fetchStats} disabled={loading}>
            <RefreshCw size={16} /> Обновить
          </button>
          <button className="admin-logout-btn" onClick={onLogout}>
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </div>

      {error && <div className="admin-error"><AlertTriangle size={16} /> {error}</div>}

      {loading && !stats ? (
        <div className="admin-loading">
          <div className="admin-spinner" />
          <p>Загрузка статистики...</p>
        </div>
      ) : stats ? (
        <>
          <div className="admin-stats-grid">
            <div className="admin-stat-card users">
              <div className="stat-icon"><Users size={24} /></div>
              <div className="stat-value">{stats.totalUsers}</div>
              <div className="stat-label">Всего пользователей</div>
            </div>

            <div className="admin-stat-card online">
              <div className="stat-icon"><CircleDot size={24} /></div>
              <div className="stat-value">{stats.onlineUsers}</div>
              <div className="stat-label">Сейчас в сети</div>
            </div>

            <div className="admin-stat-card chats">
              <div className="stat-icon"><MessageSquare size={24} /></div>
              <div className="stat-value">{stats.totalChats}</div>
              <div className="stat-label">Всего чатов</div>
            </div>

            <div className="admin-stat-card active">
              <div className="stat-icon"><Zap size={24} /></div>
              <div className="stat-value">{stats.activeChats}</div>
              <div className="stat-label">Активных чатов (24ч)</div>
            </div>

            <div className="admin-stat-card groups">
              <div className="stat-icon"><UsersRound size={24} /></div>
              <div className="stat-value">{stats.groupChats}</div>
              <div className="stat-label">Групповых чатов</div>
            </div>

            <div className="admin-stat-card direct">
              <div className="stat-icon"><Handshake size={24} /></div>
              <div className="stat-value">{stats.directChats}</div>
              <div className="stat-label">Личных чатов (1-1)</div>
            </div>
          </div>

          {lastUpdate && (
            <div className="admin-footer">
              Обновлено: {lastUpdate.toLocaleTimeString('ru-RU')} · Авто-обновление каждые 30с
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
