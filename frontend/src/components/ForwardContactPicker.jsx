import { useState, useRef, useEffect } from 'react';
import { X, Search, Check, Send, Users, Bookmark } from 'lucide-react';
import { getAvatarColor, getInitials } from '../utils/avatar';

/**
 * ForwardContactPicker — Telegram-style modal for selecting contacts/rooms
 * to forward one or more messages to. Supports multi-select.
 */
export default function ForwardContactPicker({
  rooms = [],
  allUsers = [],
  username,
  avatarMap = {},
  onlineUsers = [],
  onForward,   // (selectedRoomIds: string[]) => void
  onClose,
  messagesToForward = [],  // array of message objects
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const searchRef = useRef(null);

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const q = search.toLowerCase().trim();

  // Build list: existing rooms (private + group) + users without existing chat
  const existingPrivateUsers = new Set();
  const filteredRooms = rooms
    .filter(r => r.type !== 'SAVED_MESSAGES')
    .filter(r => {
      const name = getDisplayName(r);
      return !q || name.toLowerCase().includes(q);
    })
    .map(r => {
      if (r.type === 'PRIVATE') {
        const peer = r.name.split(' & ').find(n => n !== username) || r.name;
        existingPrivateUsers.add(peer);
      }
      return r;
    });

  // Users without existing private chat
  const extraUsers = allUsers
    .filter(u => u.username !== username)
    .filter(u => !existingPrivateUsers.has(u.username))
    .filter(u => !q || u.username.toLowerCase().includes(q));

  function getDisplayName(room) {
    if (room.type === 'SAVED_MESSAGES') return 'Избранное';
    if (room.type === 'PRIVATE') {
      const parts = room.name.split(' & ');
      return parts.find(p => p !== username) || room.name;
    }
    return room.name;
  }

  const toggleRoom = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleUser = (uname) => {
    // Use a special key "user:" prefix for users without room
    const key = `user:${uname}`;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSend = () => {
    if (selected.size === 0) return;
    onForward([...selected]);
    onClose();
  };

  const msgCount = messagesToForward.length;

  return (
    <div className="forward-picker-overlay" onClick={onClose}>
      <div className="forward-picker" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="forward-picker-header">
          <h3>Переслать {msgCount > 1 ? `(${msgCount} сообщ.)` : 'сообщение'}</h3>
          <button className="forward-picker-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Search */}
        <div className="forward-picker-search">
          <Search size={16} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Selected chips */}
        {selected.size > 0 && (
          <div className="forward-picker-chips">
            {[...selected].map(key => {
              const isUser = key.startsWith('user:');
              const label = isUser
                ? key.replace('user:', '')
                : getDisplayName(rooms.find(r => r.id === key) || { name: key, type: 'ROOM' });
              return (
                <span key={key} className="forward-picker-chip" onClick={() => {
                  if (isUser) toggleUser(key.replace('user:', ''));
                  else toggleRoom(key);
                }}>
                  {label} <X size={12} />
                </span>
              );
            })}
          </div>
        )}

        {/* Contact list */}
        <div className="forward-picker-list">
          {/* Existing rooms */}
          {filteredRooms.map(room => {
            const name = getDisplayName(room);
            const isOnline = room.type === 'PRIVATE' && onlineUsers.includes(name);
            const av = avatarMap[name];
            const isChecked = selected.has(room.id);
            return (
              <div
                key={room.id}
                className={`forward-picker-item${isChecked ? ' checked' : ''}`}
                onClick={() => toggleRoom(room.id)}
              >
                <div className="forward-picker-avatar" style={{ background: av ? 'transparent' : getAvatarColor(name) }}>
                  {av
                    ? <img src={av} alt="" className="forward-picker-avatar-img" />
                    : getInitials(name)}
                </div>
                <div className="forward-picker-info">
                  <span className="forward-picker-name">{name}</span>
                  <span className="forward-picker-status">
                    {room.type === 'ROOM' ? <><Users size={12} /> Группа</> : isOnline ? '● В сети' : ''}
                  </span>
                </div>
                <div className={`forward-picker-check${isChecked ? ' on' : ''}`}>
                  {isChecked && <Check size={14} />}
                </div>
              </div>
            );
          })}

          {/* Extra users (no existing chat) */}
          {extraUsers.map(user => {
            const key = `user:${user.username}`;
            const isChecked = selected.has(key);
            const av = avatarMap[user.username] || user.avatarUrl;
            const isOnline = user.online || onlineUsers.includes(user.username);
            return (
              <div
                key={key}
                className={`forward-picker-item${isChecked ? ' checked' : ''}`}
                onClick={() => toggleUser(user.username)}
              >
                <div className="forward-picker-avatar" style={{ background: av ? 'transparent' : getAvatarColor(user.username) }}>
                  {av
                    ? <img src={av} alt="" className="forward-picker-avatar-img" />
                    : getInitials(user.username)}
                </div>
                <div className="forward-picker-info">
                  <span className="forward-picker-name">{user.username}</span>
                  <span className="forward-picker-status">{isOnline ? '● В сети' : ''}</span>
                </div>
                <div className={`forward-picker-check${isChecked ? ' on' : ''}`}>
                  {isChecked && <Check size={14} />}
                </div>
              </div>
            );
          })}

          {filteredRooms.length === 0 && extraUsers.length === 0 && (
            <div className="forward-picker-empty">
              <Search size={28} />
              <p>Не найдено</p>
            </div>
          )}
        </div>

        {/* Send button */}
        <div className="forward-picker-footer">
          <button
            className="forward-picker-send"
            disabled={selected.size === 0}
            onClick={handleSend}
          >
            <Send size={18} />
            Отправить {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
