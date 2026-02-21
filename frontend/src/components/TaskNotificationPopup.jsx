import { useEffect, useState } from 'react';

export default function TaskNotificationPopup({ notification, onClose, onOpenTasks }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setClosing(false);
    const timer = setTimeout(() => handleClose(), 5000);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 300);
  };

  if (!notification) return null;

  const { title, assignedTo, msgType } = notification;

  const statusText =
    msgType === 'TASK_CREATED' ? 'На вас назначена' :
    msgType === 'TASK_COMPLETED' ? 'Выполнена' : 'Просрочена';

  const statusIcon =
    msgType === 'TASK_CREATED' ? '📋' :
    msgType === 'TASK_COMPLETED' ? '✅' : '⚠️';

  const statusClass =
    msgType === 'TASK_CREATED' ? 'created' :
    msgType === 'TASK_COMPLETED' ? 'completed' : 'overdue';

  return (
    <div className={`task-toast ${statusClass}${closing ? ' closing' : ''}`} onClick={onOpenTasks}>
      <div className="task-toast-left">
        <span className="task-toast-icon">{statusIcon}</span>
      </div>
      <div className="task-toast-body">
        <span className={`task-toast-status ${statusClass}`}>{statusText}</span>
        <span className="task-toast-title">{title}</span>
      </div>
      <button className="task-toast-close" onClick={(e) => { e.stopPropagation(); handleClose(); }}>✕</button>
    </div>
  );
}
