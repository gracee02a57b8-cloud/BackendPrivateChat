import { useEffect } from 'react';
import { getAvatarColor } from '../utils/avatar';
import { X } from 'lucide-react';

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
        <button className="msg-notification-close" onClick={(e) => { e.stopPropagation(); onClose(); }}><X size={14} /></button>
      </div>
      <div className="msg-notification-body">
        <p className="msg-notification-content">
          {content?.length > 100 ? content.slice(0, 100) + '…' : content}
        </p>
      </div>
    </div>
  );
}
