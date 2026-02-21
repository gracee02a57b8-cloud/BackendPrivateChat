import { useEffect, useState } from 'react';

export default function TaskNotificationPopup({ notification, onClose, onOpenTasks }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Auto-close after 10 seconds
    const timer = setTimeout(() => handleClose(), 10000);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 300);
  };

  if (!notification) return null;

  const { label, title, sender, description, assignedTo, deadline, msgType } = notification;

  const iconClass =
    msgType === 'TASK_CREATED' ? 'created' :
    msgType === 'TASK_COMPLETED' ? 'completed' : 'overdue';

  const formatDeadline = (dl) => {
    if (!dl) return null;
    try {
      const d = new Date(dl);
      return d.toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dl;
    }
  };

  return (
    <div className={`task-popup-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`task-popup ${iconClass} ${closing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button className="task-popup-close" onClick={handleClose}>✕</button>

        <div className="task-popup-header">
          <span className={`task-popup-icon ${iconClass}`}>
            {msgType === 'TASK_CREATED' ? '📋' : msgType === 'TASK_COMPLETED' ? '✅' : '⚠️'}
          </span>
          <span className="task-popup-label">{label}</span>
        </div>

        <h3 className="task-popup-title">{title}</h3>

        {description && (
          <p className="task-popup-description">{description}</p>
        )}

        <div className="task-popup-details">
          {sender && (
            <div className="task-popup-detail">
              <span className="detail-icon">👤</span>
              <span className="detail-label">От:</span>
              <span className="detail-value">{sender}</span>
            </div>
          )}
          {assignedTo && (
            <div className="task-popup-detail">
              <span className="detail-icon">🎯</span>
              <span className="detail-label">Кому:</span>
              <span className="detail-value">{assignedTo}</span>
            </div>
          )}
          {deadline && (
            <div className="task-popup-detail">
              <span className="detail-icon">📅</span>
              <span className="detail-label">Срок:</span>
              <span className="detail-value">{formatDeadline(deadline)}</span>
            </div>
          )}
        </div>

        <div className="task-popup-actions">
          <button className="task-popup-btn primary" onClick={onOpenTasks}>
            Открыть задачи
          </button>
          <button className="task-popup-btn secondary" onClick={handleClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
