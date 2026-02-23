import { useState, useEffect } from 'react';

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

function formatCallTime(ts) {
  if (!ts) return '';
  const d = new Date(ts.includes?.('T') ? ts : ts.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diff = now - d;
  const oneDay = 86400000;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
    return `сегодня в ${time}`;
  }
  if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear()) {
    return `вчера в ${time}`;
  }
  if (diff < 7 * oneDay) {
    const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    return `${days[d.getDay()]} в ${time}`;
  }
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} в ${time}`;
}

function formatDuration(sec) {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return `${m} мин ${s > 0 ? s + ' сек' : ''}`;
  return `${s} сек`;
}

export default function RecentCalls({ token, username, onBack, onStartCall, avatarMap = {} }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalls();
  }, []);

  const fetchCalls = async () => {
    try {
      const res = await fetch('/api/calls/history?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      setCalls(data);
    } catch (err) {
      console.error('[Calls] Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCallDirection = (call) => {
    const isOutgoing = call.caller === username;
    const isMissed = call.status === 'missed' || call.status === 'unavailable';
    const isRejected = call.status === 'rejected';
    const isBusy = call.status === 'busy';

    if (isOutgoing) {
      if (isMissed || isRejected || isBusy) return { icon: '↗', color: '#ef5350', label: 'Исходящий' };
      return { icon: '↗', color: '#4ecca3', label: 'Исходящий' };
    } else {
      if (isMissed) return { icon: '↙', color: '#ef5350', label: 'Пропущенный' };
      if (isRejected) return { icon: '↙', color: '#ef5350', label: 'Отклонённый' };
      if (isBusy) return { icon: '↙', color: '#f0a500', label: 'Занят' };
      return { icon: '↙', color: '#4ecca3', label: 'Входящий' };
    }
  };

  const getPeerName = (call) => {
    return call.caller === username ? call.callee : call.caller;
  };

  return (
    <div className="recent-calls-page">
      <div className="edit-profile-header">
        <button className="edit-profile-back" onClick={onBack}>←</button>
        <h2 className="edit-profile-title">Звонки</h2>
        <div style={{ width: 40 }} />
      </div>

      <div className="recent-calls-list">
        {loading && (
          <div className="sb-empty"><span>⏳</span><p>Загрузка...</p></div>
        )}
        {!loading && calls.length === 0 && (
          <div className="sb-empty"><span>📞</span><p>Нет звонков</p></div>
        )}
        {!loading && calls.map((call) => {
          const peer = getPeerName(call);
          const dir = getCallDirection(call);
          const av = avatarMap[peer];
          const isVideo = call.callType === 'video';
          return (
            <div key={call.id} className="recent-call-item" onClick={() => onStartCall?.(peer, call.callType || 'audio')}>
              <div className="sb-chat-avatar-wrap">
                <div className="sb-chat-avatar" style={{ background: av ? 'transparent' : getAvatarColor(peer) }}>
                  {av ? <img src={av} alt="" className="sb-avatar-img" /> : getInitials(peer)}
                </div>
              </div>
              <div className="recent-call-info">
                <span className="recent-call-name">{peer}</span>
                <div className="recent-call-meta">
                  <span className="recent-call-direction" style={{ color: dir.color }}>{dir.icon}</span>
                  <span className="recent-call-time">{formatCallTime(call.timestamp)}</span>
                  {call.status === 'completed' && call.duration > 0 && (
                    <span className="recent-call-duration">({formatDuration(call.duration)})</span>
                  )}
                </div>
              </div>
              <button
                className="recent-call-action"
                onClick={(e) => { e.stopPropagation(); onStartCall?.(peer, call.callType || 'audio'); }}
                title={isVideo ? 'Видеозвонок' : 'Аудиозвонок'}
              >
                {isVideo ? '📹' : '📞'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
