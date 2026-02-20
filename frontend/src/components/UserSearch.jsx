import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:9001';

export default function UserSearch({ token, username, onStartChat, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`${API_URL}/api/chat/users?search=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setResults(data.filter((u) => u !== username)))
        .catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, token, username]);

  return (
    <div className="user-search">
      <div className="search-header">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск пользователей..."
          autoFocus
        />
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="search-results">
        {results.map((user, i) => (
          <div key={i} className="search-result-item" onClick={() => onStartChat(user)}>
            <span className="user-dot">●</span> {user}
          </div>
        ))}
        {query && results.length === 0 && (
          <div className="no-results">Не найдено</div>
        )}
      </div>
    </div>
  );
}
