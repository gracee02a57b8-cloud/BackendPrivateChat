import { useEffect, useState } from 'react';
import { ClipboardList, CheckCircle, AlertTriangle, X } from 'lucide-react';

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
    msgType === 'TASK_CREATED' ? <ClipboardList size={18} /> :
    msgType === 'TASK_COMPLETED' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />;

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
      <button className="task-toast-close" onClick={(e) => { e.stopPropagation(); handleClose(); }}><X size={14} /></button>
    </div>
  );
}
