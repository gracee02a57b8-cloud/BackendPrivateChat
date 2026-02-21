import { useState, useEffect, useRef } from 'react';

export default function MentionDropdown({ users, filter, onSelect, position }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);

  const filtered = users.filter(u =>
    u.toLowerCase().startsWith(filter.toLowerCase())
  ).slice(0, 6);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (filtered.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        onSelect(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedIndex, onSelect]);

  if (filtered.length === 0) return null;

  return (
    <div className="mention-dropdown" style={position ? { left: position.left, bottom: position.bottom } : {}}>
      {filtered.map((user, i) => (
        <div
          key={user}
          className={`mention-item${i === selectedIndex ? ' selected' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(user); }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="mention-at">@</span>
          <span className="mention-name">{user}</span>
        </div>
      ))}
    </div>
  );
}
