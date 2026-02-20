import { useState, useEffect, useRef } from 'react';

const API_URL = 'http://localhost:9001';

export default function ChatRoom({ messages, onSendMessage, roomName, username, connected }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setInput('');
  }, [roomName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const getMessageClass = (msg) => {
    if (msg.type === 'JOIN' || msg.type === 'LEAVE') return 'message system';
    if (msg.sender === username) return 'message own';
    return 'message other';
  };

  return (
    <div className="chat-main">
      <div className="chat-header">
        <h3>{roomName}</h3>
      </div>
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
      <form className="message-form" onSubmit={handleSubmit}>
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
  );
}
