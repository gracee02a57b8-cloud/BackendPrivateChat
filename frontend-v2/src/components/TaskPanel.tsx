// ═══════════════════════════════════════════════
//  Task Panel — task management board
// ═══════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { fetchTasks, createTask, completeTask, deleteTask } from '@/lib/api';
import { ArrowLeft, Plus, Check, Trash2, Clock, AlertTriangle, X } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface TaskPanelProps {
  onClose: () => void;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  assignedTo: string;
  createdBy: string;
  dueDate?: string;
  completed: boolean;
  overdue?: boolean;
  createdAt?: string;
}

export default function TaskPanel({ onClose }: TaskPanelProps) {
  const { token, username } = useStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '', dueDate: '' });

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchTasks(token).then(setTasks).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  const handleCreate = async () => {
    if (!token || !form.title.trim() || !form.assignedTo.trim()) return;
    try {
      const task = await createTask(token, {
        ...form,
        dueDate: form.dueDate || undefined,
      });
      setTasks([task, ...tasks]);
      setForm({ title: '', description: '', assignedTo: '', dueDate: '' });
      setShowCreate(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleComplete = async (taskId: number) => {
    if (!token) return;
    try {
      await completeTask(token, taskId);
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, completed: true } : t)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!token) return;
    try {
      await deleteTask(token, taskId);
      setTasks(tasks.filter((t) => t.id !== taskId));
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = tasks.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-(--color-bg-primary)">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 bg-(--color-bg-surface) border-b border-(--color-separator) shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
          <ArrowLeft size={22} />
        </button>
        <h2 className="text-base font-semibold flex-1">Задачи</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="p-2 rounded-full hover:bg-(--color-bg-hover) cursor-pointer text-(--color-accent)">
          <Plus size={22} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-(--color-separator) bg-(--color-bg-surface)">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium cursor-pointer transition-colors',
              filter === f ? 'text-(--color-accent) border-b-2 border-(--color-accent)' : 'text-(--color-text-secondary)'
            )}
          >
            {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Завершённые'}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-4 bg-(--color-bg-surface) border-b border-(--color-separator)">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Название задачи"
            className="w-full px-3 py-2 text-sm bg-(--color-bg-tertiary) rounded-lg outline-none focus:ring-1 focus:ring-(--color-accent) mb-2"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Описание (необязательно)"
            rows={2}
            className="w-full px-3 py-2 text-sm bg-(--color-bg-tertiary) rounded-lg outline-none focus:ring-1 focus:ring-(--color-accent) resize-none mb-2"
          />
          <div className="flex gap-2 mb-3">
            <input
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              placeholder="Назначить кому"
              className="flex-1 px-3 py-2 text-sm bg-(--color-bg-tertiary) rounded-lg outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="px-3 py-2 text-sm bg-(--color-bg-tertiary) rounded-lg outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm rounded-lg hover:bg-(--color-bg-hover) cursor-pointer">
              Отмена
            </button>
            <button
              onClick={handleCreate}
              disabled={!form.title.trim() || !form.assignedTo.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-(--color-accent) text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              Создать
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-(--color-accent) border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-(--color-text-tertiary)">
            <p className="text-sm">Нет задач</p>
          </div>
        ) : (
          filtered.map((task) => (
            <div
              key={task.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 border-b border-(--color-separator)',
                task.completed && 'opacity-60'
              )}
            >
              <button
                onClick={() => !task.completed && handleComplete(task.id)}
                className={cn(
                  'w-5 h-5 mt-0.5 rounded-full border-2 shrink-0 flex items-center justify-center cursor-pointer transition-colors',
                  task.completed
                    ? 'bg-(--color-accent) border-(--color-accent)'
                    : 'border-(--color-text-tertiary) hover:border-(--color-accent)'
                )}
              >
                {task.completed && <Check size={12} className="text-white" />}
              </button>

              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', task.completed && 'line-through')}>{task.title}</p>
                {task.description && (
                  <p className="text-xs text-(--color-text-secondary) mt-0.5">{task.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-(--color-text-tertiary)">
                  <span>→ {task.assignedTo}</span>
                  {task.dueDate && (
                    <span className={cn('flex items-center gap-1', task.overdue && 'text-(--color-danger)')}>
                      {task.overdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                </div>
              </div>

              {task.createdBy === username && (
                <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer text-(--color-text-tertiary)">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
