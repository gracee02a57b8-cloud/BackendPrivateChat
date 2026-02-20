import { useState, useEffect, useRef } from 'react';

const WS_URL = 'ws://localhost:9001';
const API_URL = 'http://localhost:9001';

export default function Chat({ token, username, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/api/chat/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch(console.error);

    const ws = new WebSocket(`${WS_URL}/ws/chat?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      fetchUsers();
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setMessages((prev) => [...prev, msg]);
      if (msg.type === 'JOIN' || msg.type === 'LEAVE') {
        fetchUsers();
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => ws.close();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchUsers = () => {
    fetch(`${API_URL}/api/chat/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setOnlineUsers(data))
      .catch(console.error);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current) return;

    wsRef.current.send(JSON.stringify({ content: input.trim() }));
    setInput('');
  };

  const getMessageClass = (msg) => {
    if (msg.type === 'JOIN' || msg.type === 'LEAVE') return 'message system';
    if (msg.sender === username) return 'message own';
    return 'message other';
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h2>💬 BarsikChat</h2>
          <span className={`status ${connected ? 'online' : 'offline'}`}>
            {connected ? '● В сети' : '● Офлайн'}
          </span>
        </div>
        <div className="user-info">
          <span>
            Вы: <strong>{username}</strong>
          </span>
          <button onClick={onLogout} className="logout-btn">
            Выйти
          </button>
        </div>
        <div className="online-users">
          <h3>В сети ({onlineUsers.length})</h3>
          <ul>
            {onlineUsers.map((user, i) => (
              <li key={i}>
                <span className="user-dot">●</span> {user}
                {user === username && ' (вы)'}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="chat-main">
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-chat">
              <p>Нет сообщений. Начните общение!</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={getMessageClass(msg)}>
              {msg.type === 'JOIN' || msg.type === 'LEAVE' ? (
                <span className="system-text">{msg.content}</span>
              ) : (
                <>
                  <div className="message-header">
                    <strong>{msg.sender}</strong>
                    <span className="time">{msg.timestamp}</span>
                  </div>
                  <div className="message-body">{msg.content}</div>
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form className="message-form" onSubmit={sendMessage}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Введите сообщение..."
            disabled={!connected}
            autoFocus
          />
          <button type="submit" disabled={!connected || !input.trim()}>
            Отправить
          </button>
        </form>
      </div>
    </div>
  );
}
