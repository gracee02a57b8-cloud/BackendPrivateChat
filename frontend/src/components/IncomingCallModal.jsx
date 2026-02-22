import { useEffect, useRef } from 'react';

const AVATAR_COLORS = [
  '#e94560', '#4ecca3', '#f0a500', '#a855f7',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Incoming call modal — full-screen overlay with accept / reject buttons.
 */
export default function IncomingCallModal({ caller, callType, avatarUrl, onAccept, onReject }) {
  const timerRef = useRef(null);

  // Auto-reject after 30 seconds
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onReject();
    }, 30000);
    return () => clearTimeout(timerRef.current);
  }, [onReject]);

  const isVideo = callType === 'video';
  const label = isVideo ? 'Видеозвонок' : 'Аудиозвонок';
  const icon = isVideo ? '📹' : '📞';

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        <div className="incoming-call-pulse"></div>
        <div className="incoming-call-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={caller} className="incoming-call-avatar-img" />
          ) : (
            <div
              className="incoming-call-avatar-placeholder"
              style={{ background: getAvatarColor(caller) }}
            >
              {caller.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="incoming-call-info">
          <span className="incoming-call-icon">{icon}</span>
          <span className="incoming-call-name">{caller}</span>
          <span className="incoming-call-label">{label}</span>
        </div>
        <div className="incoming-call-actions">
          <button className="call-btn call-btn-reject" onClick={onReject} title="Отклонить">
            <span>✕</span>
          </button>
          <button className="call-btn call-btn-accept" onClick={onAccept} title="Принять">
            <span>📞</span>
          </button>
        </div>
      </div>
    </div>
  );
}
