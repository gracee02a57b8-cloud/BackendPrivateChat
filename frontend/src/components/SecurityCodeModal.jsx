import { useState, useEffect } from 'react';
import { copyToClipboard } from '../utils/clipboard';

/**
 * SecurityCodeModal — displays the safety number for identity verification.
 * Both users see the same 24-digit code; they compare to confirm no MITM.
 */
export default function SecurityCodeModal({ securityCode, peerUsername, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }
  }, [copied]);

  const handleCopy = () => {
    copyToClipboard(securityCode || '');
    setCopied(true);
  };

  if (!securityCode) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal security-code-modal" onClick={(e) => e.stopPropagation()}>
        <div className="security-code-header">
          <span className="security-icon">🔐</span>
          <h3>Код безопасности</h3>
        </div>
        <p className="security-code-desc">
          Сравните этот код с пользователем <strong>{peerUsername}</strong>.
          Если коды совпадают — соединение защищено от перехвата.
        </p>
        <div className="security-code-display">
          {securityCode}
        </div>
        <div className="security-code-actions">
          <button className="btn-secondary" onClick={handleCopy}>
            {copied ? '✓ Скопировано' : '📋 Копировать'}
          </button>
          <button className="btn-primary" onClick={onClose}>Готово</button>
        </div>
      </div>
    </div>
  );
}
