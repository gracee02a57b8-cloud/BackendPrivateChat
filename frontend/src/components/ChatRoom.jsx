import { useState, useEffect, useRef } from 'react';
import EmojiPicker from './EmojiPicker';

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ';
}

export default function ChatRoom({ messages, onSendMessage, roomName, username, connected, token }) {
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setInput('');
  }, [roomName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() && !uploading) return;
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
    setShowEmoji(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      alert('Файл слишком большой (макс. 100 МБ)');
      e.target.value = '';
      return;
    }
    uploadFile(file);
    e.target.value = '';
  };

  const uploadFile = (file) => {
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload/file');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploading(false);
      setUploadProgress(null);
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        onSendMessage(input.trim() || '', {
          fileUrl: data.url,
          fileName: data.originalName,
          fileSize: data.size,
          fileType: data.contentType,
        });
        setInput('');
      } else {
        alert('Ошибка загрузки файла');
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress(null);
      alert('Ошибка загрузки файла');
    };

    xhr.send(formData);
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

  const renderAttachment = (msg) => {
    if (!msg.fileUrl) return null;
    const isImage = msg.fileType && msg.fileType.startsWith('image/');
    if (isImage) {
      return (
        <div className="file-attachment image-attachment">
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
            <img src={msg.fileUrl} alt={msg.fileName || 'image'} />
          </a>
          <div className="file-info">
            <span className="file-name">{msg.fileName}</span>
            <span className="file-size">{formatFileSize(msg.fileSize)}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="file-attachment">
        <a href={`${msg.fileUrl}?download=true`} className="file-download" download>
          <span className="file-icon">📎</span>
          <div className="file-info">
            <span className="file-name">{msg.fileName}</span>
            <span className="file-size">{formatFileSize(msg.fileSize)}</span>
          </div>
          <span className="download-icon">⬇️</span>
        </a>
      </div>
    );
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
                {msg.content && <div className="message-body">{msg.content}</div>}
                {renderAttachment(msg)}
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {uploading && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
          <span className="upload-progress-text">Загрузка {uploadProgress}%</span>
        </div>
      )}

      <form className="message-form" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <button
            type="button"
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={!connected || uploading}
            title="Прикрепить файл"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            hidden
          />
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
        <button type="submit" disabled={!connected || (!input.trim() && !uploading)}>
          Отправить
        </button>
      </form>
    </div>
  );
}
