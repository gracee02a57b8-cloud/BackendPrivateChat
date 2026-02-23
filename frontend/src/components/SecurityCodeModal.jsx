import { useState, useEffect, useRef } from 'react';
import { copyToClipboard } from '../utils/clipboard';
import { LockOpen, ShieldCheck, KeyRound, Check, Clipboard } from 'lucide-react';

/**
 * SecurityCodeModal — displays the safety number for identity verification.
 * Both users see the same 24-digit code; they compare to confirm no MITM.
 */
export default function SecurityCodeModal({ securityCode, peerUsername, onClose, unavailable }) {
  const [copied, setCopied] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }
  }, [copied]);

  // Focus trap + keyboard handling
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab' && focusable.length > 0) {
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
  }, [onClose]);

  const handleCopy = () => {
    copyToClipboard(securityCode || '');
    setCopied(true);
  };

  if (!securityCode && !unavailable) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Код безопасности">
      <div className="modal security-code-modal" onClick={(e) => e.stopPropagation()} ref={modalRef}>
        <div className="security-code-header">
          <span className="security-icon">{unavailable ? <LockOpen size={40} /> : <ShieldCheck size={40} />}</span>
          <h3>{unavailable ? 'E2E шифрование' : 'Код безопасности'}</h3>
        </div>
        {unavailable ? (
          <>
            <p className="security-code-desc">
              Сквозное шифрование с пользователем <strong>{peerUsername}</strong> пока недоступно.
            </p>
            <div className="e2e-unavailable-info">
              <p><KeyRound size={14} /> Для активации E2E шифрования необходимо, чтобы оба участника обменялись хотя бы одним сообщением в этом чате.</p>
              <p>После установки сессии здесь появится код безопасности для верификации.</p>
            </div>
            <div className="security-code-actions">
              <button className="btn-primary" onClick={onClose}>Понятно</button>
            </div>
          </>
        ) : (
          <>
            <p className="security-code-desc">
              Сравните этот код с пользователем <strong>{peerUsername}</strong>.
              Если коды совпадают — соединение защищено от перехвата.
            </p>
            <div className="security-code-display">
              {securityCode}
            </div>
            <div className="security-code-actions">
              <button className="btn-secondary" onClick={handleCopy}>
                {copied ? <><Check size={14} /> Скопировано</> : <><Clipboard size={14} /> Копировать</>}
              </button>
              <button className="btn-primary" onClick={onClose}>Готово</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
