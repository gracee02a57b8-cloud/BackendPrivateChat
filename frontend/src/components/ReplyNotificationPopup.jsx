import { useEffect } from 'react';

export default function ReplyNotificationPopup({ notification, onClose, onGoToMessage }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  const isReply = notification.type === 'REPLY_NOTIFICATION';
  const icon = isReply ? '↩️' : '📢';
  const title = isReply
    ? `${notification.sender} ответил(а) на ваше сообщение`
    : `${notification.sender} упомянул(а) вас`;

  return (
    <div className="reply-notification-popup" onClick={() => { onGoToMessage?.(notification); onClose(); }}>
      <div className="reply-notification-header">
        <span className="reply-notification-icon">{icon}</span>
        <span className="reply-notification-title">{title}</span>
        <button className="reply-notification-close" onClick={(e) => { e.stopPropagation(); onClose(); }}>✕</button>
      </div>
      <div className="reply-notification-body">
        <p className="reply-notification-content">
          {notification.content?.length > 80
            ? notification.content.slice(0, 80) + '...'
            : notification.content}
        </p>
        {isReply && notification.replyToContent && (
          <p className="reply-notification-original">
            В ответ на: {notification.replyToContent.length > 50
              ? notification.replyToContent.slice(0, 50) + '...'
              : notification.replyToContent}
          </p>
        )}
      </div>
    </div>
  );
}
