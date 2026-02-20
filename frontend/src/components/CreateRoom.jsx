import { useState } from 'react';

export default function CreateRoom({ onCreateRoom, onClose }) {
  const [name, setName] = useState('');
  const [createdRoom, setCreatedRoom] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const room = await onCreateRoom(name.trim());
    setCreatedRoom(room);
  };

  const inviteLink = createdRoom
    ? `${window.location.origin}?join=${createdRoom.id}`
    : '';

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Создать комнату</h3>
        {!createdRoom ? (
          <>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название комнаты..."
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="modal-actions">
              <button onClick={handleCreate} disabled={!name.trim()}>Создать</button>
              <button onClick={onClose} className="btn-secondary">Отмена</button>
            </div>
          </>
        ) : (
          <>
            <p>Комната <strong>{createdRoom.name}</strong> создана!</p>
            <p className="invite-label">Ссылка для приглашения:</p>
            <div className="invite-link">
              <input type="text" value={inviteLink} readOnly />
              <button onClick={copyLink}>{copied ? '✓ Скопировано' : '📋 Копировать'}</button>
            </div>
            <div className="modal-actions">
              <button onClick={onClose}>Готово</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
