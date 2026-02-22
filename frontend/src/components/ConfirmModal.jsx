import { useEffect, useRef } from 'react';

/**
 * ConfirmModal — accessible replacement for native confirm().
 * Props: { message, detail?, icon?, confirmLabel?, cancelLabel?, onConfirm, onCancel }
 */
export default function ConfirmModal({
  message,
  detail,
  icon = '⚠️',
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const modalRef = useRef(null);

  // Focus trap + escape key
  useEffect(() => {
    cancelRef.current?.focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div className="confirm-modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-label={message}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()} ref={modalRef}>
        <div className="confirm-modal-icon">{icon}</div>
        <h3>{message}</h3>
        {detail && <p>{detail}</p>}
        <div className="confirm-modal-actions">
          <button className="confirm-modal-cancel" onClick={onCancel} ref={cancelRef}>
            {cancelLabel}
          </button>
          <button className="confirm-modal-ok" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
