import { useEffect, useRef } from 'react';
import { getAvatarColor } from '../utils/avatar';
import { Video, Phone, X } from 'lucide-react';

/**
 * Incoming call modal — full-screen overlay with accept / reject buttons.
 */
export default function IncomingCallModal({ caller, callType, avatarUrl, onAccept, onReject }) {
  const timerRef = useRef(null);
  const modalRef = useRef(null);

  // Auto-reject after 30 seconds
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onReject();
    }, 30000);
    return () => clearTimeout(timerRef.current);
  }, [onReject]);

  // Focus trap + keyboard handling
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll('button');
    if (focusable.length) focusable[0].focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') { onReject(); return; }
      if (e.key === 'Tab') {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onReject]);

  const isVideo = callType === 'video';
  const label = isVideo ? 'Видеозвонок' : 'Аудиозвонок';
  const icon = isVideo ? <Video size={20} /> : <Phone size={20} />;

  return (
    <div className="incoming-call-overlay" role="dialog" aria-modal="true" aria-label={`Входящий ${label} от ${caller}`}>
      <div className="incoming-call-modal" ref={modalRef}>
        <div className="incoming-call-pulse"></div>
        <div className="incoming-call-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={caller} className="incoming-call-avatar-img" />
          ) : (
            <div
              className="incoming-call-avatar-placeholder"
              style={{ background: getAvatarColor(caller) }}
            >
              {caller.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="incoming-call-info">
          <span className="incoming-call-icon">{icon}</span>
          <span className="incoming-call-name">{caller}</span>
          <span className="incoming-call-label">{label}</span>
        </div>
        <div className="incoming-call-actions">
          <button className="call-btn call-btn-reject" onClick={onReject} title="Отклонить" aria-label="Отклонить звонок">
            <span><X size={24} /></span>
          </button>
          <button className="call-btn call-btn-accept" onClick={onAccept} title="Принять" aria-label="Принять звонок">
            <span><Phone size={24} /></span>
          </button>
        </div>
      </div>
    </div>
  );
}
