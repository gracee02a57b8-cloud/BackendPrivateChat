import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

let showToastGlobal = null;

/**
 * Lightweight toast notification — replaces native alert().
 * Usage: import { showToast } from './Toast';
 *        showToast('Файл слишком большой', 'error');
 */
export function showToast(message, type = 'info') {
  if (showToastGlobal) showToastGlobal(message, type);
}

export default function ToastContainer() {
  const [toast, setToast] = useState(null);

  const show = useCallback((message, type) => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    showToastGlobal = show;
    return () => { showToastGlobal = null; };
  }, [show]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="toast-container">
      <div className={`toast toast-${toast.type}`} key={toast.id} role="alert" aria-live="polite">
        <span>{toast.type === 'error' ? <AlertTriangle size={16} /> : toast.type === 'success' ? <CheckCircle size={16} /> : <Info size={16} />}</span>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
