import { useState } from 'react';

export default function JoinRoom({ onJoinRoom, onClose }) {
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!roomId.trim()) return;
    setLoading(true);
    setError('');

    let id = roomId.trim();
    // Support both plain ID and full URL with ?join=
    try {
      if (id.includes('?join=')) {
        id = new URL(id).searchParams.get('join');
      }
    } catch {
      // not a URL, use as-is
    }

    const room = await onJoinRoom(id);
    setLoading(false);
    if (room) {
      onClose();
    } else {
      setError('Комната не найдена');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Войти в комнату</h3>
        <input
          type="text"
          value={roomId}
          onChange={(e) => { setRoomId(e.target.value); setError(''); }}
          placeholder="ID комнаты или ссылка..."
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button onClick={handleJoin} disabled={!roomId.trim() || loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
          <button onClick={onClose} className="btn-secondary">Отмена</button>
        </div>
      </div>
    </div>
  );
}
