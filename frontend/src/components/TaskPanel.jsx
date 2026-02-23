import { useState, useEffect } from 'react';
import ConfirmModal from './ConfirmModal';
import { ClipboardList, Plus, X, ArrowLeft, Paperclip, Trash2, User, FileText, Clock, Play, CheckCircle, RotateCcw } from 'lucide-react';

const STATUS_LABELS = {
  OPEN: 'Открыта',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнена',
};

const STATUS_COLORS = {
  OPEN: '#e94560',
  IN_PROGRESS: '#f0a500',
  DONE: '#4ecca3',
};

export default function TaskPanel({ token, username, onClose }) {
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchUser, setSearchUser] = useState('');
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [taskFile, setTaskFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState(null);

  // Get current Moscow time as datetime-local string
  const getMskNow = () => {
    const msk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const pad = (n) => String(n).padStart(2, '0');
    return `${msk.getFullYear()}-${pad(msk.getMonth() + 1)}-${pad(msk.getDate())}T${pad(msk.getHours())}:${pad(msk.getMinutes())}`;
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = () => {
    fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(setTasks)
      .catch(console.error);
  };

  const handleSearchUser = (val) => {
    setAssignedTo(val);
    setSearchUser(val);
    if (val.length >= 1) {
      fetch(`/api/chat/users?search=${encodeURIComponent(val)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((data) => {
          if (Array.isArray(data)) {
            setUserSuggestions(data.map(u => typeof u === 'string' ? u : u.username).filter(u => u !== username));
          }
        })
        .catch(console.error);
    } else {
      setUserSuggestions([]);
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    if (!title.trim() || !assignedTo.trim() || !deadline) return;
    setUploading(true);
    try {
      let fileUrl = null, fileName = null, fileType = null;

      if (taskFile) {
        try {
          // Sanitize filename: keep only ASCII + extension for upload (avoids encoding issues)
          const origName = taskFile.name;
          const dotIdx = origName.lastIndexOf('.');
          const ext = dotIdx >= 0 ? origName.substring(dotIdx) : '';
          const safeName = 'file_' + Date.now() + ext;

          const formData = new FormData();
          formData.append('file', taskFile, safeName);
          const uploadRes = await fetch('/api/upload/file', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            fileUrl = data.url;
            fileName = origName; // Keep original name for display
            fileType = taskFile.type || 'application/octet-stream';
          }
        } catch (uploadErr) {
          console.error('File upload failed:', uploadErr);
          // Continue creating task without file
        }
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, description, assignedTo, deadline, fileUrl, fileName, fileType }),
      });
      if (res.ok) {
        setTitle('');
        setDescription('');
        setAssignedTo('');
        setDeadline('');
        setTaskFile(null);
        setShowForm(false);
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const updateStatus = async (taskId, newStatus) => {
    try {
      await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTask = async (taskId) => {
    setDeleteTaskConfirm(taskId);
  };

  const confirmDeleteTask = async () => {
    const taskId = deleteTaskConfirm;
    setDeleteTaskConfirm(null);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const isOverdue = (task) => {
    if (task.status === 'DONE' || !task.deadline) return false;
    return new Date(task.deadline) < new Date();
  };

  const filtered = tasks.filter((t) => {
    if (filter === 'my') return t.assignedTo === username;
    if (filter === 'created') return t.createdBy === username;
    if (filter === 'open') return t.status !== 'DONE';
    return true;
  });

  return (
    <div className="task-panel">
      <div className="task-header">
        <h2><ClipboardList size={20} /> Задачи</h2>
        <div className="task-header-actions">
          <button className="add-task-btn" onClick={() => { if (!showForm) setDeadline(getMskNow()); setShowForm(!showForm); }}>
            {showForm ? <><X size={14} /> Закрыть</> : <><Plus size={14} /> Новая задача</>}
          </button>
          <button className="back-btn" onClick={onClose}><ArrowLeft size={14} /> Назад в чат</button>
        </div>
      </div>

      {showForm && (
        <form className="task-form" onSubmit={createTask}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название задачи *"
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание задачи"
            rows={3}
          />
          <div className="task-form-row">
            <div className="task-assignee-wrapper">
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => handleSearchUser(e.target.value)}
                placeholder="Ответственный (логин) *"
                required
              />
              {userSuggestions.length > 0 && searchUser && (
                <div className="assignee-suggestions">
                  {userSuggestions.map((u) => (
                    <div key={u} className="assignee-item" onClick={() => { setAssignedTo(u); setUserSuggestions([]); setSearchUser(''); }}>
                      {u}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={getMskNow()}
              required
            />
          </div>
          <div className="task-file-upload">
            <label className="task-file-label">
              <Paperclip size={14} /> {taskFile ? taskFile.name : 'Прикрепить файл'}
              <input type="file" onChange={(e) => setTaskFile(e.target.files[0] || null)} hidden />
            </label>
            {taskFile && (
              <button type="button" className="task-file-remove" onClick={() => setTaskFile(null)}><X size={14} /></button>
            )}
          </div>
          <button type="submit" disabled={!title.trim() || !assignedTo.trim() || !deadline || uploading}>
            {uploading ? 'Загрузка...' : 'Создать задачу'}
          </button>
        </form>
      )}

      <div className="task-filters">
        {['all', 'my', 'created', 'open'].map((f) => (
          <button
            key={f}
            className={`task-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Все' : f === 'my' ? 'Мне' : f === 'created' ? 'Мои' : 'Открытые'}
          </button>
        ))}
      </div>

      <div className="task-list">
        {filtered.length === 0 && (
          <div className="empty-tasks">Задач нет</div>
        )}
        {filtered.map((task) => (
          <div key={task.id} className={`task-card ${isOverdue(task) ? 'overdue' : ''}`}>
            <div className="task-card-header">
              <span className="task-status-dot" style={{ background: STATUS_COLORS[task.status] || '#888' }} />
              <h4 className="task-title">{task.title}</h4>
              {task.createdBy === username && (
                <button className="task-delete-btn" onClick={() => deleteTask(task.id)}><Trash2 size={14} /></button>
              )}
            </div>
            {task.description && <p className="task-desc">{task.description}</p>}
            {task.fileUrl && (
              <a className="task-file-link" href={task.fileUrl} target="_blank" rel="noopener noreferrer">
                <Paperclip size={14} /> {task.fileName || 'Файл'}
              </a>
            )}
            <div className="task-meta">
              <span><User size={12} /> {task.assignedTo}</span>
              <span><FileText size={12} /> {task.createdBy}</span>
              <span className={isOverdue(task) ? 'deadline-overdue' : ''}>
                <Clock size={12} /> {task.deadline ? new Date(task.deadline).toLocaleString('ru-RU') : '—'}
              </span>
            </div>
            <div className="task-actions">
              <span className="task-status-label">{STATUS_LABELS[task.status]}</span>
              {task.status === 'OPEN' && (task.assignedTo === username || task.createdBy === username) && (
                <button className="task-action-btn progress" onClick={() => updateStatus(task.id, 'IN_PROGRESS')}>
                  <Play size={12} /> В работу
                </button>
              )}
              {task.status === 'IN_PROGRESS' && (task.assignedTo === username || task.createdBy === username) && (
                <button className="task-action-btn done" onClick={() => updateStatus(task.id, 'DONE')}>
                  <CheckCircle size={12} /> Выполнено
                </button>
              )}
              {task.status === 'DONE' && task.createdBy === username && (
                <button className="task-action-btn reopen" onClick={() => updateStatus(task.id, 'OPEN')}>
                  <RotateCcw size={12} /> Переоткрыть
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {deleteTaskConfirm && (
        <ConfirmModal
          message="Удалить задачу?"
          icon={<Trash2 size={24} />}
          confirmLabel="Удалить"
          onConfirm={confirmDeleteTask}
          onCancel={() => setDeleteTaskConfirm(null)}
        />
      )}
    </div>
  );
}
