import { useEffect } from 'react';

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
 * In-app toast notification for new messages.
 * Shows sender, room, and message preview. Slides in from the top-right.
 */
export default function MessageNotificationPopup({ notification, onClose, onGoToRoom }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  const { sender, roomName, content, roomId, avatarUrl } = notification;

  return (
    <div className="msg-notification-popup" onClick={() => onGoToRoom?.(roomId)}>
      <div className="msg-notification-header">
        <div className="msg-notification-avatar" style={{ background: avatarUrl ? 'transparent' : getAvatarColor(sender || 'U') }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="msg-notification-avatar-img" />
            : (sender || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="msg-notification-meta">
          <span className="msg-notification-sender">{sender}</span>
          <span className="msg-notification-room">{roomName}</span>
        </div>
        <button className="msg-notification-close" onClick={(e) => { e.stopPropagation(); onClose(); }}>✕</button>
      </div>
      <div className="msg-notification-body">
        <p className="msg-notification-content">
          {content?.length > 100 ? content.slice(0, 100) + '…' : content}
        </p>
      </div>
    </div>
  );
}
