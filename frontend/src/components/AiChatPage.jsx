import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';

export default function AiChatPage() {
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', text: 'Привет! Я AI-помощник BarsikChat. Чем могу помочь?' },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', text },
      { id: Date.now() + 1, role: 'assistant', text: 'Этот раздел находится в разработке. Скоро здесь появится полноценный AI-ассистент! 🚀' },
    ]);
    setInput('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="ai-chat-page">
      {/* Banner */}
      <div className="ai-chat-banner">
        <Sparkles size={20} />
        <span>Раздел в разработке</span>
      </div>

      {/* Messages */}
      <div className="ai-chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`ai-msg ${m.role}`}>
            {m.role === 'assistant' && (
              <div className="ai-msg-avatar"><Bot size={18} /></div>
            )}
            <div className="ai-msg-bubble">{m.text}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="ai-chat-input-bar">
        <textarea
          className="ai-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Напишите сообщение AI..."
          rows={1}
        />
        <button className="ai-chat-send" onClick={handleSend} disabled={!input.trim()}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
