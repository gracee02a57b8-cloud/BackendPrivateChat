import { useState, useEffect, useRef } from 'react';
import EmojiPicker from './EmojiPicker';

export default function ChatRoom({ messages, onSendMessage, roomName, username, connected }) {
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
    setShowEmoji(false);
  };

  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    if (el) {
      const start = el.selectionStart || input.length;
      const end = el.selectionEnd || input.length;
      const newVal = input.slice(0, start) + emoji + input.slice(end);
      setInput(newVal);
      setTimeout(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      }, 0);
    } else {
      setInput(input + emoji);
    }
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
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Введите сообщение..."
            disabled={!connected}
            autoFocus
          />
          <button type="button" className="emoji-btn" onClick={() => setShowEmoji(!showEmoji)} title="Эмодзи">
            😊
          </button>
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
        </div>
        <button type="submit" disabled={!connected || !input.trim()}>
          Отправить
        </button>
      </form>
    </div>
  );
}
