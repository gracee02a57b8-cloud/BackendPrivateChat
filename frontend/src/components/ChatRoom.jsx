import { useState, useEffect, useRef, useCallback } from 'react';
import EmojiPicker from './EmojiPicker';

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ';
}

const AVATAR_COLORS = [
  '#e94560', '#4ecca3', '#f0a500', '#a855f7',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  return name.charAt(0).toUpperCase();
}

function formatDateDivider(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function parseTimestamp(ts) {
  if (!ts) return null;
  // Handle "HH:mm:ss" format — assume today
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(ts)) {
    const today = new Date();
    return today.toDateString();
  }
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d.toDateString();
}

export default function ChatRoom({ messages, onSendMessage, onEditMessage, onDeleteMessage, onScheduleMessage, scheduledMessages, roomName, username, connected, token, activeRoom, onlineUsers, typingUsers = [], onTyping }) {
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [dragging, setDragging] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const isAtBottom = useRef(true);

  // Auto-scroll only if user is at bottom
  useEffect(() => {
    if (isAtBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewMsgCount(0);
    } else if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender !== username) {
        setNewMsgCount((prev) => prev + 1);
      }
    }
  }, [messages]);

  // Scroll detection
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const threshold = 100;
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      isAtBottom.current = atBottom;
      setShowScrollBtn(!atBottom);
      if (atBottom) setNewMsgCount(0);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setInput('');
    setEditingMsg(null);
    setShowSchedule(false);
    setNewMsgCount(0);
    isAtBottom.current = true;
    setShowScrollBtn(false);
  }, [roomName]);

  // Close context menu on any click
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() && !uploading) return;

    if (editingMsg) {
      onEditMessage(editingMsg.id, input.trim());
      setEditingMsg(null);
      setInput('');
      resetTextarea();
      return;
    }

    if (showSchedule && scheduleDate) {
      onScheduleMessage(input.trim(), scheduleDate);
      setInput('');
      setShowSchedule(false);
      setScheduleDate('');
      resetTextarea();
      return;
    }

    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
      resetTextarea();
    }
    setShowEmoji(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    autoGrowTextarea(e.target);
    if (onTyping) onTyping();
  };

  const autoGrowTextarea = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const resetTextarea = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMsgCount(0);
  };

  // Drag & Drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        alert('Файл слишком большой (макс. 100 МБ)');
        return;
      }
      uploadFile(file);
    }
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
        autoGrowTextarea(el);
      }, 0);
    } else {
      setInput(input + emoji);
    }
  };

  const copyMessage = (msg) => {
    navigator.clipboard.writeText(msg.content || '');
    setContextMenu(null);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}?join=${activeRoom?.id || ''}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 1500);
    });
  };

  const handleContextMenu = (e, msg) => {
    if (msg.sender !== username || msg.type !== 'CHAT') return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msg });
  };

  const startEdit = (msg) => {
    setEditingMsg(msg);
    setInput(msg.content || '');
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditingMsg(null);
    setInput('');
  };

  const handleDeleteMsg = (msg) => {
    setContextMenu(null);
    if (confirm('Удалить сообщение?')) {
      onDeleteMessage(msg.id);
    }
  };

  const getOtherUserInPM = () => {
    if (!activeRoom || activeRoom.type !== 'PRIVATE') return null;
    const parts = activeRoom.name.split(' & ');
    return parts.find((p) => p !== username) || null;
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
    <div
      className="chat-main"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {dragging && (
        <div className="drag-overlay">
          <div className="drag-overlay-content">
            <span className="drag-icon">📁</span>
            <span>Перетащите файл сюда</span>
          </div>
        </div>
      )}

      <div className="chat-header">
        <div className="chat-header-info">
          <h3>{roomName}</h3>
          {activeRoom?.type === 'PRIVATE' && (() => {
            const otherUser = getOtherUserInPM();
            const isOnline = otherUser && onlineUsers?.includes(otherUser);
            return (
              <span className={`header-online-status ${isOnline ? 'online' : ''}`}>
                {isOnline ? '● в сети' : '● не в сети'}
              </span>
            );
          })()}
        </div>
        <div className="chat-header-actions">
          <button className="copy-link-btn" onClick={handleCopyLink} title="Скопировать ссылку на чат">
            🔗 Поделиться
          </button>
          {copyToast && <span className="copy-toast">Ссылка скопирована!</span>}
        </div>
      </div>

      <div className="messages" ref={messagesContainerRef}>
        {messages.length === 0 && (
          <div className="empty-chat">
            <div className="empty-chat-content">
              <span className="empty-chat-icon">💬</span>
              <p>Нет сообщений</p>
              <span className="empty-chat-hint">Начните общение прямо сейчас!</span>
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          // Date separator
          let dateSep = null;
          if (i === 0 || (msg.timestamp && messages[i - 1]?.timestamp)) {
            const curDate = parseTimestamp(msg.timestamp);
            const prevDate = i > 0 ? parseTimestamp(messages[i - 1]?.timestamp) : null;
            if (curDate && curDate !== prevDate) {
              const label = formatDateDivider(curDate);
              if (label) dateSep = <div className="date-divider" key={`date-${i}`}><span>{label}</span></div>;
            }
          }

          // Group consecutive messages from same sender
          const prevMsg = messages[i - 1];
          const isGrouped = prevMsg && prevMsg.sender === msg.sender
            && prevMsg.type !== 'JOIN' && prevMsg.type !== 'LEAVE'
            && msg.type !== 'JOIN' && msg.type !== 'LEAVE';

          const isOwn = msg.sender === username;
          const isSys = msg.type === 'JOIN' || msg.type === 'LEAVE';

          return (
            <div key={msg.id || i}>
              {dateSep}
              <div
                className={`${getMessageClass(msg)}${isGrouped ? ' grouped' : ''}`}
                onContextMenu={(e) => handleContextMenu(e, msg)}
              >
                {isSys ? (
                  <span className="system-text">{msg.content}</span>
                ) : (
                  <div className="message-row">
                    {/* Avatar */}
                    {!isOwn && !isGrouped && (
                      <div className="avatar-circle" style={{ background: getAvatarColor(msg.sender) }}>
                        {getInitials(msg.sender)}
                      </div>
                    )}
                    {!isOwn && isGrouped && <div className="avatar-spacer" />}

                    <div className="message-bubble">
                      {/* Hover actions */}
                      {isOwn && msg.type === 'CHAT' && (
                        <div className="msg-hover-actions">
                          <button title="Редактировать" onClick={() => startEdit(msg)}>✏️</button>
                          <button title="Удалить" onClick={() => handleDeleteMsg(msg)}>🗑</button>
                          <button title="Копировать" onClick={() => copyMessage(msg)}>📋</button>
                        </div>
                      )}
                      {!isOwn && msg.type === 'CHAT' && (
                        <div className="msg-hover-actions left">
                          <button title="Копировать" onClick={() => copyMessage(msg)}>📋</button>
                        </div>
                      )}

                      {!isGrouped && (
                        <div className="message-header">
                          <strong style={{ color: isOwn ? 'rgba(255,255,255,0.9)' : getAvatarColor(msg.sender) }}>
                            {msg.sender}
                          </strong>
                          <span className="time">
                            {msg.edited && <span className="edited-badge">(ред.) </span>}
                            {msg.timestamp}
                          </span>
                        </div>
                      )}
                      {msg.content && <div className="message-body">{msg.content}</div>}
                      {renderAttachment(msg)}
                      {isGrouped && (
                        <span className="time grouped-time">
                          {msg.edited && <span className="edited-badge">(ред.) </span>}
                          {msg.timestamp}
                          {isOwn && msg.type === 'CHAT' && (
                            <span className={`message-status ${msg.status === 'READ' ? 'read' : ''}`}>
                              {msg.status === 'READ' ? ' ✓✓' : msg.status === 'DELIVERED' ? ' ✓✓' : ' ✓'}
                            </span>
                          )}
                        </span>
                      )}
                      {!isGrouped && isOwn && msg.type === 'CHAT' && (
                        <span className={`message-status bottom-status ${msg.status === 'READ' ? 'read' : ''}`}>
                          {msg.status === 'READ' ? '✓✓' : msg.status === 'DELIVERED' ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span><span></span><span></span>
            </div>
            <span className="typing-text">
              {typingUsers.length === 1
                ? `${typingUsers[0]} печатает`
                : typingUsers.length <= 3
                ? `${typingUsers.join(', ')} печатают`
                : 'Несколько человек печатают'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom */}
      {showScrollBtn && (
        <button className="scroll-to-bottom" onClick={scrollToBottom}>
          ↓ {newMsgCount > 0 && <span className="new-msg-badge">{newMsgCount}</span>}
        </button>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => startEdit(contextMenu.msg)}>✏️ Редактировать</button>
          <button onClick={() => copyMessage(contextMenu.msg)}>📋 Копировать</button>
          <button onClick={() => handleDeleteMsg(contextMenu.msg)}>🗑 Удалить</button>
        </div>
      )}

      {/* Scheduled Messages Banner */}
      {scheduledMessages && scheduledMessages.length > 0 && (
        <div className="scheduled-banner">
          ⏰ Отложенных: {scheduledMessages.length}
        </div>
      )}

      {/* Edit Mode Banner */}
      {editingMsg && (
        <div className="edit-banner">
          <span>✏️ Редактирование: <em>{editingMsg.content?.slice(0, 40)}</em></span>
          <button onClick={cancelEdit}>✕</button>
        </div>
      )}

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
            disabled={!connected || uploading || !!editingMsg}
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
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={editingMsg ? 'Редактировать сообщение...' : 'Введите сообщение...'}
            disabled={!connected}
            rows={1}
            autoFocus
          />
          <button type="button" className="emoji-btn" onClick={() => setShowEmoji(!showEmoji)} title="Эмодзи">
            😊
          </button>
          <button
            type="button"
            className="schedule-btn"
            onClick={() => { setShowSchedule(!showSchedule); setEditingMsg(null); }}
            disabled={!connected || !!editingMsg}
            title="Отложить сообщение"
          >
            ⏰
          </button>
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
        </div>
        {showSchedule && (
          <div className="schedule-picker">
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            <span className="schedule-hint">Сообщение будет отправлено в указанное время</span>
          </div>
        )}
        <button type="submit" disabled={!connected || (!input.trim() && !uploading)}>
          {editingMsg ? '✏️' : showSchedule && scheduleDate ? '⏰' : '➤'}
        </button>
      </form>
    </div>
  );
}
